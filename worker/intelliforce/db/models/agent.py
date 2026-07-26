"""Model: Agent — funcionário virtual configurado."""
import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Agent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Funcionário virtual — referencia um agent .md no opencode/agent/."""

    __tablename__ = "agents"

    # Identidade
    name: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )  # slug kebab-case (ex: "analista-cobranca-pj")
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Configuração que aponta pro opencode/
    opencode_agent_file: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # ex: "agent/analista-cobranca-pj.md"
    model: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # ex: "lmstudio/qwen3.6-27b-mtp"

    # Skills permitidos (lista de slugs)
    skills: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    # Políticas (limites de gasto, horários, aprovações)
    policies: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    # Schedule cron (opcional — se setado, scheduler dispara automaticamente)
    schedule: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Ownership
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    manager_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Vínculo organizacional (opcional — agente pode existir sem squad/activity)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True
    )

    def __repr__(self) -> str:
        return f"<Agent {self.name} (active={self.is_active})>"
