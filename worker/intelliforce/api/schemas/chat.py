"""Schemas do endpoint de chat com OpenCode."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)
    session_id: str | None = Field(default=None, description="Se informado, continua sessão OpenCode existente.")
    agent: str = Field(default="builder", description="Slug do agente OpenCode a invocar.")


class ChatResponse(BaseModel):
    success: bool
    text: str
    session_id: str | None
    duration_ms: int
    tokens_input: int
    tokens_output: int
    error_message: str | None = None
