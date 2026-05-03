"""EventBus — helper pra emitir eventos persistindo na tabela `events`.

Usado dentro de transações Postgres, garantindo que o evento só existe se a
mudança de estado correspondente também foi commitada (transactional outbox).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.db.models.event import Event

log = structlog.get_logger()


class EventBus:
    """Emissor de eventos. Cria registros na tabela `events`.

    Uso típico (dentro de uma transação):

        async with async_session_factory() as session:
            # ... muda estado ...
            session.add(some_entity)
            bus = EventBus(session)
            await bus.emit(type="task.created", aggregate_id=..., ...)
            await session.commit()  # estado e evento persistem juntos
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def emit(
        self,
        *,
        type: str,
        aggregate_id: str,
        aggregate_type: str,
        payload: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        occurred_at: datetime | None = None,
    ) -> Event:
        """Cria um Event no banco. Não chama commit — chame fora desta função."""
        event = Event(
            type=type,
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            payload=payload or {},
            event_metadata=metadata or {},
            occurred_at=occurred_at or datetime.now(timezone.utc),
            published_at=None,
        )
        self.session.add(event)
        await self.session.flush()  # garante que id é gerado
        log.info(
            "event.emitted",
            event_id=event.id,
            type=event.type,
            aggregate_type=event.aggregate_type,
            aggregate_id=event.aggregate_id,
        )
        return event
