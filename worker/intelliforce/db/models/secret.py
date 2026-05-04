"""Model: Secret — credencial criptografada (vault)."""
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import UUIDPrimaryKeyMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Secret(Base, UUIDPrimaryKeyMixin):
    """Credencial criptografada via Fernet. Imutável: pra mudar valor, deleta + cria.

    NÃO usa TimestampMixin porque NÃO tem updated_at (imutabilidade).
    Tem `last_accessed_at` separado, atualizado pelo service ao ler valor.
    """

    __tablename__ = "secrets"

    # Slug único (kebab-case), usado como referência pelas skills
    slug: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Valor criptografado: Fernet sobre JSON `{"<field_key>": "<value>", ...}`.
    # Pra single-field, é só {"<key>": "<value>"}; pra multi-field (Zoho, AWS,
    # OAuth), todos os campos no mesmo blob → atualização atômica e cripto único.
    encrypted_value: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)

    # Nomes dos campos do JSON acima — clear text (não-sensível). Permite
    # listar sem descriptografar e validar `?field=X` antes de decifrar.
    field_keys: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=sa.text("'{}'::varchar[]"),
    )

    # Tags pra agrupar (ex: ["zoho", "prod"]). Postgres ARRAY de text.
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=sa.text("'{}'::varchar[]"),
    )

    # Quem criou
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Timestamps — sem updated_at (imutável)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow,
    )
    last_accessed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Secret slug={self.slug}>"
