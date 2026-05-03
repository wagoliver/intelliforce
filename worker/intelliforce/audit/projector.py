"""AuditProjector — consome todos os eventos e materializa em ClickHouse.

Tabelas alimentadas:
  - audit_events: TODOS os eventos (cópia integral, com payload e metadata)
  - llm_calls: extraído de task.cli_completed (tokens, custo, latência)
  - cli_invocations: idem, com stdout/stderr completos
  - skill_invocations: extraído de agent.skill_invoked + agent.skill_completed
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import structlog
import ulid

from intelliforce.clickhouse.client import get_client
from intelliforce.events.subscriber import EventSubscriber

log = structlog.get_logger()


def _ts(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.utcnow()
    return datetime.utcnow()


class AuditProjector(EventSubscriber):
    """Subscriber que materializa eventos em ClickHouse pra queries analíticas."""

    streams = ["events.task", "events.agent", "events.human", "events.user", "events.system"]
    group_name = "audit-projector"

    def __init__(self) -> None:
        super().__init__()
        self._ch = get_client()

    async def stop(self) -> None:
        await super().stop()
        try:
            self._ch.close()
        except Exception:
            pass

    async def handle_event(self, stream: str, event_id: str, data: dict[str, Any]) -> None:
        # Insere em audit_events sempre
        await self._insert_audit_event(data)

        # Roteamento por tipo pra tabelas especializadas
        event_type = data.get("type", "")
        if event_type == "task.cli_completed":
            await self._insert_llm_call_and_cli(data)
        elif event_type == "agent.skill_invoked":
            await self._insert_skill_invocation(data)

    # -------------------------------------------------------------------------
    # Inserts
    # -------------------------------------------------------------------------
    async def _insert_audit_event(self, data: dict[str, Any]) -> None:
        payload = data.get("payload") or {}
        metadata = data.get("metadata") or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                payload = {}
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except json.JSONDecodeError:
                metadata = {}

        row = {
            "event_id": data.get("id", ""),
            "event_type": data.get("type", ""),
            "aggregate_id": data.get("aggregate_id", ""),
            "aggregate_type": data.get("aggregate_type", ""),
            "payload": json.dumps(payload, default=str),
            "metadata": json.dumps(metadata, default=str),
            "actor": str(metadata.get("actor", "")),
            "correlation_id": str(metadata.get("correlation_id", "")),
            "causation_id": metadata.get("causation_id"),
            "occurred_at": _ts(data.get("occurred_at")),
        }
        try:
            self._ch.insert(
                "intelliforce_audit.audit_events",
                [list(row.values())],
                column_names=list(row.keys()),
            )
        except Exception as e:
            log.error("audit.insert_failed", table="audit_events", error=str(e))
            raise

    async def _insert_llm_call_and_cli(self, data: dict[str, Any]) -> None:
        payload = data.get("payload") or {}
        metadata = data.get("metadata") or {}
        if isinstance(payload, str):
            payload = json.loads(payload) if payload else {}
        if isinstance(metadata, str):
            metadata = json.loads(metadata) if metadata else {}

        task_id = data.get("aggregate_id", "")
        correlation_id = str(metadata.get("correlation_id", ""))
        occurred_at = _ts(data.get("occurred_at"))

        # cli_invocations
        cli_row = {
            "invocation_id": str(ulid.new()),
            "task_id": task_id,
            "agent_name": "",  # vamos enriquecer depois (joins com tasks)
            "command": json.dumps(payload.get("command", []), default=str),
            "stdout": payload.get("stdout_truncated", "") or "",
            "stderr": payload.get("stderr_truncated", "") or "",
            "exit_code": int(payload.get("exit_code", 0)),
            "duration_ms": int(payload.get("duration_ms", 0)),
            "started_at": occurred_at,
            "finished_at": occurred_at,
            "correlation_id": correlation_id,
        }
        try:
            self._ch.insert(
                "intelliforce_audit.cli_invocations",
                [list(cli_row.values())],
                column_names=list(cli_row.keys()),
            )
        except Exception as e:
            log.error("audit.insert_failed", table="cli_invocations", error=str(e))

        # llm_calls
        llm_row = {
            "call_id": str(ulid.new()),
            "task_id": task_id,
            "agent_name": "",
            "model": "",  # idem
            "provider": "lmstudio",
            "input_tokens": int(payload.get("tokens_input", 0)),
            "output_tokens": int(payload.get("tokens_output", 0)),
            "reasoning_tokens": int(payload.get("tokens_reasoning", 0)),
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
            "cost_usd": float(payload.get("cost_usd", 0) or 0),
            "latency_ms": int(payload.get("duration_ms", 0)),
            "success": 1 if int(payload.get("exit_code", 0)) == 0 else 0,
            "error_message": "",
            "started_at": occurred_at,
            "finished_at": occurred_at,
            "correlation_id": correlation_id,
        }
        try:
            self._ch.insert(
                "intelliforce_audit.llm_calls",
                [list(llm_row.values())],
                column_names=list(llm_row.keys()),
            )
        except Exception as e:
            log.error("audit.insert_failed", table="llm_calls", error=str(e))

    async def _insert_skill_invocation(self, data: dict[str, Any]) -> None:
        payload = data.get("payload") or {}
        metadata = data.get("metadata") or {}
        if isinstance(payload, str):
            payload = json.loads(payload) if payload else {}
        if isinstance(metadata, str):
            metadata = json.loads(metadata) if metadata else {}

        row = {
            "invocation_id": str(ulid.new()),
            "task_id": str(payload.get("task_id", "")),
            "agent_name": str(payload.get("agent_name", "")),
            "skill_name": str(payload.get("skill_name", "")),
            "arguments": json.dumps(payload.get("arguments", {}), default=str),
            "result": json.dumps(payload.get("result", {}), default=str),
            "success": int(payload.get("success", 1)),
            "duration_ms": int(payload.get("duration_ms", 0)),
            "started_at": _ts(data.get("occurred_at")),
            "correlation_id": str(metadata.get("correlation_id", "")),
        }
        try:
            self._ch.insert(
                "intelliforce_audit.skill_invocations",
                [list(row.values())],
                column_names=list(row.keys()),
            )
        except Exception as e:
            log.error("audit.insert_failed", table="skill_invocations", error=str(e))
