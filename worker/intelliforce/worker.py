"""IntelliForce Worker — entrypoint principal.

Sprint 0: placeholder que apenas valida a stack está rodando.
Sprints futuras: consumir Redis Streams, invocar OpenCode CLI, persistir resultados.
"""
import asyncio
import os
import sys
import time

import structlog


def setup_logging() -> None:
    """Configura logging estruturado JSON."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(structlog.stdlib.logging, log_level, 20)
        ),
        cache_logger_on_first_use=True,
    )


async def main() -> None:
    """Loop principal do worker (placeholder)."""
    log = structlog.get_logger()
    log.info(
        "worker.starting",
        version="0.1.0",
        sprint="0",
        message="Worker subiu. Sprint 0 ainda não implementa consumo de fila — apenas mantém o processo vivo pra validar a stack.",
    )

    log.info(
        "worker.config",
        opencode_path=os.environ.get("OPENCODE_CONFIG_PATH"),
        lmstudio_url=os.environ.get("LMSTUDIO_BASE_URL"),
        redis_url=os.environ.get("REDIS_URL"),
        postgres_host=os.environ.get("POSTGRES_HOST"),
    )

    # Loop infinito mantendo o processo vivo (substituído na Sprint 3 pelo consumer real)
    while True:
        await asyncio.sleep(60)
        log.info("worker.heartbeat", message="Worker vivo, aguardando implementação de Sprint 3.")


if __name__ == "__main__":
    setup_logging()
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
