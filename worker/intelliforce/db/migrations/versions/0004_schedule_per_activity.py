"""Schedule por Activity (não mais Agent)

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-03 04:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("schedule", sa.String(length=64), nullable=True),
    )
    # Migra schedules existentes de agents pra suas activities (se default_agent_id casa)
    op.execute("""
        UPDATE activities a
        SET schedule = ag.schedule
        FROM agents ag
        WHERE a.default_agent_id = ag.id
          AND ag.schedule IS NOT NULL
          AND a.schedule IS NULL
    """)


def downgrade() -> None:
    op.drop_column("activities", "schedule")
