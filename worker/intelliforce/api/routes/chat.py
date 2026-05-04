"""Endpoints de chat com OpenCode.

- POST /chat        — síncrono, devolve resposta completa (Fase 1)
- POST /chat/stream — SSE, emite cada evento NDJSON do CLI em tempo real (Fase 2)

Auth pass-through: extraímos o JWT do header Authorization e passamos como env
var `INTELLIFORCE_TOKEN` pro subprocess do OpenCode CLI. Scripts Python das
skills (intelliforce-*) usam isso pra chamar a API real do IntelliForce em
nome do user logado, sem precisar de credenciais separadas.
"""
from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse

from intelliforce.api.deps import get_current_user
from intelliforce.api.schemas.chat import ChatRequest, ChatResponse
from intelliforce.db.models.user import User
from intelliforce.opencode.runner import OpenCodeRunner

router = APIRouter(prefix="/chat", tags=["chat"])

# Singleton — runner é stateless, só guarda config
_runner = OpenCodeRunner()

_HEARTBEAT_INTERVAL_SECONDS = 15.0

# URL interna que os scripts das skills usam pra chamar a API IntelliForce.
# Em docker-compose, "api" resolve via DNS interno do bridge network.
# Override via env pra dev local fora do docker.
_INTERNAL_API_URL = os.environ.get("INTELLIFORCE_INTERNAL_API_URL", "http://api:8000")


def _build_extra_env(user: User, authorization: str | None) -> dict[str, str]:
    """Monta env vars que o subprocess do OpenCode receberá.

    Scripts das skills (em opencode/.opencode/skills/intelliforce-*/scripts/*.py)
    leem essas vars pra autenticar e localizar a API.
    """
    token = ""
    if authorization:
        token = authorization.removeprefix("Bearer ").removeprefix("bearer ").strip()
    return {
        "INTELLIFORCE_TOKEN": token,
        "INTELLIFORCE_API_URL": _INTERNAL_API_URL,
        "INTELLIFORCE_USER_ID": str(user.id),
        "INTELLIFORCE_USER_EMAIL": user.email or "",
    }


@router.post("", response_model=ChatResponse)
async def chat_send(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    authorization: str | None = Header(default=None),
) -> ChatResponse:
    """Envia mensagem e devolve resposta completa (sync). Continua sessão se session_id."""
    result = await _runner.run(
        prompt=payload.prompt,
        agent=payload.agent,
        session_id=payload.session_id,
        continue_session=bool(payload.session_id),
    )
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
) -> StreamingResponse:
    """Envia mensagem e devolve eventos OpenCode via SSE (text/event-stream).

    Cada evento NDJSON do CLI vira uma mensagem SSE `data: {...}\\n\\n`. O
    cliente lê via fetch + ReadableStream e despacha eventos pra UI.

    Heartbeat a cada 15s (`: keepalive\\n\\n`) pra evitar timeouts em proxies.

    Auth: passa JWT do user logado como env var INTELLIFORCE_TOKEN pro
    subprocess; scripts das skills usam isso pra chamar a API.
    """
    extra_env = _build_extra_env(user, authorization)

    async def event_iter() -> AsyncIterator[bytes]:
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def producer() -> None:
            try:
                async for event in _runner.run_stream(
                    prompt=payload.prompt,
                    agent=payload.agent,
                    session_id=payload.session_id,
                    continue_session=bool(payload.session_id),
                    extra_env=extra_env,
                ):
                    await queue.put(event)
            finally:
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
