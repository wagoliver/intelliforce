"""Alembic env.py — configurado pra ler URL do ambiente e detectar todos os models."""
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool, text

from alembic import context

# -----------------------------------------------------------------------------
# Adiciona /app ao path pra import dos models funcionar
# -----------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from intelliforce.db.base import Base  # noqa: E402
from intelliforce.db.models import *  # noqa: E402, F401, F403  (registra todos os models)
from intelliforce.settings import get_settings  # noqa: E402

# -----------------------------------------------------------------------------
# Alembic config
# -----------------------------------------------------------------------------
config = context.config
settings = get_settings()

# Override URL do alembic.ini pelo valor do .env
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata pra autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Gera SQL puro sem precisar de conexão. Útil pra revisar."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Modo padrão — conecta no banco e aplica migrations."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            # Advisory lock dentro da transação pra evitar race condition
            # entre múltiplos containers tentando migrar ao mesmo tempo
            connection.execute(text("SELECT pg_advisory_xact_lock(42)"))
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
