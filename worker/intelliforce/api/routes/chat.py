"""Endpoints de chat com OpenCode.

- POST /chat        — síncrono, devolve resposta completa (Fase 1)
- POST /chat/stream — SSE, emite cada evento NDJSON do CLI em tempo real (Fase 2)

Auth pass-through: extraímos o JWT do header Authorization e passamos como env
var `INTELLIFORCE_TOKEN` pro subprocess do OpenCode CLI. Scripts Python das
skills (intelliforce-*) usam isso pra chamar a API real do IntelliForce em
nome do user logado, sem precisar de credenciais separadas.

Persistência de histórico: após cada turno bem-sucedido, gravamos uma linha
em chat_sessions (criando ou atualizando) + 2 linhas em chat_messages (user +
agent). O conteúdo rico (tool calls, thinking) continua só no disco do
OpenCode — aqui guardamos só a transcrição limpa pra UI mostrar a sidebar
de conversas.
"""
from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from datetime import timedelta

import structlog
from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.chat import ChatRequest, ChatResponse
from intelliforce.api.security import create_access_token
from intelliforce.db.models.chat_session import ChatMessage, ChatSession
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus
from intelliforce.opencode.runner import OpenCodeRunner
from intelliforce.settings import get_settings

log = structlog.get_logger()

router = APIRouter(prefix="/chat", tags=["chat"])

# Singleton — runner é stateless, só guarda config
_runner = OpenCodeRunner()

_HEARTBEAT_INTERVAL_SECONDS = 15.0
_TITLE_MAX_LEN = 60
_PREVIEW_MAX_LEN = 200

# URL interna que os scripts das skills usam pra chamar a API IntelliForce.
# Em docker-compose, "api" resolve via DNS interno do bridge network.
# Override via env pra dev local fora do docker.
_INTERNAL_API_URL = os.environ.get("INTELLIFORCE_INTERNAL_API_URL", "http://api:8000")


def _build_extra_env(user: User, authorization: str | None) -> dict[str, str]:
    """Monta env vars que o subprocess do OpenCode receberá.

    Scripts das skills (em opencode/.opencode/skills/intelliforce-*/scripts/*.py)
    leem essas vars pra autenticar e localizar a API.
    """
    # Emite um token dedicado pra execução, com validade >= o timeout do OpenCode
    # (+ margem). O token do header dura só 60 min e expirava no meio de runs
    # longas, derrubando as chamadas das skills com 401.
    settings = get_settings()
    ttl = timedelta(seconds=settings.opencode_timeout_seconds + 600)
    token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role},
        expires_delta=ttl,
    )
    return {
        "INTELLIFORCE_TOKEN": token,
        "INTELLIFORCE_API_URL": _INTERNAL_API_URL,
        "INTELLIFORCE_USER_ID": str(user.id),
        "INTELLIFORCE_USER_EMAIL": user.email or "",
    }


def _derive_title(prompt: str) -> str:
    """Primeiros 60 chars do prompt, normalizados. MVP — no futuro pode ser LLM."""
    cleaned = " ".join(prompt.split())  # colapsa whitespace
    if len(cleaned) <= _TITLE_MAX_LEN:
        return cleaned
    return cleaned[:_TITLE_MAX_LEN].rstrip() + "…"


def _extract_text_from_event(event: dict) -> str:
    """Extrai texto streamável de um evento OpenCode.

    O CLI emite ora `{"type": "text", "text": "..."}` (formato consolidado),
    ora `{"type": "text", "part": {"text": "..."}}` (formato de partes).
    Cobrimos ambos pra não perder conteúdo se o formato variar entre versões.
    """
    direct = event.get("text")
    if isinstance(direct, str) and direct:
        return direct
    part = event.get("part")
    if isinstance(part, dict):
        part_text = part.get("text")
        if isinstance(part_text, str):
            return part_text
    return ""


async def _persist_turn(
    db: AsyncSession,
    user: User,
    prompt: str,
    agent: str,
    opencode_session_id: str,
    final_text: str,
) -> None:
    """Cria ou atualiza ChatSession e insere as 2 mensagens (user + agent).

    Idempotência: lookup pelo `opencode_session_id` (UNIQUE). Se já existe e
    pertence ao mesmo user, faz append. Se pertence a outro user, recusa
    silenciosamente (logado como erro) — não vazamos cross-user.
    """
    if not opencode_session_id:
        return

    result = await db.execute(
        select(ChatSession).where(
            ChatSession.opencode_session_id == opencode_session_id
        )
    )
    sess = result.scalar_one_or_none()
    is_new = sess is None

    if is_new:
        sess = ChatSession(
            user_id=user.id,
            opencode_session_id=opencode_session_id,
            agent=agent,
            title=_derive_title(prompt),
            last_message_preview=final_text[:_PREVIEW_MAX_LEN],
            message_count=2,
        )
        db.add(sess)
        await db.flush()  # gera sess.id
        next_seq = 1
    else:
        if sess.user_id != user.id:
            log.error(
                "chat.persist.owner_mismatch",
                opencode_session_id=opencode_session_id,
                expected_user=str(sess.user_id),
                actual_user=str(user.id),
            )
            return
        # Próximo seq baseado no max atual (lida com lacunas, se houver)
        max_res = await db.execute(
            select(func.coalesce(func.max(ChatMessage.sequence_num), 0))
            .where(ChatMessage.chat_session_id == sess.id)
        )
        next_seq = int(max_res.scalar() or 0) + 1
        sess.message_count = (sess.message_count or 0) + 2
        sess.last_message_preview = final_text[:_PREVIEW_MAX_LEN]
        # updated_at sobe automático via TimestampMixin.onupdate na flush

    db.add(
        ChatMessage(
            chat_session_id=sess.id,
            role="user",
            content=prompt,
            sequence_num=next_seq,
        )
    )
    db.add(
        ChatMessage(
            chat_session_id=sess.id,
            role="agent",
            content=final_text,
            sequence_num=next_seq + 1,
        )
    )

    if is_new:
        bus = EventBus(db)
        await bus.emit(
            type="chat_session.created",
            aggregate_id=str(sess.id),
            aggregate_type="chat_session",
            payload={
                "opencode_session_id": opencode_session_id,
                "agent": agent,
            },
            metadata={"actor": str(user.id)},
        )

    await db.commit()


