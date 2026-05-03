"""CRUD de tarefas."""
from __future__ import annotations

import uuid

import ulid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.task import TaskCancelRequest, TaskCreateRequest, TaskOut
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.task import Task, TaskStatus, TaskTriggerType
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    # Valida que o agente existe e está ativo
    result = await db.execute(select(Agent).where(Agent.id == payload.agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agente não encontrado")
    if not agent.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Agente está inativo")

    correlation_id = payload.correlation_id or str(ulid.new())
    prompt = payload.prompt or _derive_prompt_from_input(payload.input)

    task = Task(
        agent_id=agent.id,
        status=TaskStatus.PENDING.value,
        input=payload.input,
        prompt=prompt,
        triggered_by=TaskTriggerType.API.value,
        triggered_by_user_id=user.id,
        correlation_id=correlation_id,
    )
    db.add(task)
    await db.flush()

    bus = EventBus(db)
    await bus.emit(
        type="task.created",
        aggregate_id=str(task.id),
        aggregate_type="task",
        payload={
            "agent_id": str(agent.id),
            "agent_name": agent.name,
            "input": payload.input,
            "prompt": prompt,
            "triggered_by": TaskTriggerType.API.value,
        },
        metadata={"actor": str(user.id), "correlation_id": correlation_id},
    )
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    agent_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TaskOut]:
    query = select(Task).order_by(Task.created_at.desc()).limit(min(limit, 200))
    if agent_id:
        query = query.where(Task.agent_id == agent_id)
    if status_filter:
        query = query.where(Task.status == status_filter)
    result = await db.execute(query)
    return [TaskOut.model_validate(t) for t in result.scalars().all()]


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada")
    return TaskOut.model_validate(task)


@router.post("/{task_id}/cancel", response_model=TaskOut)
async def cancel_task(
    task_id: uuid.UUID,
    payload: TaskCancelRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada")
    if task.status in (TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Tarefa em estado terminal ({task.status})")

    task.status = TaskStatus.CANCELLED.value
    task.error_message = f"Cancelada: {payload.reason}" if payload.reason else "Cancelada pelo usuário"

    bus = EventBus(db)
    await bus.emit(
        type="task.cancelled",
        aggregate_id=str(task.id),
        aggregate_type="task",
        payload={"reason": payload.reason},
        metadata={"actor": str(user.id), "correlation_id": task.correlation_id},
    )
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)


def _derive_prompt_from_input(payload: dict) -> str:
    """Se prompt vazio, deriva do input (placeholder simples)."""
    if "prompt" in payload:
        return str(payload["prompt"])
    if not payload:
        return "Execute a tarefa atribuída."
    return f"Execute a tarefa com os seguintes dados: {payload}"
