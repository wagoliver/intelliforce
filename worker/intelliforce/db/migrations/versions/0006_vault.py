"""vault: secrets + secret_access_log

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-04 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # secrets
    op.create_table(
        "secrets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("encrypted_value", sa.LargeBinary(), nullable=False),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_secrets")),
        sa.UniqueConstraint("slug", name=op.f("uq_secrets_slug")),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"],
            name=op.f("fk_secrets_created_by_user_id_users"),
            ondelete="RESTRICT",
        ),
    )
    op.create_index(op.f("ix_secrets_slug"), "secrets", ["slug"])

    # secret_access_log (append-only)
    op.create_table(
        "secret_access_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("secret_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("secret_slug", sa.String(length=64), nullable=False),
        sa.Column("accessed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("accessed_by_skill", sa.String(length=128), nullable=True),
        sa.Column("accessed_by_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("accessed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_secret_access_log")),
        sa.ForeignKeyConstraint(
            ["secret_id"], ["secrets.id"],
            name=op.f("fk_secret_access_log_secret_id_secrets"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["accessed_by_user_id"], ["users.id"],
            name=op.f("fk_secret_access_log_accessed_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["accessed_by_task_id"], ["tasks.id"],
            name=op.f("fk_secret_access_log_accessed_by_task_id_tasks"),
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        op.f("ix_secret_access_log_secret_id"),
        "secret_access_log", ["secret_id"],
    )
    op.create_index(
        op.f("ix_secret_access_log_secret_slug"),
        "secret_access_log", ["secret_slug"],
    )
    op.create_index(
        op.f("ix_secret_access_log_action"),
        "secret_access_log", ["action"],
    )
    op.create_index(
        op.f("ix_secret_access_log_accessed_at"),
        "secret_access_log", ["accessed_at"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_secret_access_log_accessed_at"), table_name="secret_access_log")
    op.drop_index(op.f("ix_secret_access_log_action"), table_name="secret_access_log")
    op.drop_index(op.f("ix_secret_access_log_secret_slug"), table_name="secret_access_log")
    op.drop_index(op.f("ix_secret_access_log_secret_id"), table_name="secret_access_log")
    op.drop_table("secret_access_log")

    op.drop_index(op.f("ix_secrets_slug"), table_name="secrets")
    op.drop_table("secrets")
