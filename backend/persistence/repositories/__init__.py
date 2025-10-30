"""Repository interfaces for the MariaDB-backed persistence layer."""

from typing import Protocol, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from .tenant_repository import TenantRepository

ModelT = TypeVar("ModelT")


class Repository(Protocol[ModelT]):
    """Base protocol for repository implementations."""

    session: AsyncSession

    async def add(self, entity: ModelT) -> ModelT: ...

    async def get(self, entity_id: str) -> ModelT | None: ...


__all__ = ["TenantRepository"]
