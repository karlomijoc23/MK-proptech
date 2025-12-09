from typing import Any, Dict, List

from app.api import deps
from app.core.roles import resolve_membership_role, resolve_role_scopes, scope_matches
from app.core.security import hash_password
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import User, UserMembershipDisplay, UserPublic
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "viewer"
    scopes: List[str] = []


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=UserPublic)
async def create_user(
    user_in: UserCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Check permissions
    if current_user["role"] not in ["admin", "owner"]:
        # Also check explicit scope
        granted = current_user.get("scopes", [])
        if not scope_matches(granted, "users:create"):
            raise HTTPException(
                status_code=403, detail="Nemate ovlasti za kreiranje korisnika"
            )

    # Check if exists
    email = user_in.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=400, detail="Korisnik s tom email adresom već postoji"
        )

    # Create user
    # Note: We set a default password. In a real app, we'd send an invite email.
    default_password = "TempPass123!"

    user = User(
        email=email,
        full_name=user_in.full_name,
        role=user_in.role,
        scopes=resolve_role_scopes(user_in.role, user_in.scopes),
        password_hash=hash_password(default_password),
    )

    user_data = user.model_dump()
    # Manual conversion for mongo (Pydantic handles this mostly but dates need care if using raw driver)
    user_data = prepare_for_mongo(user_data)

    result = await db.users.insert_one(user_data)
    new_user = await db.users.find_one({"id": result.inserted_id})

    return UserPublic(**parse_from_mongo(new_user))


@router.get("/", dependencies=[Depends(deps.require_scopes("users:read"))])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.users.find().sort("created_at", -1)
    items = await cursor.to_list(limit)

    # Convert to Public and enrich with memberships
    results = []

    # 1. Collect all user IDs
    user_ids = [item["id"] for item in items]

    # 2. Fetch all memberships for these users
    memberships_cursor = db.tenant_memberships.find({"user_id": {"$in": user_ids}})
    all_memberships = await memberships_cursor.to_list(None)

    # 3. Collect tenant IDs and fetch Tenant Names
    tenant_ids = list(set([m["tenant_id"] for m in all_memberships]))
    tenants_cursor = db.tenants.find({"id": {"$in": tenant_ids}})
    all_tenants = await tenants_cursor.to_list(None)
    tenant_map = {t["id"]: t["naziv"] for t in all_tenants}

    # 4. Group memberships by user
    memberships_by_user = {}
    for m in all_memberships:
        uid = m["user_id"]
        if uid not in memberships_by_user:
            memberships_by_user[uid] = []

        t_name = tenant_map.get(m["tenant_id"], "Unknown Tenant")
        memberships_by_user[uid].append(
            UserMembershipDisplay(
                tenant_id=m["tenant_id"], tenant_name=t_name, role=m["role"]
            )
        )

    for item in items:
        user_public = UserPublic(**parse_from_mongo(item))
        user_public.memberships = memberships_by_user.get(item["id"], [])
        results.append(user_public)

    return results


@router.get("/me", response_model=UserPublic)
async def get_me(
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    user_doc = await db.users.find_one({"id": current_user["id"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    return UserPublic(**parse_from_mongo(user_doc))


@router.post(
    "/{id}/assign", dependencies=[Depends(deps.require_scopes("users:assign"))]
)
async def assign_user_to_tenant(
    id: str,
    role: str,  # tenant role
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # This endpoint assigns a user to the current tenant
    # We need to check if the user exists
    user = await db.users.find_one({"id": id})
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Nije odabran tenant")

    membership_role = resolve_membership_role(role)

    # Check if membership exists
    membership = await db.tenant_memberships.find_one(
        {"user_id": id, "tenant_id": tenant_id}
    )

    if membership:
        await db.tenant_memberships.update_one(
            {"id": membership["id"]}, {"$set": {"role": membership_role.value}}
        )
    else:
        await db.tenant_memberships.insert_one(
            {
                "user_id": id,
                "tenant_id": tenant_id,
                "role": membership_role.value,
                "status": "active",
            }
        )

    return {"message": "Korisnik dodijeljen"}


@router.delete("/{id}", response_model=Dict[str, Any])
async def delete_user(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Check permissions
    if current_user["role"] not in ["admin", "owner"]:
        raise HTTPException(
            status_code=403, detail="Nemate ovlasti za brisanje korisnika"
        )

    # Check if user exists
    user = await db.users.find_one({"id": id})
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    # Delete memberships first
    await db.tenant_memberships.delete_many({"user_id": id})

    # Delete user
    await db.users.delete_one({"id": id})

    return {"message": "Korisnik uspješno obrisan"}
