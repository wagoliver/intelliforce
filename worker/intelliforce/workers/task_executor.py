"""TaskExecutor — consome task.created e dispara execução via OpenCode CLI.

Esse é o coração do worker em produção:
  1. Subscribe em events.task
  2. Pra cada task.created, carrega Task + Agent do DB
  3. Marca task como running, emite task.started
  4. Invoca OpenCodeRunner com o prompt e agent
  5. Captura resultado (sucesso/erro), persiste no DB
  6. Emite task.completed (ou task.failed)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.task import Task, TaskStatus
from intelliforce.events.bus import EventBus
from intelliforce.events.subscriber import EventSubscriber
from intelliforce.opencode import OpenCodeRunner
from intelliforce.settings import get_settings

log = structlog.get_logger()


def _build_worker_extra_env() -> dict[str, str]:
    """Monta env vars pra subprocess do OpenCode quando worker dispara task
    scheduled. Injeta token da service account (worker-internal) pras skills
    poderem chamar a API IntelliForce (Vault, departments, etc.).

    Vazio se INTELLIFORCE_WORKER_TOKEN não configurado — skills que tentarem
    falar com API vão falhar com TOKEN_EMPTY. Roda gen_worker_token.py + .env.
    """
    settings = get_settings()
    if not settings.worker_token:
        return {}
    return {
        "INTELLIFORCE_TOKEN": settings.worker_token,
        "INTELLIFORCE_API_URL": settings.intelliforce_internal_api_url,
    }


class TaskExecutor(EventSubscriber):
    """Subscriber que executa tarefas atribuídas a agentes via OpenCode CLI."""

    streams = ["events.task"]
    group_name = "task-executor"

    def __init__(self) -> None:
        super().__init__()
        self.runner = OpenCodeRunner()

    async def handle_event(self, stream: str, event_id: str, data: dict[str, Any]) -> None:
        event_type = data.get("type")
        # Só nos interessa task.created — outros eventos do stream task ignoramos
        if event_type != "task.created":
            return

        task_id_str = data.get("aggregate_id")
        if not task_id_str:
            log.warning("task_executor.no_task_id", event_id=event_id)
            return

        try:
            task_id = uuid.UUID(task_id_str)
        except ValueError:
            log.warning("task_executor.invalid_task_id", task_id=task_id_str)
            return

        log.info("task_executor.processing", task_id=task_id_str, event_id=event_id)

        async with async_session_factory() as session:
            task, agent = await self._load_task_and_agent(session, task_id)
            if not task or not agent:
                return

            if task.status != TaskStatus.PENDING.value:
                log.info(
                    "task_executor.skipping",
                    task_id=task_id_str,
                    current_status=task.status,
                    reason="status_not_pending",
                )
                return

            await self._mark_running(session, task)

        # Executa OpenCode (fora da sessão pra não segurar conexão).
        # Injeta token da service account (worker-internal) pra skills
        # poderem chamar a API IntelliForce internamente — sem isso, qualquer
        # skill que faça HTTP pra Vault/api falha com TOKEN_EMPTY.
        result = await self.runner.run(
            prompt=task.prompt,
            agent=agent.name,
            model=agent.model if agent.model else None,
            session_id=task.opencode_session_id,
            extra_env=_build_worker_extra_env(),
        )

        # Persiste resultado
        async with async_session_factory() as session:
            await self._persist_result(session, task_id, result)

    async def _load_task_and_agent(
        self,
        session: AsyncSession,
        task_id: uuid.UUID,
    ) -> tuple[Task | None, Agent | None]:
        result = await session.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            log.warning("task_executor.task_not_found", task_id=str(task_id))
            return None, None

        agent_result = await session.execute(select(Agent).where(Agent.id == task.agent_id))
        agent = agent_result.scalar_one_or_none()
        if not agent:
            log.warning("task_executor.agent_not_found", agent_id=str(task.agent_id))
            return task, None
        return task, agent

    async def _mark_running(self, session: AsyncSession, task: Task) -> None:
        task.status = TaskStatus.RUNNING.value
        task.started_at = datetime.now(timezone.utc)
        bus = EventBus(session)
        await bus.emit(
            type="task.started",
            aggregate_id=str(task.id),
            aggregate_type="task",
            payload={"started_at": task.started_at.isoformat()},
            metadata={"actor": "task-executor", "correlation_id": task.correlation_id},
        )
        await session.commit()

    async def _persist_result(
        self,
        session: AsyncSession,
        task_id: uuid.UUID,
        result: Any,  # OpenCodeResult
    ) -> None:
        result_obj = await session.execute(select(Task).where(Task.id == task_id))
        task = result_obj.scalar_one_or_none()
        if not task:
            return

        task.finished_at = datetime.now(timezone.utc)
        task.opencode_session_id = result.session_id
        task.tokens_input = result.tokens_input
        task.tokens_output = result.tokens_output
        task.cost_usd = Decimal(str(result.cost_usd or 0))

        bus = EventBus(session)

        if result.success:
            task.status = TaskStatus.COMPLETED.value
            task.result_summary = {
                "text": result.text,
                "session_id": result.session_id,
                "events_count": len(result.events),
                "duration_ms": result.duration_ms,
            }
            await bus.emit(
                type="task.completed",
                aggregate_id=str(task.id),
                aggregate_type="task",
                payload={
                    "duration_ms": result.duration_ms,
                    "tokens_input": result.tokens_input,
                    "tokens_output": result.tokens_output,
                    "cost_usd": str(result.cost_usd),
                    "session_id": result.session_id,
                },
                metadata={"actor": "task-executor", "correlation_id": task.correlation_id},
            )
            log.info(
                "task_executor.completed",
                task_id=str(task_id),
                duration_ms=result.duration_ms,
                tokens=result.tokens_input + result.tokens_output,
            )
        else:
            task.status = TaskStatus.FAILED.value
            task.error_message = result.error_message or "Erro desconhecido"
            await bus.emit(
                type="task.failed",
                aggregate_id=str(task.id),
                aggregate_type="task",
                payload={
                    "error_message": result.error_message,
                    "exit_code": result.exit_code,
                    "duration_ms": result.duration_ms,
                },
                metadata={"actor": "task-executor", "correlation_id": task.correlation_id},
            )
            log.error(
                "task_executor.failed",
                task_id=str(task_id),
                exit_code=result.exit_code,
                error=result.error_message,
            )

        # Emite cli_completed pro audit (granular)
        await bus.emit(
            type="task.cli_completed",
            aggregate_id=str(task.id),
            aggregate_type="task",
            payload={
                "exit_code": result.exit_code,
                "duration_ms": result.duration_ms,
                "tokens_input": result.tokens_input,
                "tokens_output": result.tokens_output,
                "tokens_reasoning": result.tokens_reasoning,
                "cost_usd": str(result.cost_usd),
                "stdout_truncated": result.raw_stdout[:1000] if result.raw_stdout else "",
                "stderr_truncated": result.raw_stderr[:1000] if result.raw_stderr else "",
                "command": result.command,
            },
            metadata={"actor": "task-executor", "correlation_id": task.correlation_id},
        )

        await session.commit()
