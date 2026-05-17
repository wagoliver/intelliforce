"""CRUD de sessões de chat — listagem, leitura de transcrição, rename, soft-delete.

A criação de uma ChatSession **não acontece aqui** — ela é feita
implicitamente em `chat.py` quando o usuário envia a primeira mensagem
numa conversa nova. Aqui só lemos e mutamos sessões existentes.

Todas as rotas exigem JWT (Depends(get_current_user)) e filtram por
`user.id` — não há cross-user access.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.chat_session import (
    ChatMessageOut,
    ChatSessionOut,
    ChatSessionUpdateRequest,
)
from intelliforce.db.models.chat_session import ChatMessage, ChatSession
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus

router = APIRouter(prefix="/chat/sessions", tags=["chat-sessions"])


async def _get_owned_session(
    session_id: uuid.UUID, user: User, db: AsyncSession
) -> ChatSession:
    """Carrega sessão garantindo que pertence ao user logado.

    Retorna 404 se não existe OU se pertence a outro user — não vazamos
    informação sobre IDs de sessões alheias.
    """
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    sess = result.scalar_one_or_none()
    if sess is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Sessão de chat não encontrada"
        )
    return sess


@router.get("", response_model=list[ChatSessionOut])
async def list_sessions(
    include_archived: bool = False,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSessionOut]:
    """Lista sessões do user, mais recentes primeiro. Default 50, max 200."""
    limit = max(1, min(limit, 200))
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    )
    if not include_archived:
        stmt = stmt.where(ChatSession.archived_at.is_(None))
    result = await db.execute(stmt)
    return [ChatSessionOut.model_validate(s) for s in result.scalars().all()]


@router.get("/{session_id}", response_model=ChatSessionOut)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionOut:
    sess = await _get_owned_session(session_id, user, db)
    return ChatSessionOut.model_validate(sess)


@router.get("/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_session_messages(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageOut]:
    """Retorna transcrição completa em ordem cronológica."""
    await _get_owned_session(session_id, user, db)  # ownership check
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_session_id == session_id)
        .order_by(ChatMessage.sequence_num.asc())
    )
    return [ChatMessageOut.model_validate(m) for m in result.scalars().all()]


@router.patch("/{session_id}", response_model=ChatSessionOut)
async def update_session(
    session_id: uuid.UUID,
    payload: ChatSessionUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionOut:
    sess = await _get_owned_session(session_id, user, db)
    if payload.title is not None:
        sess.title = payload.title
    await db.flush()
    bus = EventBus(db)
    await bus.emit(
        type="chat_session.updated",
        aggregate_id=str(sess.id),
        aggregate_type="chat_session",
        payload={"title": sess.title},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    await db.refresh(sess)
    return ChatSessionOut.model_validate(sess)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Soft delete — seta archived_at. Conteúdo do OpenCode em disco fica intacto."""
    sess = await _get_owned_session(session_id, user, db)
    if sess.archived_at is None:
        sess.archived_at = datetime.now(timezone.utc)
        bus = EventBus(db)
        await bus.emit(
            type="chat_session.archived",
            aggregate_id=str(sess.id),
            aggregate_type="chat_session",
            payload={"opencode_session_id": sess.opencode_session_id},
            metadata={"actor": str(user.id)},
        )
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
