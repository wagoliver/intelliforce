"""IntelliForce Worker — entrypoint principal.

Sprint 1: schemas Postgres e ClickHouse aplicados, conexões validadas.
Sprints futuras: consumir Redis Streams, invocar OpenCode CLI, persistir resultados.
"""
import asyncio
import logging
import sys

import structlog

from intelliforce.settings import get_settings


def setup_logging() -> None:
    """Configura logging estruturado JSON."""
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


async def validate_postgres() -> bool:
    """Valida conexão Postgres + migrations aplicadas."""
    log = structlog.get_logger()
    try:
        from sqlalchemy import text

        from intelliforce.db.base import async_session_factory

        async with async_session_factory() as session:
            result = await session.execute(text("SELECT count(*) FROM events"))
            count = result.scalar()
            log.info("postgres.connected", events_count=count)
        return True
    except Exception as e:
        log.error("postgres.error", error=str(e))
        return False


def validate_clickhouse() -> bool:
    """Valida conexão ClickHouse + schema aplicado."""
    log = structlog.get_logger()
    try:
        from intelliforce.clickhouse.client import get_client

        client = get_client()
        try:
            result = client.command(
                "SELECT count(*) FROM intelliforce_audit.audit_events"
            )
            log.info("clickhouse.connected", audit_events_count=result)
            return True
        finally:
            client.close()
    except Exception as e:
        log.error("clickhouse.error", error=str(e))
        return False


async def validate_redis() -> bool:
    """Valida conexão Redis."""
    log = structlog.get_logger()
    try:
        import redis.asyncio as redis_async

        from intelliforce.settings import get_settings

        client = redis_async.from_url(get_settings().redis_url)
        await client.ping()
        log.info("redis.connected")
        await client.aclose()
        return True
    except Exception as e:
        log.error("redis.error", error=str(e))
        return False


async def main() -> None:
    """Loop principal do worker (Sprint 1: valida conexões e mantém vivo)."""
    settings = get_settings()
    log = structlog.get_logger()

    log.info(
        "worker.starting",
        version="0.1.0",
        sprint="1",
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

    # Valida conexões
    pg_ok = await validate_postgres()
    ch_ok = validate_clickhouse()
    rd_ok = await validate_redis()

    log.info(
        "worker.ready" if (pg_ok and ch_ok and rd_ok) else "worker.degraded",
        postgres=pg_ok,
        clickhouse=ch_ok,
        redis=rd_ok,
    )

    # Heartbeat loop (Sprint 3 substitui pelo consumer real do Redis Streams)
    while True:
        await asyncio.sleep(60)
        log.info(
            "worker.heartbeat",
            message="Aguardando implementação Sprint 3 (consumer Redis Streams).",
        )


if __name__ == "__main__":
    setup_logging()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
