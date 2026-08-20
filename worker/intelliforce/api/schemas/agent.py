"""Schemas de agente."""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from intelliforce.settings import get_settings

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class AgentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64, description="Slug kebab-case (ex: 'analista-cobranca-pj')")
    display_name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    opencode_agent_file: str = Field(description="Caminho do .md dentro de opencode/.opencode/agents/")
    model: str | None = Field(
        default=None,
        deprecated=True,
        description="DEPRECADO e ignorado — o modelo vem de LMSTUDIO_DEFAULT_MODEL no .env.",
    )
    skills: list[str] = Field(default_factory=list)
    policies: dict[str, Any] = Field(default_factory=dict)
    schedule: str | None = Field(default=None, description="Cron expression (5 ou 6 campos)")
    is_active: bool = True
    manager_user_id: uuid.UUID | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not SLUG_RE.match(v):
            raise ValueError("name deve ser kebab-case (a-z, 0-9, hifens)")
        return v


class AgentUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    opencode_agent_file: str | None = None
    model: str | None = Field(
        default=None,
        deprecated=True,
        description="DEPRECADO e ignorado — o modelo vem de LMSTUDIO_DEFAULT_MODEL no .env.",
    )
    skills: list[str] | None = None
    policies: dict[str, Any] | None = None
    schedule: str | None = None
    is_active: bool | None = None
    manager_user_id: uuid.UUID | None = None


class AgentOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    description: str
    opencode_agent_file: str
    # Nullable na entrada (coluna deprecada, sempre NULL no banco), mas o
    # validator abaixo sempre preenche — na prática nunca sai null.
    model: str | None = None
    skills: list[str]
    policies: dict[str, Any]
    schedule: str | None
    is_active: bool
    owner_user_id: uuid.UUID
    manager_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def resolve_effective_model(self) -> "AgentOut":
        """Reporta sempre o modelo que a execução vai de fato usar.

        A coluna `agents.model` é deprecada e fica NULL desde a migration
        0013 — quem manda é LMSTUDIO_DEFAULT_MODEL no .env. Resolver aqui
        garante que API, UI e skills leiam a verdade, em vez de um valor
        histórico gravado na criação do agente.
        """
        self.model = f"lmstudio/{get_settings().lmstudio_default_model}"
        return self
