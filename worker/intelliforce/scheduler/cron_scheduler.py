"""CronScheduler — APScheduler que lê agents com `schedule` definido e cria tasks.

Estratégia:
  - Lê todos os agents ativos com schedule no banco a cada N segundos
  - Sincroniza com o APScheduler (adiciona novos, remove os deletados)
  - Quando o cron dispara, cria uma Task pendente (mesmo fluxo do POST /tasks)
"""
from __future__ import annotations

import asyncio
from typing import Any

import structlog
import ulid
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.task import Task, TaskStatus, TaskTriggerType
from intelliforce.events.bus import EventBus

log = structlog.get_logger()


class CronScheduler:
    """Sincroniza periodicamente o APScheduler com a config dos agents no banco."""

    def __init__(self, sync_interval_seconds: int = 30) -> None:
        self.sync_interval = sync_interval_seconds
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self._running = False

    async def start(self) -> None:
        self.scheduler.start()
        self._running = True
        log.info("scheduler.started", sync_interval=self.sync_interval)
        await self._sync_loop()

    async def stop(self) -> None:
        self._running = False
        self.scheduler.shutdown(wait=False)
        log.info("scheduler.stopped")

    async def _sync_loop(self) -> None:
        while self._running:
            try:
                await self._sync_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("scheduler.sync_failed")
            await asyncio.sleep(self.sync_interval)

    async def _sync_once(self) -> None:
        """Lê agents ativos com schedule e atualiza o APScheduler."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(Agent).where(Agent.is_active.is_(True), Agent.schedule.isnot(None))
            )
            agents = list(result.scalars().all())

        desired_jobs = {f"agent-{a.id}": a for a in agents}
        current_jobs = {j.id for j in self.scheduler.get_jobs()}

        # Remove jobs de agents que não existem mais ou foram desativados
        for job_id in current_jobs - desired_jobs.keys():
            if job_id.startswith("agent-"):
                self.scheduler.remove_job(job_id)
                log.info("scheduler.job_removed", job_id=job_id)

        # Adiciona/atualiza
        for job_id, agent in desired_jobs.items():
            try:
                trigger = CronTrigger.from_crontab(agent.schedule)  # type: ignore[arg-type]
            except Exception as e:
                log.error(
                    "scheduler.invalid_cron",
                    agent_id=str(agent.id),
                    schedule=agent.schedule,
                    error=str(e),
                )
                continue

            self.scheduler.add_job(
                self._dispatch_task,
                trigger=trigger,
                args=[str(agent.id), agent.name],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=30,
            )

    async def _dispatch_task(self, agent_id: str, agent_name: str) -> None:
        """Callback do APScheduler — cria uma Task pendente do agent."""
        log.info("scheduler.dispatch", agent_id=agent_id, agent_name=agent_name)
        try:
            async with async_session_factory() as session:
                # Re-lê o agent pra garantir estado atual
                result = await session.execute(select(Agent).where(Agent.id == agent_id))
                agent = result.scalar_one_or_none()
                if not agent or not agent.is_active:
                    log.info("scheduler.agent_inactive_skip", agent_id=agent_id)
                    return

                correlation_id = str(ulid.new())
                task = Task(
                    agent_id=agent.id,
                    status=TaskStatus.PENDING.value,
                    input={"trigger": "scheduled"},
                    prompt=f"Execução agendada do agente {agent.name}.",
                    triggered_by=TaskTriggerType.SCHEDULER.value,
                    triggered_by_user_id=None,
                    correlation_id=correlation_id,
                )
                session.add(task)
                await session.flush()

                bus = EventBus(session)
                await bus.emit(
                    type="task.created",
                    aggregate_id=str(task.id),
                    aggregate_type="task",
                    payload={
                        "agent_id": str(agent.id),
                        "agent_name": agent.name,
                        "input": task.input,
                        "prompt": task.prompt,
                        "triggered_by": TaskTriggerType.SCHEDULER.value,
                    },
                    metadata={"actor": "scheduler", "correlation_id": correlation_id},
                )
                await session.commit()
                log.info("scheduler.task_created", agent=agent_name, task_id=str(task.id))
        except Exception:
            log.exception("scheduler.dispatch_failed", agent_id=agent_id)
