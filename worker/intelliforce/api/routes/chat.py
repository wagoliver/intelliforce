"""Endpoint de chat com OpenCode (síncrono — Fase 1).

Streaming via SSE entra na Fase 2 num endpoint separado /chat/stream.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from intelliforce.api.deps import get_current_user
from intelliforce.api.schemas.chat import ChatRequest, ChatResponse
from intelliforce.db.models.user import User
from intelliforce.opencode.runner import OpenCodeRunner

router = APIRouter(prefix="/chat", tags=["chat"])

# Singleton — runner é stateless, só guarda config
_runner = OpenCodeRunner()


@router.post("", response_model=ChatResponse)
async def chat_send(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
) -> ChatResponse:
    """Envia uma mensagem ao OpenCode e devolve a resposta completa (sync).

    Continua sessão se session_id for informado (--continue do CLI).
    """
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
