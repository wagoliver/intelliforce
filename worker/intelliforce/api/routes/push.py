"""Endpoints de Web Push (subscription + chave pública VAPID)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.push import (
    PublicKeyOut,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
)
from intelliforce.db.models.push_subscription import PushSubscription
from intelliforce.db.models.user import User
from intelliforce.settings import get_settings

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/public-key", response_model=PublicKeyOut)
async def public_key(user: User = Depends(get_current_user)) -> PublicKeyOut:
    return PublicKeyOut(public_key=get_settings().vapid_public_key)


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    payload: PushSubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = user.id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        db.add(
            PushSubscription(
                user_id=user.id,
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
            )
        )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    payload: PushUnsubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
