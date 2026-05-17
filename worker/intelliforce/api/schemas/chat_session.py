"""Schemas Pydantic pros endpoints de chat_sessions."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatSessionOut(BaseModel):
    """Resposta de GET /chat/sessions e /chat/sessions/{id}."""

    id: uuid.UUID
    opencode_session_id: str
    agent: str
    title: str | None
    last_message_preview: str | None
    message_count: int
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    """Resposta de GET /chat/sessions/{id}/messages."""

    id: uuid.UUID
    role: str  # 'user' | 'agent'
    content: str
    sequence_num: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionUpdateRequest(BaseModel):
    """Payload de PATCH /chat/sessions/{id}. Por enquanto só permite rename."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
