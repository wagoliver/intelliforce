"""Model: SecretAccessLog — append-only log de acesso a secrets.

Persistido no Postgres pra rastreabilidade. Eventos paralelos vão pro
event bus (ClickHouse audit) via emit normal — esta tabela é a fonte de
verdade pra UI mostrar audit trail.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import UUIDPrimaryKeyMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SecretAccessLog(Base, UUIDPrimaryKeyMixin):
    """Append-only — sem PATCH, sem DELETE.

    Mantém snapshot de `secret_slug` pra preservar rastreabilidade mesmo
    quando o secret é deletado (FK fica null mas slug fica registrado).
    """

    __tablename__ = "secret_access_log"

    # FK pode ser null (secret deletado depois), mas slug fica como snapshot
    secret_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("secrets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    secret_slug: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
    )

    # Quem fez o acesso (uma das três formas, mutuamente complementares)
    accessed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    accessed_by_skill: Mapped[str | None] = mapped_column(
        String(128), nullable=True,
    )
    accessed_by_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Tipo de ação: 'create' | 'read' | 'delete'
    action: Mapped[str] = mapped_column(String(16), nullable=False, index=True)

    accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True,
    )

    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<SecretAccessLog action={self.action} secret={self.secret_slug} "
            f"at={self.accessed_at.isoformat() if self.accessed_at else 'unknown'}>"
        )
