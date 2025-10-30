from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for SQLAlchemy models."""

    pass


@dataclass(frozen=True)
class DatabaseSettings:
    """Settings required to build the SQLAlchemy engine."""

    url: Optional[str] = None
    engine: str = "mariadb+asyncmy"
    host: str = "localhost"
    port: int = 3307
    user: str = "mkproptech"
    password: str = "mkproptech"
    name: str = "mkproptech"
    echo: bool = False
    pool_size: int = 5
    max_overflow: int = 10

    def sqlalchemy_url(self) -> str:
        if self.url:
            return self.url
        return (
            f"{self.engine}://{self.user}:{self.password}@"
            f"{self.host}:{self.port}/{self.name}"
        )


@lru_cache
def get_settings() -> DatabaseSettings:
    """Read settings from environment variables."""

    return DatabaseSettings(
        url=os.getenv("DATABASE_URL"),
        engine=os.getenv("DB_ENGINE", "mariadb+asyncmy"),
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3307")),
        user=os.getenv("DB_USER", "mkproptech"),
        password=os.getenv("DB_PASSWORD", "mkproptech"),
        name=os.getenv("DB_NAME", "mkproptech"),
        echo=os.getenv("DB_ECHO", "false").lower() == "true",
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
    )


_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    """Return a singleton async engine instance."""

    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.sqlalchemy_url(),
            echo=settings.echo,
            pool_size=settings.pool_size,
            max_overflow=settings.max_overflow,
        )
    return _engine


def get_async_session() -> async_sessionmaker[AsyncSession]:
    """Return an async session factory bound to the engine."""

    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def dispose_engine() -> None:
    """Dispose of the engine (used during app shutdown/tests)."""

    global _engine, _session_factory
    if _session_factory is not None:
        _session_factory.close_all()
        _session_factory = None
    if _engine is not None:
        await _engine.dispose()
        _engine = None
