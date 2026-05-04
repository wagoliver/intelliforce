"""Endpoints do Vault — CRUD imutável de secrets + audit log.

Imutabilidade: SEM PATCH/PUT. Pra alterar valor: DELETE + POST.
Audit log é append-only e preserva slug snapshot mesmo após delete.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.secret import (
    SecretAccessLogOut,
    SecretCreateRequest,
    SecretOut,
    SecretValueOut,
)
from intelliforce.db.models.secret import Secret
from intelliforce.db.models.secret_access_log import SecretAccessLog
from intelliforce.db.models.user import User
from intelliforce.security.vault import VaultError, get_vault

router = APIRouter(prefix="/secrets", tags=["vault"])


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _client_ip(request: Request) -> str | None:
    """Pega IP do cliente (respeitando X-Forwarded-For se vier do proxy)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


async def _log_access(
    db: AsyncSession,
    *,
    secret_id: object | None,
    secret_slug: str,
    action: str,
    user_id: object | None = None,
    skill: str | None = None,
    task_id: object | None = None,
    ip: str | None = None,
) -> None:
    db.add(
        SecretAccessLog(
            secret_id=secret_id,
            secret_slug=secret_slug,
            accessed_by_user_id=user_id,
            accessed_by_skill=skill,
            accessed_by_task_id=task_id,
            action=action,
            accessed_at=datetime.now(timezone.utc),
            ip_address=ip,
        )
    )


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@router.post("", response_model=SecretOut, status_code=status.HTTP_201_CREATED)
async def create_secret(
    payload: SecretCreateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SecretOut:
    """Cria secret. 409 se slug já existe (imutabilidade — delete antes)."""
    vault = get_vault()
    encrypted = vault.encrypt(payload.value)

    secret = Secret(
        slug=payload.slug,
        description=payload.description,
        encrypted_value=encrypted,
        tags=payload.tags,
        created_by_user_id=user.id,
    )
    db.add(secret)
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Slug '{payload.slug}' já existe. Delete o secret atual "
                "antes de criar um novo com mesmo slug."
            ),
        ) from e

    await _log_access(
        db,
        secret_id=secret.id,
        secret_slug=secret.slug,
        action="create",
        user_id=user.id,
        ip=_client_ip(request),
    )
    await db.commit()
    await db.refresh(secret)
    return SecretOut.model_validate(secret)


@router.get("", response_model=list[SecretOut])
async def list_secrets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SecretOut]:
    """Lista metadata de todos os secrets. NUNCA devolve valor."""
    result = await db.execute(select(Secret).order_by(Secret.slug))
    return [SecretOut.model_validate(s) for s in result.scalars().all()]


@router.get("/{slug}/value", response_model=SecretValueOut)
async def read_secret_value(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_skill_slug: str | None = Header(default=None, alias="X-Skill-Slug"),
    x_task_id: str | None = Header(default=None, alias="X-Task-Id"),
) -> SecretValueOut:
    """Único endpoint que devolve plaintext. Atualiza last_accessed_at + audit."""
    result = await db.execute(select(Secret).where(Secret.slug == slug))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Secret '{slug}' não encontrado")

    vault = get_vault()
    try:
        plaintext = vault.decrypt(secret.encrypted_value)
    except VaultError as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha de descriptografia: {e}",
        ) from e

    secret.last_accessed_at = datetime.now(timezone.utc)

    # Parse task_id header se fornecido (skill scripts passam quando aplicável)
    task_uuid: object | None = None
    if x_task_id:
        try:
            import uuid as _uuid
            task_uuid = _uuid.UUID(x_task_id)
        except ValueError:
            task_uuid = None

    await _log_access(
        db,
        secret_id=secret.id,
        secret_slug=secret.slug,
        action="read",
        user_id=user.id,
        skill=x_skill_slug or None,
        task_id=task_uuid,
        ip=_client_ip(request),
    )
    await db.commit()
    return SecretValueOut(slug=secret.slug, value=plaintext)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_secret(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Deleta secret. Audit log preserva slug snapshot (FK vira null)."""
    result = await db.execute(select(Secret).where(Secret.slug == slug))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Secret '{slug}' não encontrado")

    secret_id = secret.id
    secret_slug = secret.slug

    await db.delete(secret)
    # Importante: log com slug snapshot ANTES do commit pra preservar trilha
    await _log_access(
        db,
        secret_id=None,  # FK vira null após delete
        secret_slug=secret_slug,
        action="delete",
        user_id=user.id,
        ip=_client_ip(request),
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{slug}/audit", response_model=list[SecretAccessLogOut])
async def secret_audit(
    slug: str,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SecretAccessLogOut]:
    """Retorna até N entradas do audit log do secret (mais recentes primeiro).

    Funciona mesmo se secret já foi deletado — usa slug como chave.
    """
    safe_limit = min(max(limit, 1), 500)
    result = await db.execute(
        select(SecretAccessLog)
        .where(SecretAccessLog.secret_slug == slug)
        .order_by(desc(SecretAccessLog.accessed_at))
        .limit(safe_limit)
    )
    return [SecretAccessLogOut.model_validate(e) for e in result.scalars().all()]
