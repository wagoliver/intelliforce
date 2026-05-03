"""tasks.activity_id (FK opcional)

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-03 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_tasks_activity_id_activities"),
        "tasks", "activities",
        ["activity_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_tasks_activity_id"), "tasks", ["activity_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_activity_id"), table_name="tasks")
    op.drop_constraint(op.f("fk_tasks_activity_id_activities"), "tasks", type_="foreignkey")
    op.drop_column("tasks", "activity_id")
