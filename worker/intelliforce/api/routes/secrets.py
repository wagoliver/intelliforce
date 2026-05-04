"""Endpoints do Vault — CRUD imutável de secrets multi-field + audit log.

Imutabilidade: SEM PATCH/PUT. Pra alterar valor: DELETE + POST.
Multi-field: 1 secret carrega N campos key→value, criptografados juntos no
mesmo blob Fernet (atualização atômica, audit por campo).
Audit log é append-only e preserva slug snapshot mesmo após delete.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from intelliforce.api.deps import get_current_user, get_db
from intelliforce.api.schemas.secret import (
    SecretAccessLogOut,
    SecretAllValuesOut,
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
    field_accessed: str | None = None,
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
            field_accessed=field_accessed,
        )
    )


def _decrypt_fields(secret: Secret) -> dict[str, str]:
    """Descriptografa o blob e parse JSON dos campos.

    Falha → 500 (corrupção ou key trocada).
    """
    vault = get_vault()
    try:
        plaintext = vault.decrypt(secret.encrypted_value)
    except VaultError as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha de descriptografia: {e}",
        ) from e

    try:
        data = json.loads(plaintext)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Blob descriptografado não é JSON válido: {e}",
        ) from e

    if not isinstance(data, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in data.items()
    ):
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Estrutura inválida — esperava dict[str, str]",
        )
    return data


def _parse_task_id(x_task_id: str | None) -> object | None:
    if not x_task_id:
        return None
    try:
        import uuid as _uuid
        return _uuid.UUID(x_task_id)
    except ValueError:
        return None


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
    """Cria secret com 1+ campos. 409 se slug já existe (imutabilidade)."""
    vault = get_vault()
    # Serializa fields como dict ordenado pro JSON, encripta o blob inteiro
    fields_dict = {f.key: f.value for f in payload.fields}
    plaintext = json.dumps(fields_dict, ensure_ascii=False)
    encrypted = vault.encrypt(plaintext)

    secret = Secret(
        slug=payload.slug,
        description=payload.description,
        encrypted_value=encrypted,
        field_keys=[f.key for f in payload.fields],
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
    """Lista metadata de todos os secrets — nomes dos campos, sem valores."""
    result = await db.execute(select(Secret).order_by(Secret.slug))
    return [SecretOut.model_validate(s) for s in result.scalars().all()]


@router.get("/{slug}/value", response_model=SecretValueOut)
async def read_secret_field(
    slug: str,
    field: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_skill_slug: str | None = Header(default=None, alias="X-Skill-Slug"),
    x_task_id: str | None = Header(default=None, alias="X-Task-Id"),
) -> SecretValueOut:
    """Retorna 1 campo específico do secret. Audit grava field_accessed=field."""
    result = await db.execute(select(Secret).where(Secret.slug == slug))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Secret '{slug}' não encontrado")

    if field not in secret.field_keys:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=(
                f"Campo '{field}' não existe em '{slug}'. "
                f"Disponíveis: {', '.join(secret.field_keys)}"
            ),
        )

    fields = _decrypt_fields(secret)
    value = fields.get(field)
    if value is None:
        # Inconsistência entre field_keys (cleartext) e o JSON descriptografado
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inconsistência: campo '{field}' listado mas ausente no blob",
        )

    secret.last_accessed_at = datetime.now(timezone.utc)
    await _log_access(
        db,
        secret_id=secret.id,
        secret_slug=secret.slug,
        action="read",
        user_id=user.id,
        skill=x_skill_slug or None,
        task_id=_parse_task_id(x_task_id),
        ip=_client_ip(request),
        field_accessed=field,
    )
    await db.commit()
    return SecretValueOut(slug=secret.slug, field=field, value=value)


@router.get("/{slug}/values", response_model=SecretAllValuesOut)
async def read_secret_all_values(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_skill_slug: str | None = Header(default=None, alias="X-Skill-Slug"),
    x_task_id: str | None = Header(default=None, alias="X-Task-Id"),
) -> SecretAllValuesOut:
    """Retorna TODOS os campos descriptografados. Audit grava field_accessed=NULL."""
    result = await db.execute(select(Secret).where(Secret.slug == slug))
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Secret '{slug}' não encontrado")

    fields = _decrypt_fields(secret)

    secret.last_accessed_at = datetime.now(timezone.utc)
    await _log_access(
        db,
        secret_id=secret.id,
        secret_slug=secret.slug,
        action="read",
        user_id=user.id,
        skill=x_skill_slug or None,
        task_id=_parse_task_id(x_task_id),
        ip=_client_ip(request),
        field_accessed=None,  # explícito: leu todos
    )
    await db.commit()
    return SecretAllValuesOut(slug=secret.slug, fields=fields)


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
        # Idempotente: já não existe = sucesso
        return Response(status_code=status.HTTP_204_NO_CONTENT)

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
    """Retorna até N entradas do audit log do secret (mais recentes primeiro)."""
    safe_limit = min(max(limit, 1), 500)
    result = await db.execute(
        select(SecretAccessLog)
        .where(SecretAccessLog.secret_slug == slug)
        .order_by(desc(SecretAccessLog.accessed_at))
        .limit(safe_limit)
    )
    return [SecretAccessLogOut.model_validate(e) for e in result.scalars().all()]
