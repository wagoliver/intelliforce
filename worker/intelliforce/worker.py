"""IntelliForce Worker — orquestrador principal.

Roda em paralelo:
  - OutboxPublisher: lê events table, publica em Redis Streams
  - DebugSubscriber: loga eventos (debug)
  - TaskExecutor: consome task.created, dispara OpenCode
  - CronScheduler: agenda execução de agents com schedule definido
"""
import asyncio
import logging
import signal
import sys
from contextlib import suppress

import structlog

from intelliforce.audit import AuditProjector
from intelliforce.bootstrap import ensure_worker_service_user
from intelliforce.db.base import async_session_factory
from intelliforce.events import EventBus, OutboxPublisher
from intelliforce.events.subscriber import DebugSubscriber
from intelliforce.scheduler import CronScheduler, TaskReaper
from intelliforce.settings import get_settings
from intelliforce.workers import TaskExecutor


def setup_logging() -> None:
    settings = get_settings()
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(format="%(message)s", level=log_level)
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        cache_logger_on_first_use=True,
    )


# -----------------------------------------------------------------------------
# Validações
# -----------------------------------------------------------------------------
async def validate_postgres() -> bool:
    log = structlog.get_logger()
    try:
        from sqlalchemy import text
        async with async_session_factory() as session:
            result = await session.execute(text("SELECT count(*) FROM events"))
            count = result.scalar()
            log.info("postgres.connected", events_count=count)
        return True
    except Exception as e:
        log.error("postgres.error", error=str(e))
        return False


def validate_clickhouse() -> bool:
    log = structlog.get_logger()
    try:
        from intelliforce.clickhouse.client import get_client
        client = get_client()
        try:
            result = client.command("SELECT count(*) FROM intelliforce_audit.audit_events")
            log.info("clickhouse.connected", audit_events_count=result)
            return True
        finally:
            client.close()
    except Exception as e:
        log.error("clickhouse.error", error=str(e))
        return False


async def validate_redis() -> bool:
    log = structlog.get_logger()
    try:
        import redis.asyncio as redis_async
        client = redis_async.from_url(get_settings().redis_url)
        await client.ping()
        log.info("redis.connected")
        await client.aclose()
        return True
    except Exception as e:
        log.error("redis.error", error=str(e))
        return False


async def emit_startup_event() -> None:
    log = structlog.get_logger()
    try:
        async with async_session_factory() as session:
            bus = EventBus(session)
            await bus.emit(
                type="system.worker_started",
                aggregate_id="worker-main",
                aggregate_type="system",
                payload={"version": "0.1.0", "sprint": "5"},
                metadata={"actor": "worker"},
            )
            await session.commit()
        log.info("worker.startup_event_emitted")
    except Exception:
        log.exception("worker.startup_event_failed")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
async def main() -> None:
    settings = get_settings()
    log = structlog.get_logger()

    log.info(
        "worker.starting",
        version="0.1.0",
        sprint="5",
        environment=settings.app_env,
    )
    log.info(
        "worker.config",
        opencode_path=settings.opencode_config_path,
        lmstudio_url=settings.lmstudio_base_url,
        lmstudio_model=settings.lmstudio_default_model,
        postgres_host=settings.postgres_host,
        clickhouse_host=settings.clickhouse_host,
        redis_host=settings.redis_host,
    )

    pg_ok = await validate_postgres()
    ch_ok = validate_clickhouse()
    rd_ok = await validate_redis()
    log.info(
        "worker.ready" if (pg_ok and ch_ok and rd_ok) else "worker.degraded",
        postgres=pg_ok,
        clickhouse=ch_ok,
        redis=rd_ok,
    )

    # Bootstrap idempotente da service account (worker-internal). Sem isso,
    # scheduled tasks não conseguem autenticar contra a própria API.
    if pg_ok:
        try:
            await ensure_worker_service_user()
        except Exception:
            log.exception("worker.service_user_bootstrap_failed")

    # Aviso se não há token configurado pro worker — scheduled tasks vão
    # falhar ao tentar chamar a API. Não bloqueia startup pra não quebrar
    # setup inicial do desenvolvedor.
    if not settings.worker_token:
        log.warning(
            "worker.token_missing",
            hint=(
                "INTELLIFORCE_WORKER_TOKEN não setado. Scheduled tasks que "
                "chamarem a API (Vault, departments, etc.) vão falhar com "
                "TOKEN_EMPTY. Gere via: docker compose exec worker python "
                "-m intelliforce.scripts.gen_worker_token"
            ),
        )

    await emit_startup_event()

    # Componentes paralelos
    publisher = OutboxPublisher(batch_size=100, poll_interval_seconds=settings.worker_poll_interval_seconds)
    debug_subscriber = DebugSubscriber()
    task_executor = TaskExecutor()
    audit_projector = AuditProjector()
    scheduler = CronScheduler(sync_interval_seconds=30)
    task_reaper = TaskReaper()

    tasks: list[asyncio.Task] = [
        asyncio.create_task(publisher.run_forever(), name="outbox-publisher"),
        asyncio.create_task(debug_subscriber.run_forever(), name="debug-subscriber"),
        asyncio.create_task(task_executor.run_forever(), name="task-executor"),
        asyncio.create_task(audit_projector.run_forever(), name="audit-projector"),
        asyncio.create_task(scheduler.start(), name="cron-scheduler"),
        asyncio.create_task(task_reaper.run_forever(), name="task-reaper"),
        asyncio.create_task(_heartbeat_loop(), name="heartbeat"),
    ]

    # Shutdown gracioso
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _signal_handler(sig: signal.Signals) -> None:
        log.info("worker.signal_received", signal=sig.name)
        stop_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        with suppress(NotImplementedError):
            loop.add_signal_handler(sig, _signal_handler, sig)

    log.info("worker.tasks_started", count=len(tasks))
    await stop_event.wait()

    log.info("worker.shutdown_initiated")
    await publisher.stop()
    await debug_subscriber.stop()
    await task_executor.stop()
    await audit_projector.stop()
    await scheduler.stop()
    await task_reaper.stop()
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    log.info("worker.shutdown_complete")


async def _heartbeat_loop() -> None:
    """Escreve worker:last_heartbeat no Redis a cada 10s.

    Lido por /diagnostics/status pra detectar worker travado/morto. Intervalo
    curto (10s) pra que o card de saúde detecte queda rápido — janelas em
    diagnostics.py: ok < 30s, warn < 90s, err >= 90s.
    """
    from datetime import datetime, timezone

    import redis.asyncio as redis_async

    log = structlog.get_logger()
    settings = get_settings()
    client = redis_async.from_url(settings.redis_url)
    try:
        while True:
            try:
                now_iso = datetime.now(timezone.utc).isoformat()
                # TTL 60s — se o worker morrer, a key expira sozinha e o checker
                # passa a ver None (status=unknown) em vez de timestamp velho.
                await client.set("worker:last_heartbeat", now_iso, ex=60)
                log.debug("worker.heartbeat", at=now_iso)
            except Exception:
                log.exception("worker.heartbeat_failed")
            await asyncio.sleep(10)
    finally:
        with suppress(Exception):
            await client.aclose()


if __name__ == "__main__":
    setup_logging()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
