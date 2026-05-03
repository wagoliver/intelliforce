"""Endpoints de health/readiness pra orquestradores."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness — só checa que o processo está respondendo."""
    return {"status": "ok"}


@router.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Readiness — confirma que dependências (DB) estão acessíveis."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
