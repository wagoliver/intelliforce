"""worker_service_user: adiciona users.is_service pra distinguir contas
de máquina de contas humanas.

User com is_service=true é criado/garantido idempotentemente no startup
do worker (bootstrap). Token JWT longo é gerado via comando admin e
configurado em INTELLIFORCE_WORKER_TOKEN no .env, propagado pelo task
executor pras invocações scheduled do OpenCode.

Auditoria fica honesta: scheduled tasks aparecem com actor=worker
em vez de mascararem como user humano.

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-05 02:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_service",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_users_is_service",
        "users",
        ["is_service"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_is_service", table_name="users")
    op.drop_column("users", "is_service")
