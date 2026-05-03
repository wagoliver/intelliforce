"""Initial schema — users, agents, tasks, approvals, events.

Revision ID: 0001
Revises:
Create Date: 2026-05-02 23:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # Extensões necessárias
    # -------------------------------------------------------------------------
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # -------------------------------------------------------------------------
    # users
    # -------------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # -------------------------------------------------------------------------
    # agents
    # -------------------------------------------------------------------------
    op.create_table(
        "agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("opencode_agent_file", sa.String(length=255), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column(
            "skills",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "policies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("schedule", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("manager_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_user_id"], ["users.id"],
            name=op.f("fk_agents_owner_user_id_users"), ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["manager_user_id"], ["users.id"],
            name=op.f("fk_agents_manager_user_id_users"), ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agents")),
        sa.UniqueConstraint("name", name=op.f("uq_agents_name")),
    )
    op.create_index(op.f("ix_agents_name"), "agents", ["name"], unique=True)

    # -------------------------------------------------------------------------
    # tasks
    # -------------------------------------------------------------------------
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column(
            "input",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("result_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("opencode_session_id", sa.String(length=64), nullable=True),
        sa.Column("triggered_by", sa.String(length=32), nullable=False, server_default="api"),
        sa.Column("triggered_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cost_usd", sa.Numeric(precision=12, scale=6), nullable=False, server_default="0"),
        sa.Column("tokens_input", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_output", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agent_id"], ["agents.id"],
            name=op.f("fk_tasks_agent_id_agents"), ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["triggered_by_user_id"], ["users.id"],
            name=op.f("fk_tasks_triggered_by_user_id_users"), ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(op.f("ix_tasks_agent_id"), "tasks", ["agent_id"])
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"])
    op.create_index(op.f("ix_tasks_correlation_id"), "tasks", ["correlation_id"])

    # -------------------------------------------------------------------------
    # approvals
    # -------------------------------------------------------------------------
    op.create_table(
        "approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("decision", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("responded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"],
            name=op.f("fk_approvals_task_id_tasks"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["responded_by_user_id"], ["users.id"],
            name=op.f("fk_approvals_responded_by_user_id_users"), ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_approvals")),
    )
    op.create_index(op.f("ix_approvals_task_id"), "approvals", ["task_id"])
    op.create_index(op.f("ix_approvals_decision"), "approvals", ["decision"])

    # -------------------------------------------------------------------------
    # events (event store, append-only)
    # -------------------------------------------------------------------------
    op.create_table(
        "events",
        sa.Column("id", sa.String(length=26), nullable=False),  # ULID
        sa.Column("type", sa.String(length=128), nullable=False),
        sa.Column("aggregate_id", sa.String(length=64), nullable=False),
        sa.Column("aggregate_type", sa.String(length=64), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_events")),
    )
    op.create_index(op.f("ix_events_type"), "events", ["type"])
    op.create_index(op.f("ix_events_aggregate_id"), "events", ["aggregate_id"])
    op.create_index(op.f("ix_events_aggregate_type"), "events", ["aggregate_type"])
    op.create_index(op.f("ix_events_published_at"), "events", ["published_at"])
    op.create_index("ix_events_published_pending", "events", ["published_at", "id"])
    op.create_index(
        "ix_events_aggregate_timeline",
        "events",
        ["aggregate_type", "aggregate_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_events_aggregate_timeline", table_name="events")
    op.drop_index("ix_events_published_pending", table_name="events")
    op.drop_index(op.f("ix_events_published_at"), table_name="events")
    op.drop_index(op.f("ix_events_aggregate_type"), table_name="events")
    op.drop_index(op.f("ix_events_aggregate_id"), table_name="events")
    op.drop_index(op.f("ix_events_type"), table_name="events")
    op.drop_table("events")

    op.drop_index(op.f("ix_approvals_decision"), table_name="approvals")
    op.drop_index(op.f("ix_approvals_task_id"), table_name="approvals")
    op.drop_table("approvals")

    op.drop_index(op.f("ix_tasks_correlation_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_agent_id"), table_name="tasks")
    op.drop_table("tasks")

    op.drop_index(op.f("ix_agents_name"), table_name="agents")
    op.drop_table("agents")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
