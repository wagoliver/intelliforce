"""Retenção do Report Center — apaga relatórios antigos (job diário)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import delete, select

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.report import Report
from intelliforce.events.bus import EventBus
from intelliforce.settings import get_settings

log = structlog.get_logger()


async def prune_old_reports() -> int:
    """Apaga relatórios mais antigos que reports_retention_days. Retorna a contagem.

    Hard delete (auditoria fica no evento reports.pruned). 0/negativo = sem retenção.
    """
    settings = get_settings()
    days = settings.reports_retention_days
    if days <= 0:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    async with async_session_factory() as session:
        ids = (
            await session.execute(select(Report.id).where(Report.created_at < cutoff))
        ).scalars().all()
        if not ids:
            return 0

        await session.execute(delete(Report).where(Report.created_at < cutoff))
        bus = EventBus(session)
        await bus.emit(
            type="reports.pruned",
            aggregate_id="reports",
            aggregate_type="report",
            payload={
                "deleted": len(ids),
                "retention_days": days,
                "cutoff": cutoff.isoformat(),
            },
            metadata={"actor": "retention-job"},
        )
        await session.commit()
        log.info("reports.pruned", deleted=len(ids), retention_days=days)
        return len(ids)
