"""Bootstrap idempotente do user de serviço (worker-internal).

Garante que existe no DB um user com `is_service=True` que serve como
"actor" das execuções automatizadas (cron schedules, integrações M2M).

Token JWT longo é gerado separadamente via comando admin
(`scripts/gen_worker_token.py`) e configurado em INTELLIFORCE_WORKER_TOKEN
no .env. O TaskExecutor injeta esse token no env do subprocess OpenCode
quando dispara scheduled tasks.

Por que service account separado?
- Auditoria honesta: audit_events.actor mostra "worker-internal" em vez
  de mascarar como user humano que estava online por acaso.
- TTL longo do token (365d) sem comprometer credenciais de admin humano.
- Fácil rotacionar: regera o token sem mexer em users humanos.
"""
from __future__ import annotations

import secrets

import structlog
from sqlalchemy import select

from intelliforce.db.base import async_session_factory
from intelliforce.db.models.user import User, UserRole

log = structlog.get_logger()

# Usa TLD .app (válido) — `.local` é reservado pra mDNS (RFC 6762) e
# pydantic[email] rejeita.
WORKER_USER_EMAIL = "worker-internal@intelliforce.app"
WORKER_USER_NAME = "IntelliForce Worker"


async def ensure_worker_service_user() -> User:
    """Garante que o user `worker-internal` existe (ou cria). Retorna ele.

    Idempotente: chamadas repetidas não criam duplicatas. Se o user
    já existe, atualiza apenas se algo importante mudou (is_service,
    role, is_active).
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(User.email == WORKER_USER_EMAIL)
        )
        user = result.scalar_one_or_none()

        if user is None:
            # Senha aleatória — não é usada (login UI bloqueia is_service=True).
            # Hash bcrypt mesmo assim por consistência do schema.
            from intelliforce.api.security import hash_password

            random_pw = secrets.token_urlsafe(32)
            user = User(
                email=WORKER_USER_EMAIL,
                password_hash=hash_password(random_pw),
                name=WORKER_USER_NAME,
                role=UserRole.SERVICE.value,
                is_active=True,
                is_service=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            log.info(
                "bootstrap.worker_user_created",
                user_id=str(user.id),
                email=user.email,
            )
        else:
            changed = False
            if not user.is_service:
                user.is_service = True
                changed = True
            if user.role != UserRole.SERVICE.value:
                user.role = UserRole.SERVICE.value
                changed = True
            if not user.is_active:
                user.is_active = True
                changed = True
            if changed:
                await session.commit()
                log.info("bootstrap.worker_user_corrected", user_id=str(user.id))

        return user
