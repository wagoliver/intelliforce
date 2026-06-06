"""CronScheduler — APScheduler que lê Activities com schedule e cria tasks.

Modelo conceitual:
  - Activity (cargo) tem `schedule` (cron) + `default_agent_id` (skill)
  - Quando o cron dispara, criamos uma Task pra cada AgentInstance idle dessa activity
    (ou só 1, se quisermos dispatch sob demanda — definimos por enquanto: 1 task)
  - Worker/TaskExecutor consome
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
from intelliforce.db.models.activity import Activity
from intelliforce.db.models.task import Task, TaskStatus, TaskTriggerType
from intelliforce.events.bus import EventBus
from intelliforce.services.report_retention import prune_old_reports

log = structlog.get_logger()


class CronScheduler:
    """Sincroniza periodicamente o APScheduler com schedules das Activities."""

    def __init__(self, sync_interval_seconds: int = 30) -> None:
        self.sync_interval = sync_interval_seconds
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self._running = False

    async def start(self) -> None:
        self.scheduler.start()
        self._running = True
        # Job diário de retenção do Report Center (03:00 UTC).
        self.scheduler.add_job(
            prune_old_reports,
            CronTrigger(hour=3, minute=0),
            id="reports-retention",
            replace_existing=True,
        )
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
        async with async_session_factory() as session:
            result = await session.execute(
                select(Activity).where(
                    Activity.schedule.isnot(None),
                    Activity.default_agent_id.isnot(None),
                )
            )
            activities = list(result.scalars().all())

        desired_jobs = {f"activity-{a.id}": a for a in activities}
        current_jobs = {j.id for j in self.scheduler.get_jobs()}

        # Remove jobs órfãos
        for job_id in current_jobs - desired_jobs.keys():
            if job_id.startswith("activity-") or job_id.startswith("agent-"):
                self.scheduler.remove_job(job_id)
                log.info("scheduler.job_removed", job_id=job_id)

        # Adiciona/atualiza
        for job_id, activity in desired_jobs.items():
            try:
                trigger = CronTrigger.from_crontab(activity.schedule)  # type: ignore[arg-type]
            except Exception as e:
                log.error(
                    "scheduler.invalid_cron",
                    activity_id=str(activity.id),
                    schedule=activity.schedule,
                    error=str(e),
                )
                continue

            self.scheduler.add_job(
                self._dispatch_task,
                trigger=trigger,
                args=[str(activity.id), str(activity.default_agent_id), activity.name],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=30,
            )

    async def _dispatch_task(self, activity_id: str, agent_id: str, activity_name: str) -> None:
        log.info("scheduler.dispatch", activity=activity_name, activity_id=activity_id)
        try:
            async with async_session_factory() as session:
                act_res = await session.execute(select(Activity).where(Activity.id == activity_id))
                activity = act_res.scalar_one_or_none()
                if not activity or not activity.default_agent_id:
                    log.info("scheduler.activity_invalid_skip", activity_id=activity_id)
                    return

                correlation_id = str(ulid.new())
                task = Task(
                    agent_id=activity.default_agent_id,
                    activity_id=activity.id,
                    status=TaskStatus.PENDING.value,
                    input={"trigger": "scheduled", "activity_id": str(activity.id)},
                    prompt=f"Execução agendada da activity {activity.name}.",
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
                        "agent_id": str(activity.default_agent_id),
                        "activity_id": str(activity.id),
                        "activity_name": activity.name,
                        "input": task.input,
                        "prompt": task.prompt,
                        "triggered_by": TaskTriggerType.SCHEDULER.value,
                    },
                    metadata={"actor": "scheduler", "correlation_id": correlation_id},
                )
                await session.commit()
                log.info("scheduler.task_created", activity=activity_name, task_id=str(task.id))
        except Exception:
            log.exception("scheduler.dispatch_failed", activity_id=activity_id)
