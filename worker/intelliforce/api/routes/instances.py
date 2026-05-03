"""Endpoint /activities/{id}/scale — declarative scaling de AgentInstances."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.instance import (
    AgentInstanceOut,
    ScaleRequest,
    ScaleResult,
)
from intelliforce.db.models.activity import Activity
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.agent_instance import AgentInstance, AgentInstanceStatus
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus

router = APIRouter(tags=["instances"])


@router.post("/activities/{activity_id}/scale", response_model=ScaleResult)
async def scale_activity(
    activity_id: uuid.UUID,
    payload: ScaleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScaleResult:
    """Declarative scale: ajusta total de instâncias da activity pra `target_count`.

    - Se total atual < target: cria diferença com status `idle` (graceful)
    - Se total atual > target: remove as `idle` mais antigas; se faltar, remove `offline`.
      Não remove `active` (graceful drain — espera tarefa terminar pra reduzir).
    """
    # Carrega activity
    act_res = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = act_res.scalar_one_or_none()
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Activity não encontrada")

    # Decide qual agent (definição) usar
    agent_id = payload.agent_id or activity.default_agent_id
    if not agent_id and payload.target_count > 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Sem agent_id no payload nem default_agent_id na activity. Defina um.",
        )

    if agent_id:
        # Confirma que agent existe
        agent_res = await db.execute(select(Agent.id).where(Agent.id == agent_id))
        if not agent_res.scalar_one_or_none():
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agent (definição) não encontrado")
        # Persiste como default da activity (próximos scales não precisam passar agent_id)
        if activity.default_agent_id != agent_id:
            activity.default_agent_id = agent_id

    # Carrega instances atuais
    inst_res = await db.execute(
        select(AgentInstance).where(AgentInstance.activity_id == activity_id)
    )
    instances = list(inst_res.scalars().all())
    current_total = len(instances)
    target = payload.target_count

    bus = EventBus(db)
    created = 0
    removed = 0

    if target > current_total:
        # Cria diferença
        to_create = target - current_total
        for _ in range(to_create):
            inst = AgentInstance(
                agent_id=agent_id,
                activity_id=activity_id,
                status=AgentInstanceStatus.IDLE.value,
            )
            db.add(inst)
            created += 1
        await db.flush()

        await bus.emit(
            type="activity.scaled_up",
            aggregate_id=str(activity_id),
            aggregate_type="activity",
            payload={"created": created, "from": current_total, "to": target},
            metadata={"actor": str(user.id)},
        )

    elif target < current_total:
        # Remove diferença, priorizando idle → offline (graceful)
        to_remove = current_total - target
        ordered = sorted(
            instances,
            key=lambda i: (
                0 if i.status == AgentInstanceStatus.IDLE.value else
                1 if i.status == AgentInstanceStatus.OFFLINE.value else
                2 if i.status == AgentInstanceStatus.ERROR.value else
                3,  # active vai por último (drain)
                i.created_at,
            ),
        )
        for inst in ordered[:to_remove]:
            await db.delete(inst)
            removed += 1

        await bus.emit(
            type="activity.scaled_down",
            aggregate_id=str(activity_id),
            aggregate_type="activity",
            payload={"removed": removed, "from": current_total, "to": target},
            metadata={"actor": str(user.id)},
        )

    activity.target_agent_count = target
    await db.commit()

    # Recarrega contadores
    res = await db.execute(
        select(AgentInstance.status, func.count(AgentInstance.id))
        .where(AgentInstance.activity_id == activity_id)
        .group_by(AgentInstance.status)
    )
    breakdown = {row[0]: row[1] for row in res.all()}
    total = sum(breakdown.values())

    return ScaleResult(
        activity_id=activity_id,
        target_count=target,
        created=created,
        removed=removed,
        total=total,
        status_breakdown=breakdown,
    )


@router.get("/activities/{activity_id}/instances", response_model=list[AgentInstanceOut])
async def list_instances(
    activity_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AgentInstanceOut]:
    res = await db.execute(
        select(AgentInstance)
        .where(AgentInstance.activity_id == activity_id)
        .order_by(AgentInstance.created_at)
    )
    return [AgentInstanceOut.model_validate(i) for i in res.scalars().all()]
