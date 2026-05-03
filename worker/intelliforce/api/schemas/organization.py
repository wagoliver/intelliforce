"""Schemas Pydantic da estrutura organizacional."""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


# -----------------------------------------------------------------------------
# Activity
# -----------------------------------------------------------------------------
class ActivityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=255)
    skill_code: str = Field(default="", max_length=8)
    target_agent_count: int = Field(default=1, ge=0, le=10000)
    position: int = Field(default=0)


class ActivityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    skill_code: str | None = Field(default=None, max_length=8)
    target_agent_count: int | None = Field(default=None, ge=0, le=10000)
    position: int | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    squad_id: uuid.UUID
    name: str
    display_name: str
    skill_code: str
    target_agent_count: int
    position: int
    agent_count: int = 0  # populado via query agregada
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# Squad
# -----------------------------------------------------------------------------
class SquadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=255)
    position: int = Field(default=0)


class SquadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    position: int | None = None


class SquadOut(BaseModel):
    id: uuid.UUID
    department_id: uuid.UUID
    name: str
    display_name: str
    position: int
    activities: list[ActivityOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# Department
# -----------------------------------------------------------------------------
class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64, description="Slug kebab-case")
    display_name: str = Field(min_length=1, max_length=255)
    objective: str = Field(default="", max_length=4000)
    owner_user_id: uuid.UUID | None = None
    monthly_cost_budget_usd: Decimal = Field(default=Decimal("0"))
    health: str = Field(default="healthy")

    @field_validator("name")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not SLUG_RE.match(v):
            raise ValueError("name deve ser kebab-case (a-z, 0-9, hifens)")
        return v


class DepartmentUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    objective: str | None = Field(default=None, max_length=4000)
    owner_user_id: uuid.UUID | None = None
    monthly_cost_budget_usd: Decimal | None = None
    health: str | None = None


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    objective: str
    owner_user_id: uuid.UUID | None
    monthly_cost_budget_usd: Decimal
    health: str
    squads: list[SquadOut] = []
    total_agents: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# People (subset de users pra Department setup)
# -----------------------------------------------------------------------------
class PersonOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str

    model_config = {"from_attributes": True}
