"""Model: Approval — pedido de aprovação humana pra uma tarefa pausada."""
import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ApprovalDecision(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Approval(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Pedido de aprovação humana — uma tarefa pode ter vários ao longo da vida."""

    __tablename__ = "approvals"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Pedido
    requested_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Decisão
    decision: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ApprovalDecision.PENDING.value, index=True
    )
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Approval {self.id} task={self.task_id} decision={self.decision}>"
