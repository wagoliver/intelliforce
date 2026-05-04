"""Model: Event — tabela append-only que é a source of truth do event-driven core.

Toda mudança de estado relevante gera um evento aqui. O outbox publisher lê
desta tabela e publica em Redis Streams pros consumers reagirem.
"""
from datetime import datetime
from typing import Any

import ulid
from sqlalchemy import DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base


def _generate_ulid() -> str:
    """ULID = identificador ordenável por tempo, mais útil que UUID pra event log."""
    return str(ulid.new())


class Event(Base):
    """Evento imutável. NUNCA atualizar (exceto published_at). NUNCA deletar."""

    __tablename__ = "events"

    # ULID é ordenável por tempo — facilita queries cronológicas
    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=_generate_ulid)

    # Tipo do evento (ex: "task.created", "agent.skill_invoked")
    type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    # A qual entidade se refere
    aggregate_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    aggregate_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Dados do evento (sempre JSONB pra flexibilidade)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    # Metadados (actor, correlation_id, causation_id)
    event_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )

    # Quando aconteceu
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Quando o outbox publisher mandou pro Redis Streams (NULL = ainda não publicado)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    __table_args__ = (
        # Índice composto pra acelerar query do outbox: WHERE published_at IS NULL ORDER BY id
        Index("ix_events_published_pending", "published_at", "id"),
        # Índice pra reconstruir timeline de uma entidade
        Index("ix_events_aggregate_timeline", "aggregate_type", "aggregate_id", "occurred_at"),
    )

    def __repr__(self) -> str:
        return f"<Event {self.id} type={self.type} aggregate={self.aggregate_type}/{self.aggregate_id}>"
