"""Schemas de tarefa."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class TaskCreateRequest(BaseModel):
    agent_id: uuid.UUID
    input: dict[str, Any] = Field(default_factory=dict)
    prompt: str = Field(default="", description="Prompt enviado ao agente. Se vazio, derivado do input.")
    correlation_id: str | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    input: dict[str, Any]
    prompt: str
    result_summary: dict[str, Any] | None
    error_message: str | None
    opencode_session_id: str | None
    triggered_by: str
    triggered_by_user_id: uuid.UUID | None
    correlation_id: str
    started_at: datetime | None
    finished_at: datetime | None
    cost_usd: Decimal
    tokens_input: int
    tokens_output: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskCancelRequest(BaseModel):
    reason: str = Field(default="", max_length=500)
