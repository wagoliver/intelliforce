"""Endpoint /people — lista usuários como candidatos a owner/manager."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.organization import PersonOut
from intelliforce.db.models.user import User

router = APIRouter(prefix="/people", tags=["organization"])


@router.get("", response_model=list[PersonOut])
async def list_people(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PersonOut]:
    """Lista usuários ativos. Pode ser refinado por role no futuro."""
    result = await db.execute(
        select(User).where(User.is_active.is_(True)).order_by(User.name)
    )
    return [PersonOut.model_validate(u) for u in result.scalars().all()]
