"""vault multi-field: secrets carregam N campos key→value criptografados juntos.

Adiciona:
- `secrets.field_keys`     — array clear-text dos nomes de campos (não-sensível)
- `secret_access_log.field_accessed` — qual campo foi acessado (NULL = todos)

A coluna `secrets.encrypted_value` continua bytes; mudança é semântica: o
JSON descriptografado agora é sempre `{"key": "value", ...}`. Single-field
vira `{"<unica-key>": "..."}`.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-04 16:50:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "secrets",
        sa.Column(
            "field_keys",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
    )
    op.add_column(
        "secret_access_log",
        sa.Column("field_accessed", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("secret_access_log", "field_accessed")
    op.drop_column("secrets", "field_keys")
