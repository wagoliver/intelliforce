"""Schemas Pydantic do Vault — secrets + audit log."""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class SecretCreateRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=64, description="kebab-case único")
    description: str = Field(default="", max_length=500)
    value: str = Field(min_length=1, max_length=8192, description="Texto plain — será criptografado")
    tags: list[str] = Field(default_factory=list)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not SLUG_RE.match(v):
            raise ValueError("slug deve ser kebab-case (a-z, 0-9, hífens)")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        # Aceita até 10 tags, cada uma com até 32 chars, kebab-case
        if len(v) > 10:
            raise ValueError("máximo de 10 tags por secret")
        for tag in v:
            if not isinstance(tag, str) or len(tag) > 32:
                raise ValueError("cada tag deve ser string até 32 chars")
        return v


class SecretOut(BaseModel):
    """Resposta de listagem/criação — NUNCA inclui o valor descriptografado."""
    id: uuid.UUID
    slug: str
    description: str
    tags: list[str]
    created_by_user_id: uuid.UUID
    created_at: datetime
    last_accessed_at: datetime | None

    model_config = {"from_attributes": True}


class SecretValueOut(BaseModel):
    """Único endpoint que devolve plaintext. Cada hit gera audit log."""
    slug: str
    value: str


class SecretAccessLogOut(BaseModel):
    id: uuid.UUID
    secret_id: uuid.UUID | None
    secret_slug: str
    accessed_by_user_id: uuid.UUID | None
    accessed_by_skill: str | None
    accessed_by_task_id: uuid.UUID | None
    action: str
    accessed_at: datetime
    ip_address: str | None

    model_config = {"from_attributes": True}
