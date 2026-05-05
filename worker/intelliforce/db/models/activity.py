"""Model: Activity — papel/role dentro de um squad (ex: Invoice validator)."""
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Activity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Activity — papel/role onde Agents (definições) e suas instâncias se encaixam."""

    __tablename__ = "activities"

    squad_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("squads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    skill_code: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    target_agent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Definição-padrão usada pelo scale pra criar N instâncias dessa activity
    default_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Schedule (cron expression) — quando essa activity é executada automaticamente.
    # Activity é o lugar certo (não Agent), porque Activity é o "cargo" com sua jornada,
    # e Agent é o "conhecimento" que pode ser reaproveitado em activities diferentes.
    schedule: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Soft delete
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<Activity {self.name} squad={self.squad_id} active={self.is_active}>"
