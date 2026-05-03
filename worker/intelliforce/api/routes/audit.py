"""Endpoints de query de audit (consultam ClickHouse)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from intelliforce.api.deps import get_current_user
from intelliforce.clickhouse.client import get_client
from intelliforce.db.models.user import User

router = APIRouter(prefix="/audit", tags=["audit"])


def _rows_to_dicts(result: Any) -> list[dict]:
    """Converte ClickHouse query result em lista de dicts."""
    if not result.result_rows:
        return []
    cols = result.column_names
    return [dict(zip(cols, row, strict=True)) for row in result.result_rows]


@router.get("/events")
async def list_events(
    aggregate_id: str | None = Query(default=None),
    aggregate_type: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    correlation_id: str | None = Query(default=None),
    since: datetime | None = Query(default=None, description="ISO 8601, ex: 2026-05-01T00:00:00"),
    limit: int = Query(default=100, le=1000),
    user: User = Depends(get_current_user),
) -> list[dict]:
    where = []
    params: dict[str, Any] = {}

    if aggregate_id:
        where.append("aggregate_id = {agg_id:String}")
        params["agg_id"] = aggregate_id
    if aggregate_type:
        where.append("aggregate_type = {agg_type:String}")
        params["agg_type"] = aggregate_type
    if event_type:
        where.append("event_type = {evt_type:String}")
        params["evt_type"] = event_type
    if correlation_id:
        where.append("correlation_id = {corr:String}")
        params["corr"] = correlation_id
    if since:
        where.append("occurred_at >= {since:DateTime64(3, 'UTC')}")
        params["since"] = since

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    sql = f"""
        SELECT event_id, event_type, aggregate_type, aggregate_id, actor,
               correlation_id, occurred_at, payload
        FROM intelliforce_audit.audit_events
        {where_sql}
        ORDER BY occurred_at DESC
        LIMIT {{lim:UInt32}}
    """
    params["lim"] = limit

    client = get_client()
    try:
        result = client.query(sql, parameters=params)
        return _rows_to_dicts(result)
    finally:
        client.close()


@router.get("/tasks/{task_id}/timeline")
async def task_timeline(task_id: str, user: User = Depends(get_current_user)) -> list[dict]:
    """Timeline cronológica de todos os eventos de uma tarefa."""
    sql = """
        SELECT event_id, event_type, actor, occurred_at, payload, metadata
        FROM intelliforce_audit.audit_events
        WHERE aggregate_id = {tid:String} AND aggregate_type = 'task'
        ORDER BY occurred_at ASC
    """
    client = get_client()
    try:
        result = client.query(sql, parameters={"tid": task_id})
        return _rows_to_dicts(result)
    finally:
        client.close()


@router.get("/llm-calls")
async def list_llm_calls(
    since: datetime | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
    user: User = Depends(get_current_user),
) -> list[dict]:
    where = ""
    params: dict[str, Any] = {"lim": limit}
    if since:
        where = "WHERE started_at >= {since:DateTime64(3, 'UTC')}"
        params["since"] = since

    sql = f"""
        SELECT call_id, task_id, model, provider,
               input_tokens, output_tokens, reasoning_tokens,
               cost_usd, latency_ms, success, started_at
        FROM intelliforce_audit.llm_calls
        {where}
        ORDER BY started_at DESC
        LIMIT {{lim:UInt32}}
    """
    client = get_client()
    try:
        result = client.query(sql, parameters=params)
        return _rows_to_dicts(result)
    finally:
        client.close()


@router.get("/cost-summary")
async def cost_summary(
    days: int = Query(default=7, ge=1, le=365),
    user: User = Depends(get_current_user),
) -> dict:
    """Resumo de custo + tokens nos últimos N dias."""
    sql = """
        SELECT
            count() AS total_calls,
            sum(input_tokens) AS total_input_tokens,
            sum(output_tokens) AS total_output_tokens,
            sum(reasoning_tokens) AS total_reasoning_tokens,
            sum(cost_usd) AS total_cost_usd,
            avg(latency_ms) AS avg_latency_ms,
            sum(success) AS successful_calls
        FROM intelliforce_audit.llm_calls
        WHERE started_at >= now() - INTERVAL {days:UInt32} DAY
    """
    client = get_client()
    try:
        result = client.query(sql, parameters={"days": days})
        rows = _rows_to_dicts(result)
        summary = rows[0] if rows else {}
        summary["period_days"] = days
        return summary
    finally:
        client.close()
