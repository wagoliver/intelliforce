"""TaskReaper — varre tasks presas em `running` e marca como `failed`.

Cenário: o TaskExecutor pega uma task, escreve `status=running`, e por algum
motivo o worker morre/trava antes de gravar o resultado. Sem ninguém pra
limpar, a task fica em `running` pra sempre — o dashboard mostra ela
indefinidamente e o usuário não tem sinal de que algo quebrou.

Esse loop roda a cada N segundos e:
  1. Busca tasks com `status='running'` cujo `started_at` é mais velho que
     o limite (default = opencode timeout + buffer).
  2. Marca `status='failed'`, escreve `error_message`, seta `finished_at`.
  3. Emite `task.failed` (mesmo evento que o executor emitiria) pra audit
     e métricas pegarem normalmente.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.task import Task, TaskStatus
from intelliforce.events.bus import EventBus
from intelliforce.settings import get_settings

log = structlog.get_logger()


class TaskReaper:
    """Sweep periódico de tasks órfãs em `running`."""

    def __init__(
        self,
        check_interval_seconds: int | None = None,
        reap_after_seconds: int | None = None,
    ) -> None:
        settings = get_settings()
        self.check_interval = check_interval_seconds or settings.task_reap_check_interval_seconds
        self.reap_after = reap_after_seconds or settings.task_reap_after_seconds
        self._running = False

    async def run_forever(self) -> None:
        self._running = True
        log.info(
            "task_reaper.started",
            check_interval=self.check_interval,
            reap_after=self.reap_after,
        )
        while self._running:
            try:
                await self._sweep_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("task_reaper.sweep_failed")
            await asyncio.sleep(self.check_interval)

    async def stop(self) -> None:
        self._running = False
        log.info("task_reaper.stopped")

    async def _sweep_once(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.reap_after)

        async with async_session_factory() as session:
            result = await session.execute(
                select(Task).where(
                    Task.status == TaskStatus.RUNNING.value,
                    Task.started_at.isnot(None),
                    Task.started_at < cutoff,
                )
            )
            stuck = list(result.scalars().all())

            if not stuck:
                return

            now = datetime.now(timezone.utc)
            bus = EventBus(session)
            for task in stuck:
                duration_s = (now - task.started_at).total_seconds() if task.started_at else None
                error_msg = (
                    f"Task presa em `running` há {duration_s:.0f}s sem heartbeat — "
                    f"reaped após {self.reap_after}s."
                )
                task.status = TaskStatus.FAILED.value
                task.finished_at = now
                task.error_message = error_msg

                await bus.emit(
                    type="task.failed",
                    aggregate_id=str(task.id),
                    aggregate_type="task",
                    payload={
                        "error_message": error_msg,
                        "exit_code": None,
                        "duration_ms": int(duration_s * 1000) if duration_s else None,
                        "reaped": True,
                    },
                    metadata={
                        "actor": "task-reaper",
                        "correlation_id": task.correlation_id,
                    },
                )
                log.warning(
                    "task_reaper.reaped",
                    task_id=str(task.id),
                    activity_id=str(task.activity_id) if task.activity_id else None,
                    duration_s=duration_s,
                )

            await session.commit()
            log.info("task_reaper.sweep_complete", reaped=len(stuck))
