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


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Usuário humano do sistema."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default=UserRole.USER.value
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
