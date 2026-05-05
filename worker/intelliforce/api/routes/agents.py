"""CRUD de agentes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.agent import (
    AgentCreateRequest,
    AgentOut,
    AgentUpdateRequest,
)
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AgentOut:
    existing = await db.execute(select(Agent).where(Agent.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Já existe agente com esse nome")

    agent = Agent(
        name=payload.name,
        display_name=payload.display_name,
        description=payload.description,
        opencode_agent_file=payload.opencode_agent_file,
        model=payload.model,
        skills=payload.skills,
        policies=payload.policies,
        schedule=payload.schedule,
        is_active=payload.is_active,
        owner_user_id=user.id,
        manager_user_id=payload.manager_user_id,
    )
    db.add(agent)
    await db.flush()

    bus = EventBus(db)
    await bus.emit(
        type="agent.created",
        aggregate_id=str(agent.id),
        aggregate_type="agent",
        payload={"name": agent.name, "model": agent.model, "skills": agent.skills},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    await db.refresh(agent)
    return AgentOut.model_validate(agent)


@router.get("", response_model=list[AgentOut])
async def list_agents(
    include_inactive: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AgentOut]:
    """Lista agents. Por default só retorna ativos — passe
    `?include_inactive=true` pra ver todos (auditoria/admin)."""
    stmt = select(Agent).order_by(Agent.created_at.desc())
    if not include_inactive:
        stmt = stmt.where(Agent.is_active.is_(True))
    result = await db.execute(stmt)
    return [AgentOut.model_validate(a) for a in result.scalars().all()]


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AgentOut:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agente não encontrado")
    return AgentOut.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AgentOut:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agente não encontrado")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(agent, field, value)

    bus = EventBus(db)
    await bus.emit(
        type="agent.updated",
        aggregate_id=str(agent.id),
        aggregate_type="agent",
        payload={"changed_fields": list(changes.keys())},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    await db.refresh(agent)
    return AgentOut.model_validate(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Soft delete — marca o agent como inativo em vez de deletar fisicamente.

    Tasks históricas mantêm `tasks.agent_id` apontando pra cá (preserva
    trilha de auditoria/event sourcing). Hard delete falharia com FK
    violation no FK constraint `fk_tasks_agent_id_agents`.

    Idempotente: chamar várias vezes não causa erro.
    """
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        # Idempotente: já não existe = sucesso
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if not agent.is_active:
        # Já estava desativado — sucesso silencioso
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    agent.is_active = False
    bus = EventBus(db)
    await bus.emit(
        type="agent.deactivated",
        aggregate_id=str(agent.id),
        aggregate_type="agent",
        payload={"name": agent.name, "reason": "deleted"},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
