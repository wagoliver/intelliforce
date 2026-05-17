"""chat_sessions: persiste índice de conversas + transcrição por usuário.

O OpenCode CLI já guarda em disco o estado completo de cada sessão (com tool
calls, thinking traces, contexto). Mas o IntelliForce não tinha nenhum link
user → sessões. Resultado: ao fazer logout/login a UI perdia o session_id e
o usuário não conseguia mais reabrir conversas antigas.

Esta migration cria:

  - chat_sessions: 1 linha por sessão OpenCode, ligada a um user. Guarda
    título (primeiros 60 chars do 1º prompt), preview da última mensagem,
    contador, soft-delete (archived_at).

  - chat_messages: transcrição compacta (texto puro, sem tool calls). Permite
    a UI mostrar o histórico ao reabrir uma sessão sem ler do disco do
    OpenCode. Quando o user continua a conversa, o OpenCode reusa seu próprio
    estado completo via --session ses_xxx — a transcrição aqui é só pra UI.

Espaço pra evolução: `chat_messages.content` é TEXT; numa migration futura
adicionamos coluna `embedding vector(N)` pra habilitar busca semântica via
pgvector (já está na stack — D-09).

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-12 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "opencode_session_id",
            sa.String(255),
            nullable=False,
            unique=True,
        ),
        sa.Column("agent", sa.String(64), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("last_message_preview", sa.Text(), nullable=True),
        sa.Column(
            "message_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Índice principal pra listagem do usuário (só ativas, mais recentes primeiro)
    op.create_index(
        "ix_chat_sessions_user_updated",
        "chat_sessions",
        ["user_id", sa.text("updated_at DESC")],
        postgresql_where=sa.text("archived_at IS NULL"),
    )
    # Lookup pelo session_id do OpenCode (usado nas hooks de persistência
    # do /chat e /chat/stream pra decidir entre INSERT e UPDATE)
    op.create_index(
        "ix_chat_sessions_opencode_id",
        "chat_sessions",
        ["opencode_session_id"],
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "chat_session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),  # 'user' | 'agent'
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence_num", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_chat_messages_session_seq",
        "chat_messages",
        ["chat_session_id", "sequence_num"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_session_seq", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_sessions_opencode_id", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_user_updated", table_name="chat_sessions")
    op.drop_table("chat_sessions")