@router.post("", response_model=ChatResponse)
async def chat_send(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Envia mensagem e devolve resposta completa (sync). Continua sessão se session_id."""
    result = await _runner.run(
        prompt=payload.prompt,
        agent=payload.agent,
        session_id=payload.session_id,
        continue_session=bool(payload.session_id),
    )
    # Só persistimos em sucesso com session_id real — falhas não viram histórico.
    if result.success and result.session_id and result.text:
        try:
            await _persist_turn(
                db=db,
                user=user,
                prompt=payload.prompt,
                agent=payload.agent,
                opencode_session_id=result.session_id,
                final_text=result.text,
            )
        except Exception:
            log.exception("chat.persist_failed", endpoint="/chat")
    return ChatResponse(
        success=result.success,
        text=result.text,
        session_id=result.session_id,
        duration_ms=result.duration_ms,
        tokens_input=result.tokens_input,
        tokens_output=result.tokens_output,
        error_message=result.error_message,
    )


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Envia mensagem e devolve eventos OpenCode via SSE (text/event-stream).

    Cada evento NDJSON do CLI vira uma mensagem SSE `data: {...}\\n\\n`. O
    cliente lê via fetch + ReadableStream e despacha eventos pra UI.

    Heartbeat a cada 15s (`: keepalive\\n\\n`) pra evitar timeouts em proxies.

    Auth: passa JWT do user logado como env var INTELLIFORCE_TOKEN pro
    subprocess; scripts das skills usam isso pra chamar a API.

    Persistência: captura session_id + texto assistente durante o stream e
    grava em chat_sessions/chat_messages após `stream_end` bem-sucedido. Se
    o stream falhar ou for cancelado, não grava (evita histórico parcial).
    """
    extra_env = _build_extra_env(user, authorization)

    async def event_iter() -> AsyncIterator[bytes]:
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        # Capturados durante o stream pra persistir depois.
        captured: dict = {
            "session_id": None,
            "text_parts": [],
            "stream_completed": False,
        }

        async def producer() -> None:
            try:
                async for event in _runner.run_stream(
                    prompt=payload.prompt,
                    agent=payload.agent,
                    session_id=payload.session_id,
                    continue_session=bool(payload.session_id),
                    extra_env=extra_env,
                ):
                    # Capturar session_id na primeira ocorrência
                    sid = event.get("sessionID")
                    if sid and not captured["session_id"]:
                        captured["session_id"] = sid
                    # Acumular texto do assistente (ignorando reasoning/thinking)
                    if event.get("type") == "text":
                        txt = _extract_text_from_event(event)
                        if txt:
                            captured["text_parts"].append(txt)
                    await queue.put(event)
                captured["stream_completed"] = True
            finally:
                # Só persiste em sucesso real — se houve erro ou cancelamento,
                # pula. Histórico não deve refletir turnos quebrados.
                if (
                    captured["stream_completed"]
                    and captured["session_id"]
                    and captured["text_parts"]
                ):
                    final_text = "".join(captured["text_parts"])
                    try:
                        await _persist_turn(
                            db=db,
                            user=user,
                            prompt=payload.prompt,
                            agent=payload.agent,
                            opencode_session_id=captured["session_id"],
                            final_text=final_text,
                        )
                    except Exception:
                        log.exception(
                            "chat.persist_failed",
                            endpoint="/chat/stream",
                            opencode_session_id=captured["session_id"],
                        )
                await queue.put(None)  # sentinela de fim

        producer_task = asyncio.create_task(producer())

        try:
            while True:
                try:
                    item = await asyncio.wait_for(
                        queue.get(), timeout=_HEARTBEAT_INTERVAL_SECONDS
                    )
                except TimeoutError:
                    yield b": keepalive\n\n"
                    continue
                if item is None:
                    break
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n".encode("utf-8")
        finally:
            if not producer_task.done():
                producer_task.cancel()
                try:
                    await producer_task
                except (asyncio.CancelledError, Exception):
                    pass

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
