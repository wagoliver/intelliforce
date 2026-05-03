"""Base do SQLAlchemy: engine async, session factory, declarative base."""
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from intelliforce.settings import get_settings

# -----------------------------------------------------------------------------
# Engine async (asyncpg)
# -----------------------------------------------------------------------------
settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False,  # True pra debug SQL
)

# Session factory async
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# -----------------------------------------------------------------------------
# Declarative base com convenção de nomes consistente
# -----------------------------------------------------------------------------
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base pra todos os models do projeto."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map: dict[type[Any], Any] = {}


# -----------------------------------------------------------------------------
# Dependency pra FastAPI / context manager pra workers
# -----------------------------------------------------------------------------
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields uma session async. Uso típico: dependency injection no FastAPI."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
