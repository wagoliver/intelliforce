"""reports: saídas dos agentes (documentos Markdown) no Report Center.

Cria a tabela `reports`. O conteúdo é guardado como Markdown (content_md);
o PDF é renderizado on-demand no download. FKs com ON DELETE SET NULL pra
preservar o relatório mesmo se o departamento/agente/usuário for removido.

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-05 14:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("source", sa.String(16), nullable=False, server_default="agent"),
        sa.Column(
            "department_id",
            UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_reports_created_at", "reports", [sa.text("created_at DESC")]
    )
    op.create_index("ix_reports_department_id", "reports", ["department_id"])


def downgrade() -> None:
    op.drop_index("ix_reports_department_id", table_name="reports")
    op.drop_index("ix_reports_created_at", table_name="reports")
    op.drop_table("reports")
