"""Dependencies do FastAPI: DB session, current_user."""
from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.security import decode_token
from intelliforce.db.base import async_session_factory
from intelliforce.db.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        payload = decode_token(token)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token não é de acesso")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token sem subject")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Subject inválido")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Usuário inválido ou inativo")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Requer papel admin")
    return user
