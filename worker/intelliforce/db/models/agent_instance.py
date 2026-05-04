"""Model: AgentInstance — cópia executável de uma Agent (definição)."""
import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AgentInstanceStatus(StrEnum):
    """Status operacional de uma instância."""

    IDLE = "idle"          # disponível, sem tarefa atual
    ACTIVE = "active"      # executando tarefa agora
    OFFLINE = "offline"    # desligada manualmente
    ERROR = "error"        # quebrada — precisa intervenção


class AgentInstance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Instância executável de um Agent (definição) vinculada a uma Activity."""

    __tablename__ = "agent_instances"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=AgentInstanceStatus.IDLE.value, index=True,
    )
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    current_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<AgentInstance {self.id} agent={self.agent_id} status={self.status}>"
