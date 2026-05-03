"""Schemas Pydantic de AgentInstance."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AgentInstanceOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    activity_id: uuid.UUID | None
    status: str
    last_heartbeat: datetime | None
    current_task_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScaleRequest(BaseModel):
    target_count: int = Field(ge=0, le=10000)
    agent_id: uuid.UUID | None = Field(
        default=None,
        description="Definição (Agent) a usar pras novas instâncias. Se omitido, usa o default_agent_id da activity.",
    )


class ScaleResult(BaseModel):
    activity_id: uuid.UUID
    target_count: int
    created: int
    removed: int
    total: int
    status_breakdown: dict[str, int]
