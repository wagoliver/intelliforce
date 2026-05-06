"""CRUD de Departments + Squads + Activities (aninhado)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


def _compute_next_run(schedule: str | None) -> datetime | None:
    """Calcula próximo trigger de uma cron expression. Retorna None se inválido."""
    if not schedule:
        return None
    try:
        c = croniter(schedule, datetime.now(timezone.utc))
        return c.get_next(datetime)
    except Exception:
        return None

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.organization import (
    ActivityCreate,
    ActivityOut,
    ActivityUpdate,
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
    PersonOut,
    SquadCreate,
    SquadOut,
    SquadUpdate,
)
from intelliforce.db.models.activity import Activity
from intelliforce.db.models.agent import Agent
from intelliforce.db.models.agent_instance import AgentInstance
from intelliforce.db.models.department import Department
from intelliforce.db.models.squad import Squad
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus

router = APIRouter(prefix="/departments", tags=["organization"])


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
async def _instance_counts_per_activity(db: AsyncSession) -> dict[uuid.UUID, dict[str, int]]:
    """Conta AgentInstances por activity_id, agrupado por status.

    Retorna: { activity_id: { "active": N, "idle": N, "offline": N, "error": N } }
    """
    result = await db.execute(
        select(
            AgentInstance.activity_id,
            AgentInstance.status,
            func.count(AgentInstance.id),
        )
        .where(AgentInstance.activity_id.isnot(None))
        .group_by(AgentInstance.activity_id, AgentInstance.status)
    )
    counts: dict[uuid.UUID, dict[str, int]] = {}
    for activity_id, status_str, n in result.all():
        counts.setdefault(activity_id, {})[status_str] = n
    return counts


async def _resolve_owner(db: AsyncSession, owner_user_id: uuid.UUID | None) -> PersonOut | None:
    """Busca o User do gestor para serializar o nome/email/role no DepartmentOut.

    Retorna None se owner_user_id é nulo, ou se o user foi removido — a FK é
    ON DELETE SET NULL, então o id pode persistir após exclusão; serializar
    como None aqui mantém o caller seguro.
    """
    if owner_user_id is None:
        return None
    res = await db.execute(select(User).where(User.id == owner_user_id))
    user = res.scalar_one_or_none()
    if user is None:
        return None
    return PersonOut(id=user.id, name=user.name, email=user.email, role=user.role)


async def _serialize_department(db: AsyncSession, dept: Department) -> DepartmentOut:
    """Serializa Department com squads, activities e contagens reais de AgentInstance."""
    counts = await _instance_counts_per_activity(db)
    total_agents = 0
    squads_out = []
    next_runs: list[datetime] = []
    for squad in sorted(dept.squads, key=lambda s: s.position):
        activities_out = []
        for act in sorted(squad.activities, key=lambda a: a.position):
            by_status = counts.get(act.id, {})
            active = by_status.get("active", 0)
            idle = by_status.get("idle", 0)
            offline = by_status.get("offline", 0)
            error = by_status.get("error", 0)
            count = active + idle + offline + error
            total_agents += count
            next_run = _compute_next_run(act.schedule)
            if next_run is not None:
                next_runs.append(next_run)
            activities_out.append(ActivityOut(
                id=act.id, squad_id=act.squad_id, name=act.name,
                display_name=act.display_name, skill_code=act.skill_code,
                target_agent_count=act.target_agent_count, position=act.position,
                default_agent_id=act.default_agent_id, schedule=act.schedule,
                next_run=next_run,
                agent_count=count, active_count=active, idle_count=idle,
                offline_count=offline, error_count=error,
                created_at=act.created_at, updated_at=act.updated_at,
            ))
        squads_out.append(SquadOut(
            id=squad.id, department_id=squad.department_id, name=squad.name,
            display_name=squad.display_name, position=squad.position,
            activities=activities_out, created_at=squad.created_at, updated_at=squad.updated_at,
        ))

    owner = await _resolve_owner(db, dept.owner_user_id)
    return DepartmentOut(
        id=dept.id, name=dept.name, display_name=dept.display_name,
        objective=dept.objective, owner_user_id=dept.owner_user_id, owner=owner,
        monthly_cost_budget_usd=dept.monthly_cost_budget_usd, health=dept.health,
        squads=squads_out, total_agents=total_agents,
        next_run=min(next_runs) if next_runs else None,
        created_at=dept.created_at, updated_at=dept.updated_at,
    )


async def _load_department(db: AsyncSession, department_id: uuid.UUID) -> Department:
    """Carrega Department + squads ativos + activities ativas (sem ORM
    relationships, manual). Filtra is_active=true em squads e activities pra
    consistência com soft delete (inativos somem da árvore)."""
    dept_result = await db.execute(select(Department).where(Department.id == department_id))
    dept = dept_result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department não encontrado")
    squads_result = await db.execute(
        select(Squad).where(Squad.department_id == dept.id, Squad.is_active.is_(True))
    )
    dept.squads = list(squads_result.scalars().all())  # type: ignore[attr-defined]
    for squad in dept.squads:  # type: ignore[attr-defined]
        acts = await db.execute(
            select(Activity).where(Activity.squad_id == squad.id, Activity.is_active.is_(True))
        )
        squad.activities = list(acts.scalars().all())  # type: ignore[attr-defined]
    return dept


# -----------------------------------------------------------------------------
# Departments CRUD
# -----------------------------------------------------------------------------
@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DepartmentOut:
    existing = await db.execute(select(Department).where(Department.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Já existe department com esse nome")

    dept = Department(
        name=payload.name,
        display_name=payload.display_name,
        objective=payload.objective,
        owner_user_id=payload.owner_user_id,
        monthly_cost_budget_usd=payload.monthly_cost_budget_usd,
        health=payload.health,
    )
    db.add(dept)
    await db.flush()

    bus = EventBus(db)
    await bus.emit(
        type="department.created",
        aggregate_id=str(dept.id),
        aggregate_type="department",
        payload={"name": dept.name, "display_name": dept.display_name},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    await db.refresh(dept)
    dept.squads = []
    return await _serialize_department(db, dept)


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    include_inactive: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DepartmentOut]:
    """Lista departments. Default só ativos — `?include_inactive=true` retorna todos."""
    stmt = select(Department).order_by(Department.created_at)
    if not include_inactive:
        stmt = stmt.where(Department.is_active.is_(True))
    result = await db.execute(stmt)
    depts = list(result.scalars().all())
    out = []
    for dept in depts:
        loaded = await _load_department(db, dept.id)
        out.append(await _serialize_department(db, loaded))
    return out


@router.get("/{department_id}", response_model=DepartmentOut)
async def get_department(
    department_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DepartmentOut:
    dept = await _load_department(db, department_id)
    return await _serialize_department(db, dept)


@router.patch("/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: uuid.UUID,
    payload: DepartmentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DepartmentOut:
    result = await db.execute(select(Department).where(Department.id == department_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department não encontrado")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(dept, k, v)

    bus = EventBus(db)
    await bus.emit(
        type="department.updated",
        aggregate_id=str(dept.id),
        aggregate_type="department",
        payload={"changed_fields": list(changes.keys())},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    loaded = await _load_department(db, department_id)
    return await _serialize_department(db, loaded)


@router.delete("/{department_id}")
async def delete_department(
    department_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Soft delete — marca department como inativo. Squads/activities/agents
    referenciando preservam audit. Idempotente."""
    result = await db.execute(select(Department).where(Department.id == department_id))
    dept = result.scalar_one_or_none()
    if not dept or not dept.is_active:
        # Não existe OU já estava inativo — sucesso silencioso
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    dept.is_active = False
    bus = EventBus(db)
    await bus.emit(
        type="department.deleted",
        aggregate_id=str(dept.id),
        aggregate_type="department",
        payload={"name": dept.name, "reason": "soft_delete"},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# Squads (aninhados em /departments/{id}/squads)
# -----------------------------------------------------------------------------
@router.post("/{department_id}/squads", response_model=SquadOut, status_code=status.HTTP_201_CREATED)
async def create_squad(
    department_id: uuid.UUID,
    payload: SquadCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SquadOut:
    dept_check = await db.execute(select(Department.id).where(Department.id == department_id))
    if not dept_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department não encontrado")

    squad = Squad(
        department_id=department_id,
        name=payload.name,
        display_name=payload.display_name,
        position=payload.position,
    )
    db.add(squad)
    await db.flush()

    bus = EventBus(db)
    await bus.emit(
        type="squad.created",
        aggregate_id=str(squad.id),
        aggregate_type="squad",
        payload={"department_id": str(department_id), "name": squad.name},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    await db.refresh(squad)
    squad.activities = []
    return SquadOut.model_validate(squad)


@router.patch("/{department_id}/squads/{squad_id}", response_model=SquadOut)
async def update_squad(
    department_id: uuid.UUID,
    squad_id: uuid.UUID,
    payload: SquadUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SquadOut:
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id, Squad.department_id == department_id)
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Squad não encontrado")
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(squad, k, v)
    await db.commit()
    await db.refresh(squad)
    acts_result = await db.execute(select(Activity).where(Activity.squad_id == squad.id))
    squad.activities = list(acts_result.scalars().all())
    return SquadOut.model_validate(squad)


@router.delete("/{department_id}/squads/{squad_id}")
async def delete_squad(
    department_id: uuid.UUID,
    squad_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Soft delete — marca squad como inativo. Activities preservam audit. Idempotente."""
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id, Squad.department_id == department_id)
    )
    squad = result.scalar_one_or_none()
    if not squad or not squad.is_active:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    squad.is_active = False
    bus = EventBus(db)
    await bus.emit(
        type="squad.deleted",
        aggregate_id=str(squad.id),
        aggregate_type="squad",
        payload={"name": squad.name, "reason": "soft_delete"},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# Activities (aninhados em /departments/{id}/squads/{sid}/activities)
# -----------------------------------------------------------------------------
@router.post(
    "/{department_id}/squads/{squad_id}/activities",
    response_model=ActivityOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_activity(
    department_id: uuid.UUID,
    squad_id: uuid.UUID,
    payload: ActivityCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityOut:
    sq_check = await db.execute(
        select(Squad.id).where(Squad.id == squad_id, Squad.department_id == department_id)
    )
    if not sq_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Squad não encontrado")

    activity = Activity(
        squad_id=squad_id,
        name=payload.name,
        display_name=payload.display_name,
        skill_code=payload.skill_code,
        target_agent_count=payload.target_agent_count,
        position=payload.position,
        default_agent_id=payload.default_agent_id,
        schedule=payload.schedule,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return ActivityOut.model_validate(activity)


@router.patch(
    "/{department_id}/squads/{squad_id}/activities/{activity_id}",
    response_model=ActivityOut,
)
async def update_activity(
    department_id: uuid.UUID,
    squad_id: uuid.UUID,
    activity_id: uuid.UUID,
    payload: ActivityUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityOut:
    result = await db.execute(
        select(Activity).where(Activity.id == activity_id, Activity.squad_id == squad_id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Activity não encontrada")
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(activity, k, v)
    await db.commit()
    await db.refresh(activity)
    return ActivityOut.model_validate(activity)


@router.delete(
    "/{department_id}/squads/{squad_id}/activities/{activity_id}"
)
async def delete_activity(
    department_id: uuid.UUID,
    squad_id: uuid.UUID,
    activity_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Soft delete — marca activity como inativa. Tasks/instances preservam audit. Idempotente."""
    result = await db.execute(
        select(Activity).where(Activity.id == activity_id, Activity.squad_id == squad_id)
    )
    activity = result.scalar_one_or_none()
    if not activity or not activity.is_active:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    activity.is_active = False
    bus = EventBus(db)
    await bus.emit(
        type="activity.deleted",
        aggregate_id=str(activity.id),
        aggregate_type="activity",
        payload={"name": activity.name, "reason": "soft_delete"},
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
