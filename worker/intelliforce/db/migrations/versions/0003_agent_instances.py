"""AgentInstance + activities.default_agent_id

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-03 03:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adiciona default_agent_id em activities
    op.add_column(
        "activities",
        sa.Column("default_agent_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_activities_default_agent_id_agents"),
        "activities", "agents",
        ["default_agent_id"], ["id"],
        ondelete="SET NULL",
    )

    # Cria agent_instances
    op.create_table(
        "agent_instances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="idle"),
        sa.Column("last_heartbeat", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agent_id"], ["agents.id"],
            name=op.f("fk_agent_instances_agent_id_agents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["activity_id"], ["activities.id"],
            name=op.f("fk_agent_instances_activity_id_activities"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["current_task_id"], ["tasks.id"],
            name=op.f("fk_agent_instances_current_task_id_tasks"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_instances")),
    )
    op.create_index(op.f("ix_agent_instances_agent_id"), "agent_instances", ["agent_id"])
    op.create_index(op.f("ix_agent_instances_activity_id"), "agent_instances", ["activity_id"])
    op.create_index(op.f("ix_agent_instances_status"), "agent_instances", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_agent_instances_status"), table_name="agent_instances")
    op.drop_index(op.f("ix_agent_instances_activity_id"), table_name="agent_instances")
    op.drop_index(op.f("ix_agent_instances_agent_id"), table_name="agent_instances")
    op.drop_table("agent_instances")

    op.drop_constraint(
        op.f("fk_activities_default_agent_id_agents"),
        "activities",
        type_="foreignkey",
    )
    op.drop_column("activities", "default_agent_id")
