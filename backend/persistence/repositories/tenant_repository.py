from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.persistence.models import Tenant, TenantMembership, User


class TenantRepository:
    """Async repository for tenant domain operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, tenant: Tenant) -> Tenant:
        self.session.add(tenant)
        await self.session.flush()
        return tenant

    async def get(self, tenant_id: str) -> Optional[Tenant]:
        return await self.session.get(Tenant, tenant_id)

    async def list_for_user(self, user_id: str) -> List[Tenant]:
        stmt = (
            select(Tenant)
            .join(TenantMembership)
            .where(TenantMembership.user_id == user_id)
            .order_by(Tenant.name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def attach_user(
        self,
        tenant_id: str,
        user: User,
        role: str,
        status: str = "active",
    ) -> TenantMembership:
        membership = TenantMembership(
            tenant_id=tenant_id,
            user_id=user.id,
            role=role,
            status=status,
        )
        self.session.add(membership)
        await self.session.flush()
        return membership
