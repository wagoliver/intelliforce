"""Schemas do Report Center."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReportCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, description="Conteúdo em Markdown")
    summary: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list)
    department_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    title: str
    summary: str | None
    tags: list[str]
    source: str
    department_id: uuid.UUID | None
    agent_id: uuid.UUID | None
    size_bytes: int
    created_at: datetime


class ReportDetailOut(ReportOut):
    content: str
