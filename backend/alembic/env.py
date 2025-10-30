from __future__ import annotations

import asyncio
import logging

from alembic import context
from sqlalchemy.ext.asyncio import AsyncEngine

from backend.persistence import Base, get_engine, get_settings

logger = logging.getLogger(__name__)

# Alembic Config object, provides access to values within the .ini file.
config = context.config

target_metadata = Base.metadata


def get_url() -> str:
    """Construct the database URL from environment settings."""

    settings = get_settings()
    url = settings.sqlalchemy_url()
    logger.info("Using database URL: %s", url)
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""

    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    connectable: AsyncEngine = get_engine()

    async def do_run_migrations() -> None:
        async with connectable.connect() as connection:
            await connection.run_sync(_run_migrations)

    asyncio.run(do_run_migrations())


def _run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )

    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
