"""Models: ChatSession + ChatMessage — histórico de chat por usuário.

Ver migration 0010 pra contexto. Resumo: o OpenCode guarda o estado rico em
disco; aqui só indexamos por user e gravamos a transcrição limpa pra UI."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from intelliforce.db.base import Base
from intelliforce.db.models._mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ChatSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Sessão de chat de um usuário com um agente."""

    __tablename__ = "chat_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # ID interno do OpenCode (ex: "ses_abc123"). UNIQUE pra evitar 2 linhas
    # apontando pra mesma conversa.
    opencode_session_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    agent: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Soft delete — listagem default filtra archived_at IS NULL.
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.sequence_num",
    )

    def __repr__(self) -> str:
        return f"<ChatSession {self.opencode_session_id} user={self.user_id}>"


class ChatMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Mensagem individual da transcrição limpa (sem tool calls / thinking)."""

    __tablename__ = "chat_messages"

    chat_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 'user' ou 'agent'. Mantemos como String simples (não Enum) pra evitar
    # migration de tipo se quisermos 'system' ou 'tool' no futuro.
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Ordering dentro da sessão (1, 2, 3, ...). Não usamos created_at pra
    # ordenar porque mensagens da mesma rodada podem ter timestamps idênticos.
    sequence_num: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[ChatSession] = relationship(
        "ChatSession", back_populates="messages"
    )

    def __repr__(self) -> str:
        return f"<ChatMessage {self.role} seq={self.sequence_num}>"
