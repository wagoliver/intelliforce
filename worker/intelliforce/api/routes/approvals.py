"""Endpoints de aprovação humana."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.approval import ApprovalDecisionRequest, ApprovalOut
from intelliforce.db.models.approval import Approval, ApprovalDecision
from intelliforce.db.models.task import Task, TaskStatus
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("/inbox", response_model=list[ApprovalOut])
async def inbox(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalOut]:
    """Lista aprovações pendentes (todas — RBAC granular fica pra depois)."""
    result = await db.execute(
        select(Approval)
        .where(Approval.decision == ApprovalDecision.PENDING.value)
        .order_by(Approval.created_at.desc())
    )
    return [ApprovalOut.model_validate(a) for a in result.scalars().all()]


@router.post("/{approval_id}/approve", response_model=ApprovalOut)
async def approve(
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApprovalOut:
    approval, task = await _load_approval_and_task(db, approval_id)
    _ensure_pending(approval)

    approval.decision = ApprovalDecision.APPROVED.value
    approval.decision_reason = payload.reason
    approval.responded_by_user_id = user.id
    approval.responded_at = datetime.now(timezone.utc)

    # Volta task pra pending pra que o executor processe de novo
    task.status = TaskStatus.PENDING.value

    bus = EventBus(db)
    await bus.emit(
        type="human.approval_granted",
        aggregate_id=str(approval.id),
        aggregate_type="approval",
        payload={"task_id": str(task.id), "reason": payload.reason},
        metadata={"actor": str(user.id), "correlation_id": task.correlation_id},
    )
    await bus.emit(
        type="task.approved",
        aggregate_id=str(task.id),
        aggregate_type="task",
        payload={"approval_id": str(approval.id), "approver_user_id": str(user.id)},
        metadata={"actor": str(user.id), "correlation_id": task.correlation_id},
    )
    # Recria o evento task.created pra task voltar pra fila do executor
    await bus.emit(
        type="task.created",
        aggregate_id=str(task.id),
        aggregate_type="task",
        payload={
            "agent_id": str(task.agent_id),
            "input": task.input,
            "prompt": task.prompt,
            "resumed_from_approval": str(approval.id),
        },
        metadata={"actor": "approval-system", "correlation_id": task.correlation_id},
    )

    await db.commit()
    await db.refresh(approval)
    return ApprovalOut.model_validate(approval)


@router.post("/{approval_id}/reject", response_model=ApprovalOut)
async def reject(
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApprovalOut:
    approval, task = await _load_approval_and_task(db, approval_id)
    _ensure_pending(approval)

    approval.decision = ApprovalDecision.REJECTED.value
    approval.decision_reason = payload.reason
    approval.responded_by_user_id = user.id
    approval.responded_at = datetime.now(timezone.utc)

    # Cancela a task
    task.status = TaskStatus.CANCELLED.value
    task.error_message = f"Rejeitada: {payload.reason}" if payload.reason else "Rejeitada na aprovação"

    bus = EventBus(db)
    await bus.emit(
        type="human.approval_denied",
        aggregate_id=str(approval.id),
        aggregate_type="approval",
        payload={"task_id": str(task.id), "reason": payload.reason},
        metadata={"actor": str(user.id), "correlation_id": task.correlation_id},
    )
    await bus.emit(
        type="task.rejected",
        aggregate_id=str(task.id),
        aggregate_type="task",
        payload={"approval_id": str(approval.id), "reason": payload.reason},
        metadata={"actor": str(user.id), "correlation_id": task.correlation_id},
    )

    await db.commit()
    await db.refresh(approval)
    return ApprovalOut.model_validate(approval)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
async def _load_approval_and_task(
    db: AsyncSession,
    approval_id: uuid.UUID,
) -> tuple[Approval, Task]:
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Aprovação não encontrada")

    task_result = await db.execute(select(Task).where(Task.id == approval.task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tarefa associada não encontrada")
    return approval, task


def _ensure_pending(approval: Approval) -> None:
    if approval.decision != ApprovalDecision.PENDING.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Aprovação já decidida ({approval.decision})",
        )
