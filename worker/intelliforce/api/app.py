"""IntelliForce API — FastAPI application factory."""
from __future__ import annotations

import logging

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from intelliforce.api.routes import (
    agents, approvals, audit, auth, chat, departments, health,
    instances, metrics, opencode, people, search, secrets, tasks,
)
from intelliforce.settings import get_settings


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


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    log = structlog.get_logger()

    app = FastAPI(
        title="IntelliForce API",
        version="0.1.0",
        description="Plataforma de gestão de força de trabalho digital — IntelliForce.",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rotas
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(agents.router)
    app.include_router(tasks.router)
    app.include_router(approvals.router)
    app.include_router(audit.router)
    app.include_router(chat.router)
    app.include_router(departments.router)
    app.include_router(instances.router)
    app.include_router(metrics.router)
    app.include_router(opencode.router)
    app.include_router(people.router)
    app.include_router(search.router)
    app.include_router(secrets.router)

    @app.on_event("startup")
    async def _on_startup() -> None:
        log.info(
            "api.starting",
            allowed_origins=settings.allowed_origins_list,
            environment=settings.app_env,
        )

    @app.on_event("shutdown")
    async def _on_shutdown() -> None:
        log.info("api.stopping")

    return app


app = create_app()
