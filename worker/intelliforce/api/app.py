"""IntelliForce API — FastAPI application factory."""
from __future__ import annotations

import logging

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from intelliforce.api.routes import (
    agents, approvals, audit, auth, chat, chat_sessions, departments, diagnostics,
    health, instances, metrics, opencode, people, search, secrets, tasks,
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

    # Exception handlers — converte erros de DB em respostas amigáveis em vez
    # de 500 cego do FastAPI.
    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        """Captura IntegrityError do SQLAlchemy (FK violation, unique constraint, etc.)
        e converte em respostas semanticamente corretas — 409 pra conflitos.

        Evita que endpoint que não trata FK violation crash com 500 anônimo.
        Defesa em profundidade pra padrão soft-delete em entidades referenciadas.
        """
        # Tenta classificar pela mensagem do driver (asyncpg)
        orig_str = str(exc.orig) if exc.orig else str(exc)
        log.warning(
            "api.integrity_error",
            path=request.url.path,
            method=request.method,
            error_class=type(exc.orig).__name__ if exc.orig else "IntegrityError",
            preview=orig_str[:300],
        )

        if "ForeignKeyViolation" in orig_str or "foreign key constraint" in orig_str.lower():
            return JSONResponse(
                status_code=409,
                content={
                    "detail": (
                        "Não é possível excluir: existem registros referenciando este item. "
                        "Use a desativação (soft delete) ou remova as dependências primeiro."
                    ),
                    "kind": "foreign_key_violation",
                },
            )

        if "UniqueViolation" in orig_str or "duplicate key" in orig_str.lower():
            return JSONResponse(
                status_code=409,
                content={
                    "detail": "Já existe um registro com esse identificador único.",
                    "kind": "unique_violation",
                },
            )

        if "NotNullViolation" in orig_str or "null value" in orig_str.lower():
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "Campo obrigatório ausente.",
                    "kind": "not_null_violation",
                },
            )

        # Outros casos de IntegrityError não classificados — 409 genérico
        return JSONResponse(
            status_code=409,
            content={
                "detail": "Conflito de integridade no banco de dados.",
                "kind": "integrity_error",
            },
        )

    # Rotas
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(agents.router)
    app.include_router(tasks.router)
    app.include_router(approvals.router)
    app.include_router(audit.router)
    app.include_router(chat.router)
    app.include_router(chat_sessions.router)
    app.include_router(departments.router)
    app.include_router(diagnostics.router)
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
