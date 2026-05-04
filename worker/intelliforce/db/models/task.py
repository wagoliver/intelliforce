"""Model: Task — execução de um agente sobre uma entrada."""
import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskTriggerType(StrEnum):
    API = "api"
    SCHEDULER = "scheduler"
    HUMAN = "human"
    AGENT = "agent"
    WEBHOOK = "webhook"


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tarefa atômica atribuída a um agente."""

    __tablename__ = "tasks"

    # Vínculo com agente (skill/definição)
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Vínculo com activity (cargo) — populado quando a task vem de uma activity específica
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    # Estado
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=TaskStatus.PENDING.value, index=True
    )

    # Entrada e saída
    input: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # OpenCode session pra retomada
    opencode_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Trigger
    triggered_by: Mapped[str] = mapped_column(
        String(32), nullable=False, default=TaskTriggerType.API.value
    )
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Correlação (amarra eventos relacionados)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Métricas
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 6), nullable=False, default=Decimal("0")
    )
    tokens_input: Mapped[int] = mapped_column(default=0, nullable=False)
    tokens_output: Mapped[int] = mapped_column(default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<Task {self.id} agent={self.agent_id} status={self.status}>"
