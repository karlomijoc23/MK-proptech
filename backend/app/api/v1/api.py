from app.api.v1.endpoints import (
    ai,
    auth,
    contracts,
    dashboard,
    documents,
    handover_protocols,
    maintenance,
    properties,
    reminders,
    saas_tenants,
    search,
    tenant_members,
    tenants,
    units,
    users,
)
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(properties.router, prefix="/nekretnine", tags=["properties"])
api_router.include_router(tenants.router, prefix="/zakupnici", tags=["tenants"])
api_router.include_router(saas_tenants.router, prefix="/tenants", tags=["saas_tenants"])
api_router.include_router(
    tenant_members.router, prefix="/tenants", tags=["tenant-members"]
)
api_router.include_router(contracts.router, prefix="/ugovori", tags=["contracts"])
api_router.include_router(documents.router, prefix="/dokumenti", tags=["documents"])
api_router.include_router(reminders.router, prefix="/podsjetnici", tags=["reminders"])
api_router.include_router(
    maintenance.router, prefix="/maintenance-tasks", tags=["maintenance"]
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(search.router, prefix="/pretraga", tags=["search"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(units.router, prefix="/units", tags=["units"])
api_router.include_router(
    handover_protocols.router, prefix="/handover-protocols", tags=["handover_protocols"]
)
