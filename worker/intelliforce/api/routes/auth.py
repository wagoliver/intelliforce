"""Endpoints de autenticação: registro, login, /me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserOut,
    UserRegisterRequest,
)
from intelliforce.api.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from intelliforce.db.models.user import User, UserRole
from intelliforce.events.bus import EventBus

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Cria conta. Primeiro usuário cadastrado vira admin automaticamente."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="E-mail já cadastrado")

    # Primeiro user humano vira admin. Service accounts (worker-internal etc.)
    # são ignorados — senão o bootstrap do worker rouba o slot de admin.
    count_result = await db.execute(
        select(User.id).where(User.is_service.is_(False)).limit(1)
    )
    has_users = count_result.scalar_one_or_none() is not None
    role = UserRole.USER.value if has_users else UserRole.ADMIN.value

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role=role,
        is_active=True,
    )
    db.add(user)

    bus = EventBus(db)
    await bus.emit(
        type="user.registered",
        aggregate_id=str(user.id) if user.id else "pending",
        aggregate_type="user",
        payload={"email": user.email, "role": role},
        metadata={"actor": "self-registration"},
    )

    await db.commit()
    await db.refresh(user)

    # emite evento de novo agora que sabemos o id (caso tenha sido pending)
    if not user.id:
        pass  # já estava setado pelo db.flush() no bus.emit

    return TokenResponse(
        access_token=create_access_token(subject=str(user.id), extra_claims={"role": user.role}),
        refresh_token=create_refresh_token(subject=str(user.id)),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Usuário inativo")

    bus = EventBus(db)
    await bus.emit(
        type="user.logged_in",
        aggregate_id=str(user.id),
        aggregate_type="user",
        payload={},
        metadata={"actor": str(user.id)},
    )
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(subject=str(user.id), extra_claims={"role": user.role}),
        refresh_token=create_refresh_token(subject=str(user.id)),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
