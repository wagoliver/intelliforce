"""Model: User — usuários do IntelliForce (autenticação local)."""
from enum import StrEnum

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserRole(StrEnum):
    """Papéis básicos. RBAC mais granular fica pro pós-MVP."""

    ADMIN = "admin"
    USER = "user"
    AUDITOR = "auditor"
    SERVICE = "service"  # contas de máquina (worker, integrações M2M)


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Usuário do sistema. Quando `is_service=True`, é uma conta sintética
    (worker, cron, integração M2M) — não tem login UI, não recebe e-mail,
    e tem papel `service` por convenção."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default=UserRole.USER.value
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Service account flag — distingue contas de máquina de contas humanas.
    # Usado pelo bootstrap do worker pra criar/garantir o user "worker-internal"
    # idempotentemente no startup.
    is_service: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )

    def __repr__(self) -> str:
        kind = "service" if self.is_service else "user"
        return f"<User {self.email} ({self.role}) {kind}>"
