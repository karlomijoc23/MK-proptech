from typing import Any, Dict

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import (
    TenantMembership,
    TenantMembershipRole,
    TenantMembershipStatus,
)
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class TenantMemberCreate(BaseModel):
    user_id: str
    role: TenantMembershipRole = TenantMembershipRole.MEMBER


@router.post("/{tenant_id}/members", status_code=status.HTTP_201_CREATED)
async def add_tenant_member(
    tenant_id: str,
    member_in: TenantMemberCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Check if current user is admin/owner of the tenant or system admin
    # For MVP, we'll allow system admins or owners
    if current_user["role"] not in ["admin", "owner"]:
        # Ideally check if user is an owner of THIS tenant
        # existing_membership = await db.tenant_memberships.find_one({"tenant_id": tenant_id, "user_id": current_user["id"], "role": "owner"})
        # if not existing_membership:
        raise HTTPException(
            status_code=403, detail="Nemate ovlasti za dodavanje članova"
        )

    # Check if tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Profil nije pronađen")

    # Check if user exists
    user = await db.users.find_one({"id": member_in.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    # Check if membership already exists
    existing = await db.tenant_memberships.find_one(
        {"tenant_id": tenant_id, "user_id": member_in.user_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Korisnik je već član ovog profila")

    membership = TenantMembership(
        user_id=member_in.user_id,
        tenant_id=tenant_id,
        role=member_in.role,
        status=TenantMembershipStatus.ACTIVE,
        invited_by=current_user["id"],
    )

    membership_data = membership.model_dump()
    # Manual datetime conversion if needed, but model_dump usually keeps datetime objects
    # which mongo driver handles or we need to convert to string if using a specific driver wrapper.
    # Our db.utils.prepare_for_mongo handles this? Let's check.
    # Assuming prepare_for_mongo handles it or we do it manually.
    membership_data["created_at"] = membership_data["created_at"].isoformat()
    membership_data["updated_at"] = membership_data["updated_at"].isoformat()

    membership_data = prepare_for_mongo(membership_data)

    await db.tenant_memberships.insert_one(membership_data)

    return parse_from_mongo(membership_data)
