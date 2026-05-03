"""EventSubscriber — classe base pra consumir eventos do Redis Streams.

Implementa:
  - Consumer groups (vários workers consomem em paralelo, sem duplicar processamento)
  - Acknowledge explícito (XACK) só após processar com sucesso
  - Retry com backoff em erro
  - Auto-criação do consumer group
"""
from __future__ import annotations

import asyncio
import json
import socket
from abc import ABC, abstractmethod
from typing import Any

import redis.asyncio as redis_async
import structlog
from redis.exceptions import ResponseError

from intelliforce.settings import get_settings

log = structlog.get_logger()


class EventSubscriber(ABC):
    """Base pra subscribers de eventos.

    Subclasses implementam:
      - streams (lista de streams a consumir, ex: ["events.task"])
      - group_name (nome do consumer group)
      - handle_event(event_data) (lógica de processamento)
    """

    streams: list[str] = []
    group_name: str = "default-consumer"
    consumer_name: str | None = None  # default: hostname
    block_ms: int = 5000  # tempo de bloqueio do XREADGROUP
    max_retries: int = 3

    def __init__(self) -> None:
        self._redis: redis_async.Redis | None = None
        self._running = False
        if not self.consumer_name:
            self.consumer_name = socket.gethostname()

    async def _ensure_redis(self) -> redis_async.Redis:
        if self._redis is None:
            settings = get_settings()
            self._redis = redis_async.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    async def _ensure_groups(self, redis: redis_async.Redis) -> None:
        """Cria o consumer group em cada stream (idempotente)."""
        for stream in self.streams:
            try:
                await redis.xgroup_create(stream, self.group_name, id="0", mkstream=True)
                log.info("subscriber.group_created", stream=stream, group=self.group_name)
            except ResponseError as e:
                if "BUSYGROUP" not in str(e):
                    raise
                # Group already exists — ok

    @abstractmethod
    async def handle_event(self, stream: str, event_id: str, data: dict[str, Any]) -> None:
        """Processa um evento. Deve lançar exceção em caso de falha (vai retentar)."""

    async def _process_message(
        self,
        redis: redis_async.Redis,
        stream: str,
        message_id: str,
        fields: dict[str, str],
    ) -> bool:
        """Processa uma mensagem com retry. Retorna True se sucesso (XACK), False senão."""
        # Deserializa payload e metadata
        data = dict(fields)
        if "payload" in data:
            try:
                data["payload"] = json.loads(data["payload"])
            except json.JSONDecodeError:
                pass
        if "metadata" in data:
            try:
                data["metadata"] = json.loads(data["metadata"])
            except json.JSONDecodeError:
                pass

        for attempt in range(1, self.max_retries + 1):
            try:
                await self.handle_event(stream, message_id, data)
                await redis.xack(stream, self.group_name, message_id)
                return True
            except Exception as e:
                log.warning(
                    "subscriber.handler_failed",
                    stream=stream,
                    message_id=message_id,
                    event_type=data.get("type"),
                    attempt=attempt,
                    error=str(e),
                )
                if attempt >= self.max_retries:
                    log.error(
                        "subscriber.handler_exhausted",
                        stream=stream,
                        message_id=message_id,
                        event_type=data.get("type"),
                    )
                    # Não dá XACK — mensagem fica pendente, pode ser reprocessada por outro consumer
                    return False
                await asyncio.sleep(2**attempt)  # backoff exponencial
        return False

    async def run_forever(self) -> None:
        """Loop principal: lê do Redis Streams e processa cada evento."""
        if not self.streams:
            raise ValueError(f"{type(self).__name__}: 'streams' não pode ser vazio")

        redis = await self._ensure_redis()
        await self._ensure_groups(redis)

        log.info(
            "subscriber.starting",
            streams=self.streams,
            group=self.group_name,
            consumer=self.consumer_name,
        )
        self._running = True

        # Lê mensagens novas (>) — mensagens já entregues mas não-acked seriam lidas com '0'
        stream_dict = {s: ">" for s in self.streams}

        while self._running:
            try:
                response = await redis.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams=stream_dict,
                    count=10,
                    block=self.block_ms,
                )
                if not response:
                    continue

                for stream, messages in response:
                    for message_id, fields in messages:
                        await self._process_message(redis, stream, message_id, fields)
            except asyncio.CancelledError:
                log.info("subscriber.cancelled", group=self.group_name)
                raise
            except Exception:
                log.exception("subscriber.iteration_failed", group=self.group_name)
                await asyncio.sleep(2)

        log.info("subscriber.stopped", group=self.group_name)

    async def stop(self) -> None:
        self._running = False
        if self._redis:
            await self._redis.aclose()
            self._redis = None


# -----------------------------------------------------------------------------
# Subscriber de exemplo / debug — só loga eventos que recebe
# -----------------------------------------------------------------------------
class DebugSubscriber(EventSubscriber):
    """Consome todos os streams principais e loga (útil pra debug em dev)."""

    streams = ["events.task", "events.agent", "events.human", "events.user", "events.system"]
    group_name = "debug-logger"

    async def handle_event(self, stream: str, event_id: str, data: dict[str, Any]) -> None:
        log.info(
            "debug.event_received",
            stream=stream,
            message_id=event_id,
            event_id=data.get("id"),
            event_type=data.get("type"),
            aggregate_id=data.get("aggregate_id"),
        )
