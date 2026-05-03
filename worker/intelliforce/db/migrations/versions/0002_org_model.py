"""Modelo organizacional: departments, squads, activities + agents.activity_id

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-03 02:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # departments
    # ------------------------------------------------------------------
    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False, server_default=""),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "monthly_cost_budget_usd",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("health", sa.String(length=16), nullable=False, server_default="healthy"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_user_id"], ["users.id"],
            name=op.f("fk_departments_owner_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_departments")),
        sa.UniqueConstraint("name", name=op.f("uq_departments_name")),
    )
    op.create_index(op.f("ix_departments_name"), "departments", ["name"], unique=True)

    # ------------------------------------------------------------------
    # squads
    # ------------------------------------------------------------------
    op.create_table(
        "squads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["department_id"], ["departments.id"],
            name=op.f("fk_squads_department_id_departments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_squads")),
    )
    op.create_index(op.f("ix_squads_department_id"), "squads", ["department_id"])

    # ------------------------------------------------------------------
    # activities
    # ------------------------------------------------------------------
    op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("squad_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("skill_code", sa.String(length=8), nullable=False, server_default=""),
        sa.Column("target_agent_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["squad_id"], ["squads.id"],
            name=op.f("fk_activities_squad_id_squads"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activities")),
    )
    op.create_index(op.f("ix_activities_squad_id"), "activities", ["squad_id"])

    # ------------------------------------------------------------------
    # agents.activity_id (coluna opcional)
    # ------------------------------------------------------------------
    op.add_column(
        "agents",
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_agents_activity_id_activities"),
        "agents", "activities",
        ["activity_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_agents_activity_id"), "agents", ["activity_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_agents_activity_id"), table_name="agents")
    op.drop_constraint(op.f("fk_agents_activity_id_activities"), "agents", type_="foreignkey")
    op.drop_column("agents", "activity_id")

    op.drop_index(op.f("ix_activities_squad_id"), table_name="activities")
    op.drop_table("activities")

    op.drop_index(op.f("ix_squads_department_id"), table_name="squads")
    op.drop_table("squads")

    op.drop_index(op.f("ix_departments_name"), table_name="departments")
    op.drop_table("departments")
