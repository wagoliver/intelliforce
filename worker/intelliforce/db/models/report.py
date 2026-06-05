"""Model: Report — saída de uma atividade de agente (documento Markdown entregue).

O Report Center é o canal nativo de entrega quando não há integração externa
(email/WhatsApp). O agente gera o conteúdo em Markdown; o PDF é renderizado
on-demand a partir dele.
"""
import uuid
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ReportSource(StrEnum):
    AGENT = "agent"
    USER = "user"


class Report(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Relatório (Markdown) salvo no Report Center."""

    __tablename__ = "reports"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ReportSource.AGENT.value
    )

    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Report {self.id} title={self.title!r}>"
