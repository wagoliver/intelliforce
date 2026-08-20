"""model_from_env: modelo de LLM passa a vir só do .env.

O modelo era gravado por agente (agents.model) e também hardcoded no
opencode.json e no frontmatter dos agentes, então trocar LMSTUDIO_DEFAULT_MODEL
no .env não surtia efeito nenhum. A coluna vira nullable e é zerada — quem
manda agora é LMSTUDIO_DEFAULT_MODEL, resolvido no opencode.json pelo
entrypoint. Coluna mantida (deprecada) em vez de dropada pra preservar o
histórico e permitir rollback sem perda.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-19 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "agents",
        "model",
        existing_type=sa.String(255),
        nullable=True,
    )
    # Zera o override em todos os agentes: o .env passa a ser o parâmetro único.
    op.execute("UPDATE agents SET model = NULL")


def downgrade() -> None:
    # Restaura o valor que era o default histórico antes da migration. Não dá
    # pra recuperar overrides individuais (foram zerados no upgrade) — este
    # downgrade só devolve a coluna a um estado NOT NULL válido.
    op.execute(
        "UPDATE agents SET model = 'lmstudio/qwen3.6-27b-mtp' WHERE model IS NULL"
    )
    op.alter_column(
        "agents",
        "model",
        existing_type=sa.String(255),
        nullable=False,
    )
