"""Schemas de aprovação humana."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ApprovalDecisionRequest(BaseModel):
    reason: str = Field(default="", max_length=1000)


class ApprovalOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    requested_reason: str
    decision: str
    decision_reason: str | None
    responded_by_user_id: uuid.UUID | None
    responded_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
