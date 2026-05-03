"""Endpoints de chat com OpenCode.

- POST /chat        — síncrono, devolve resposta completa (Fase 1)
- POST /chat/stream — SSE, emite cada evento NDJSON do CLI em tempo real (Fase 2)
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from intelliforce.api.deps import get_current_user
from intelliforce.api.schemas.chat import ChatRequest, ChatResponse
from intelliforce.db.models.user import User
from intelliforce.opencode.runner import OpenCodeRunner

router = APIRouter(prefix="/chat", tags=["chat"])

# Singleton — runner é stateless, só guarda config
_runner = OpenCodeRunner()

_HEARTBEAT_INTERVAL_SECONDS = 15.0


@router.post("", response_model=ChatResponse)
async def chat_send(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
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
) -> StreamingResponse:
    """Envia mensagem e devolve eventos OpenCode via SSE (text/event-stream).

    Cada evento NDJSON do CLI vira uma mensagem SSE `data: {...}\\n\\n`. O
    cliente lê via fetch + ReadableStream e despacha eventos pra UI.

    Heartbeat a cada 15s (`: keepalive\\n\\n`) pra evitar timeouts em proxies.
    """

    async def event_iter() -> AsyncIterator[bytes]:
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def producer() -> None:
            try:
                async for event in _runner.run_stream(
                    prompt=payload.prompt,
                    agent=payload.agent,
                    session_id=payload.session_id,
                    continue_session=bool(payload.session_id),
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
