"""OutboxPublisher — lê tabela `events` e publica em Redis Streams.

Implementa o padrão Transactional Outbox:
  1. App escreve evento em events (na mesma transação do estado)
  2. Publisher polla events WHERE published_at IS NULL
  3. Para cada evento: publica em Redis Streams + marca published_at
  4. Subscribers consomem do Redis Streams via consumer groups
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import redis.asyncio as redis_async
import structlog
from sqlalchemy import select, update
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.event import Event
from intelliforce.settings import get_settings

log = structlog.get_logger()


class OutboxPublisher:
    """Loop assíncrono que publica eventos pendentes em Redis Streams."""

    def __init__(
        self,
        batch_size: int = 100,
        poll_interval_seconds: float = 1.0,
        max_stream_length: int = 100_000,
    ) -> None:
        self.batch_size = batch_size
        self.poll_interval = poll_interval_seconds
        self.max_stream_length = max_stream_length
        self._redis: redis_async.Redis | None = None
        self._running = False

    async def _ensure_redis(self) -> redis_async.Redis:
        if self._redis is None:
            settings = get_settings()
            self._redis = redis_async.from_url(settings.redis_url, decode_responses=False)
        return self._redis

    @staticmethod
    def _stream_for(aggregate_type: str) -> str:
        """Nome do stream baseado no aggregate_type. Ex: 'task' → 'events.task'."""
        return f"events.{aggregate_type}"

    async def _publish_event(self, redis: redis_async.Redis, event: Event) -> None:
        """Publica um evento no Redis Stream apropriado."""
        stream = self._stream_for(event.aggregate_type)
        # Serializa tudo como JSON pra simplicidade no consumer
        fields = {
            "id": event.id,
            "type": event.type,
            "aggregate_id": event.aggregate_id,
            "aggregate_type": event.aggregate_type,
            "payload": json.dumps(event.payload, default=str),
            "metadata": json.dumps(event.event_metadata, default=str),
            "occurred_at": event.occurred_at.isoformat(),
        }
        await redis.xadd(
            stream,
            fields,
            id="*",
            maxlen=self.max_stream_length,
            approximate=True,
        )

    async def _process_batch(self) -> int:
        """Pega lote de eventos pendentes, publica e marca. Retorna quantidade processada."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(Event)
                .where(Event.published_at.is_(None))
                .order_by(Event.id)
                .limit(self.batch_size)
                .with_for_update(skip_locked=True)  # permite múltiplos publishers em paralelo
            )
            events = list(result.scalars().all())

            if not events:
                return 0

            redis = await self._ensure_redis()
            now = datetime.now(timezone.utc)
            published_ids: list[str] = []

            for event in events:
                try:
                    await self._publish_event(redis, event)
                    published_ids.append(event.id)
                except Exception as e:
                    log.error(
                        "outbox.publish_failed",
                        event_id=event.id,
                        type=event.type,
                        error=str(e),
                    )
                    # Não marca como publicado — vai retentar no próximo poll

            if published_ids:
                await session.execute(
                    update(Event)
                    .where(Event.id.in_(published_ids))
                    .values(published_at=now)
                )
                await session.commit()
                log.info(
                    "outbox.batch_published",
                    count=len(published_ids),
                    pending=len(events) - len(published_ids),
                )

            return len(published_ids)

    async def run_forever(self) -> None:
        """Loop principal. Roda até ser cancelado."""
        log.info(
            "outbox.starting",
            batch_size=self.batch_size,
            poll_interval=self.poll_interval,
        )
        self._running = True
        while self._running:
            try:
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(3),
                    wait=wait_exponential(multiplier=1, min=1, max=10),
                    retry=retry_if_exception_type(Exception),
                    reraise=True,
                ):
                    with attempt:
                        published = await self._process_batch()
                if published == 0:
                    await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                log.info("outbox.cancelled")
                raise
            except Exception:
                log.exception("outbox.iteration_failed")
                await asyncio.sleep(self.poll_interval * 5)  # backoff em erro

        log.info("outbox.stopped")

    async def stop(self) -> None:
        self._running = False
        if self._redis:
            await self._redis.aclose()
            self._redis = None
