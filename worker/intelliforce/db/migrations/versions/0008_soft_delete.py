"""soft_delete: adiciona is_active em departments, squads, activities

Adiciona coluna `is_active BOOL NOT NULL DEFAULT TRUE` em 3 tabelas
referenciadas por outras (FKs apontam pra elas) — permite soft delete
em vez de hard delete quando há registros históricos.

Razão: hard delete violaria FK constraints quando há tasks/squads/etc
referenciando. Soft delete preserva trilha de auditoria + esconde da
listagem default.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-05 01:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("departments", "squads", "activities"):
        op.add_column(
            table,
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )


def downgrade() -> None:
    for table in ("activities", "squads", "departments"):
        op.drop_column(table, "is_active")
