"""Report Center — saídas (relatórios MD/PDF) dos agentes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.report import (
    ReportCreateRequest,
    ReportDetailOut,
    ReportOut,
)
from intelliforce.db.models.report import Report, ReportSource
from intelliforce.db.models.user import User
from intelliforce.events.bus import EventBus
from intelliforce.services.push import send_report_push
from intelliforce.services.report_pdf import render_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


def _to_out(r: Report) -> ReportOut:
    return ReportOut(
        id=r.id,
        title=r.title,
        summary=r.summary,
        tags=r.tags or [],
        source=r.source,
        department_id=r.department_id,
        agent_id=r.agent_id,
        size_bytes=len((r.content_md or "").encode("utf-8")),
        created_at=r.created_at,
    )


def _safe_filename(title: str) -> str:
    base = "".join(c for c in (title or "") if c.isalnum() or c in " -_").strip()
    return base or "relatorio"


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreateRequest,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    report = Report(
        title=payload.title,
        content_md=payload.content,
        summary=payload.summary,
        tags=payload.tags or [],
        source=ReportSource.AGENT.value if payload.agent_id else ReportSource.USER.value,
        department_id=payload.department_id,
        agent_id=payload.agent_id,
        created_by_user_id=user.id,
    )
    db.add(report)
    await db.flush()

    bus = EventBus(db)
    await bus.emit(
        type="report.created",
        aggregate_id=str(report.id),
        aggregate_type="report",
        payload={
            "title": report.title,
            "agent_id": str(report.agent_id) if report.agent_id else None,
            "department_id": str(report.department_id) if report.department_id else None,
        },
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    await db.refresh(report)

    # Notifica os inscritos (Web Push) após responder — best-effort.
    background.add_task(
        send_report_push,
        str(report.id),
        report.title,
        report.summary or "Um novo relatório está disponível.",
    )
    return _to_out(report)


@router.get("", response_model=list[ReportOut])
async def list_reports(
    department_id: uuid.UUID | None = None,
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReportOut]:
    query = select(Report).order_by(Report.created_at.desc()).limit(min(limit, 200))
    if department_id:
        query = query.where(Report.department_id == department_id)
    result = await db.execute(query)
    return [_to_out(r) for r in result.scalars().all()]


@router.get("/{report_id}", response_model=ReportDetailOut)
async def get_report(
    report_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailOut:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Relatório não encontrado")
    return ReportDetailOut(**_to_out(report).model_dump(), content=report.content_md or "")


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    format: str = Query("pdf", pattern="^(md|pdf)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Relatório não encontrado")

    name = _safe_filename(report.title)
    if format == "md":
        return Response(
            content=report.content_md or "",
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{name}.md"'},
        )

    try:
        pdf_bytes = render_pdf(report.content_md or "", report.title)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Falha ao gerar PDF: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'},
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Relatório não encontrado")
    await db.delete(report)
    bus = EventBus(db)
    await bus.emit(
        type="report.deleted",
        aggregate_id=str(report_id),
        aggregate_type="report",
        metadata={"actor": str(user.id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
