"""Endpoints agregados de métricas operacionais por departamento.

Pra MVP, agrega do Postgres (tasks). Quando ClickHouse estiver populado com
audit verboso, podemos migrar essas queries pra lá.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.db.models.user import User

router = APIRouter(prefix="/metrics", tags=["metrics"])


class TimelineBucket(BaseModel):
    completed: int = 0
    failed: int = 0


class DepartmentMetricsOut(BaseModel):
    department_id: uuid.UUID
    registered_today: int
    executed_last_12h: int
    failed_last_12h: int
    avg_handle_seconds: float | None
    error_pct: float
    timeline: list[TimelineBucket]
    monthly_cost_usd: Decimal


class RecentExecution(BaseModel):
    task_id: uuid.UUID
    status: str
    finished_at: datetime | None


class TaskHistoryItem(BaseModel):
    task_id: uuid.UUID
    activity_id: uuid.UUID | None
    activity_name: str | None
    status: str
    triggered_by: str
    started_at: datetime | None
    finished_at: datetime | None
    duration_seconds: float | None
    cost_usd: Decimal
    tokens_input: int
    tokens_output: int
    error_message: str | None
    created_at: datetime


@router.get("/department/{department_id}", response_model=DepartmentMetricsOut)
async def department_metrics(
    department_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DepartmentMetricsOut:
    """Agrega métricas operacionais do department a partir de tasks.

    Une tasks → agents → activities → squads → departments via FK.
    """
    # Confirma que dept existe
    exists = await db.execute(
        text("SELECT 1 FROM departments WHERE id = :id"),
        {"id": str(department_id)},
    )
    if not exists.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department não encontrado")

    # Query agregada
    # JOIN tasks → activities (via task.activity_id direto) → squads → departments
    base_join = """
        FROM tasks t
        JOIN activities a ON a.id = t.activity_id
        JOIN squads s ON s.id = a.squad_id
        WHERE s.department_id = :dept_id
    """

    summary_q = f"""
        SELECT
          COUNT(*) FILTER (WHERE t.created_at >= date_trunc('day', now())) AS registered_today,
          COUNT(*) FILTER (WHERE t.status = 'completed' AND t.finished_at > now() - INTERVAL '12 hours') AS executed_12h,
          COUNT(*) FILTER (WHERE t.status = 'failed' AND t.finished_at > now() - INTERVAL '12 hours') AS failed_12h,
          AVG(EXTRACT(EPOCH FROM (t.finished_at - t.started_at)))
            FILTER (WHERE t.status = 'completed' AND t.finished_at IS NOT NULL AND t.started_at IS NOT NULL) AS avg_handle_s,
          COUNT(*) FILTER (WHERE t.status = 'failed' AND t.created_at > now() - INTERVAL '24 hours') AS failed_24h,
          COUNT(*) FILTER (WHERE t.created_at > now() - INTERVAL '24 hours') AS total_24h,
          COALESCE(SUM(t.cost_usd) FILTER (WHERE t.created_at >= date_trunc('month', now())), 0) AS monthly_cost
        {base_join}
    """
    summary_res = await db.execute(text(summary_q), {"dept_id": str(department_id)})
    row = summary_res.one()
    registered_today = row.registered_today or 0
    executed_12h = row.executed_12h or 0
    failed_12h = row.failed_12h or 0
    avg_handle_s = float(row.avg_handle_s) if row.avg_handle_s is not None else None
    failed_24h = row.failed_24h or 0
    total_24h = row.total_24h or 0
    error_pct = (failed_24h / total_24h * 100.0) if total_24h > 0 else 0.0
    monthly_cost = Decimal(str(row.monthly_cost or 0))

    # Timeline: 12 buckets de 1h (do agora pra trás), separando completed/failed
    timeline_q = f"""
        SELECT
          date_trunc('hour', COALESCE(t.finished_at, t.created_at)) AS bucket,
          t.status,
          COUNT(*) AS cnt
        {base_join}
          AND t.status IN ('completed', 'failed')
          AND COALESCE(t.finished_at, t.created_at) > now() - INTERVAL '12 hours'
        GROUP BY bucket, t.status
        ORDER BY bucket
    """
    tl_res = await db.execute(text(timeline_q), {"dept_id": str(department_id)})
    by_bucket: dict[datetime, dict[str, int]] = {}
    for r in tl_res.all():
        by_bucket.setdefault(r.bucket, {})[r.status] = r.cnt

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    timeline: list[TimelineBucket] = []
    for i in range(11, -1, -1):
        bucket = now - timedelta(hours=i)
        d = by_bucket.get(bucket) or by_bucket.get(bucket.replace(tzinfo=None)) or {}
        timeline.append(TimelineBucket(completed=d.get("completed", 0), failed=d.get("failed", 0)))

    return DepartmentMetricsOut(
        department_id=department_id,
        registered_today=registered_today,
        executed_last_12h=executed_12h,
        failed_last_12h=failed_12h,
        avg_handle_seconds=avg_handle_s,
        error_pct=round(error_pct, 1),
        timeline=timeline,
        monthly_cost_usd=monthly_cost,
    )


@router.get("/activity/{activity_id}/recent", response_model=list[RecentExecution])
async def activity_recent(
    activity_id: uuid.UUID,
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RecentExecution]:
    """Últimas N execuções de uma activity (mais recentes primeiro). Usado pros mini-dots no card."""
    sql = """
        SELECT id AS task_id, status, finished_at
        FROM tasks
        WHERE activity_id = :aid
        ORDER BY created_at DESC
        LIMIT :lim
    """
    res = await db.execute(text(sql), {"aid": str(activity_id), "lim": limit})
    return [
        RecentExecution(task_id=r.task_id, status=r.status, finished_at=r.finished_at)
        for r in res.all()
    ]


@router.get("/department/{department_id}/history", response_model=list[TaskHistoryItem])
async def department_history(
    department_id: uuid.UUID,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TaskHistoryItem]:
    """Últimas N tasks executadas pelo department, mais recentes primeiro."""
    sql = """
        SELECT
          t.id AS task_id,
          t.activity_id,
          a.display_name AS activity_name,
          t.status,
          t.triggered_by,
          t.started_at,
          t.finished_at,
          EXTRACT(EPOCH FROM (t.finished_at - t.started_at)) AS duration_seconds,
          t.cost_usd,
          t.tokens_input,
          t.tokens_output,
          t.error_message,
          t.created_at
        FROM tasks t
        JOIN activities a ON a.id = t.activity_id
        JOIN squads s ON s.id = a.squad_id
        WHERE s.department_id = :dept_id
        ORDER BY t.created_at DESC
        LIMIT :lim
    """
    res = await db.execute(text(sql), {"dept_id": str(department_id), "lim": limit})
    return [
        TaskHistoryItem(
            task_id=r.task_id,
            activity_id=r.activity_id,
            activity_name=r.activity_name,
            status=r.status,
            triggered_by=r.triggered_by,
            started_at=r.started_at,
            finished_at=r.finished_at,
            duration_seconds=float(r.duration_seconds) if r.duration_seconds is not None else None,
            cost_usd=Decimal(str(r.cost_usd or 0)),
            tokens_input=r.tokens_input or 0,
            tokens_output=r.tokens_output or 0,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in res.all()
    ]
