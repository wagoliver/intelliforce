"""Model: PushSubscription — inscrição Web Push (VAPID) de um usuário."""
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PushSubscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Endpoint de push de um navegador/PWA (1 por dispositivo/instalação)."""

    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)

    def __repr__(self) -> str:
        return f"<PushSubscription {self.id} user={self.user_id}>"
