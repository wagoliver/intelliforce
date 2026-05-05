"""Model: Department — agrupamento de squads dentro da organização."""
import uuid
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class DepartmentHealth(StrEnum):
    HEALTHY = "healthy"
    ATTENTION = "attention"
    CRITICAL = "critical"


class Department(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Departamento — ex: Finance, Procurement, Risk."""

    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)  # slug
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False, default="")

    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    monthly_cost_budget_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )
    health: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DepartmentHealth.HEALTHY.value
    )

    # Soft delete: DELETE marca como False; listagens default filtram
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<Department {self.name} active={self.is_active}>"
