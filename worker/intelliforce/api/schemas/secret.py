"""Schemas Pydantic do Vault — secrets multi-field + audit log."""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# Field keys: kebab/snake_case, mais permissivo que slug (aceita _ e .)
FIELD_KEY_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_-]*$")


class SecretField(BaseModel):
    """Um par key→value dentro de um secret."""
    key: str = Field(min_length=1, max_length=64)
    value: str = Field(min_length=1, max_length=8192)

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not FIELD_KEY_RE.match(v):
            raise ValueError(
                "key deve começar com letra/underscore e conter apenas "
                "[a-zA-Z0-9_-]"
            )
        return v


class SecretCreateRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=64, description="kebab-case único")
    description: str = Field(default="", max_length=500)
    fields: list[SecretField] = Field(min_length=1, max_length=32)
    tags: list[str] = Field(default_factory=list)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not SLUG_RE.match(v):
            raise ValueError("slug deve ser kebab-case (a-z, 0-9, hífens)")
        return v

    @field_validator("fields")
    @classmethod
    def validate_fields_unique(cls, v: list[SecretField]) -> list[SecretField]:
        seen: set[str] = set()
        for f in v:
            if f.key in seen:
                raise ValueError(f"key '{f.key}' duplicada — use nomes únicos")
            seen.add(f.key)
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        if len(v) > 10:
            raise ValueError("máximo de 10 tags por secret")
        for tag in v:
            if not isinstance(tag, str) or len(tag) > 32:
                raise ValueError("cada tag deve ser string até 32 chars")
        return v


class SecretOut(BaseModel):
    """Listagem/criação — NUNCA inclui valores. Mostra estrutura (field_keys)."""
    id: uuid.UUID
    slug: str
    description: str
    field_keys: list[str]    # nomes dos campos (cleartext); valores ficam encriptados
    tags: list[str]
    created_by_user_id: uuid.UUID
    created_at: datetime
    last_accessed_at: datetime | None

    model_config = {"from_attributes": True}


class SecretValueOut(BaseModel):
    """Resposta quando lê 1 campo específico (`?field=X`).

    Usado por skills que sabem qual campo querem ("preciso do client_id").
    Audit log grava `field_accessed` = X.
    """
    slug: str
    field: str
    value: str


class SecretAllValuesOut(BaseModel):
    """Resposta quando lê todos os campos (sem `?field`).

    Usado pela UI no reveal modal e por skills que querem tudo num JSON
    (ex.: passar pra biblioteca cliente que aceita dict).
    Audit log grava `field_accessed` = NULL (= todos).
    """
    slug: str
    fields: dict[str, str]


class SecretAccessLogOut(BaseModel):
    id: uuid.UUID
    secret_id: uuid.UUID | None
    secret_slug: str
    accessed_by_user_id: uuid.UUID | None
    accessed_by_skill: str | None
    accessed_by_task_id: uuid.UUID | None
    action: str
    field_accessed: str | None
    accessed_at: datetime
    ip_address: str | None

    model_config = {"from_attributes": True}
