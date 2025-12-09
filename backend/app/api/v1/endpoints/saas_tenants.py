from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class TenantUpdate(BaseModel):
    naziv: Optional[str] = None
    status: Optional[str] = None


class TenantCreate(BaseModel):
    naziv: str
    status: str = "active"


@router.get("/")
async def get_my_tenants(
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    try:
        with open("debug_tenants.txt", "a") as f:
            f.write(f"GET /tenants called by {current_user.get('email')}\n")

        if current_user["role"] in ["admin", "owner"]:
            # Admins see all tenants
            cursor = db.tenants.find()
            items = await cursor.to_list(100)

            with open("debug_tenants.txt", "a") as f:
                f.write(f"Fetched {len(items)} tenants from DB (Admin Access)\n")

            results = []
            for item in items:
                data = parse_from_mongo(item)
                data["role"] = current_user.get("role", "member")
                results.append(data)
            return results
        else:
            # Regular users see only their assigned tenants
            memberships_cursor = db.tenant_memberships.find(
                {"user_id": current_user["id"]}
            )
            memberships = await memberships_cursor.to_list(None)

            if not memberships:
                return []

            tenant_ids = [m["tenant_id"] for m in memberships]
            # Create a map of tenant_id -> role for easy lookup
            role_map = {m["tenant_id"]: m["role"] for m in memberships}

            tenants_cursor = db.tenants.find({"id": {"$in": tenant_ids}})
            items = await tenants_cursor.to_list(None)

            with open("debug_tenants.txt", "a") as f:
                f.write(f"Fetched {len(items)} tenants for user {current_user['id']}\n")

            results = []
            for item in items:
                data = parse_from_mongo(item)
                # Inject the specific membership role
                data["role"] = role_map.get(data["id"], "member")
                results.append(data)
            return results
    except Exception as e:
        import traceback

        error_msg = traceback.format_exc()
        with open("debug_tenants.txt", "a") as f:
            f.write(f"ERROR in get_my_tenants: {str(e)}\n{error_msg}\n")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_tenant(
    item_in: TenantCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Only admin can create tenants
    if current_user["role"] not in ["admin", "owner"]:
        print(
            f"DEBUG: Access denied for role {current_user.get('role')} (User: {current_user.get('email')})"
        )
        raise HTTPException(status_code=403, detail="Nemate ovlasti za ovu radnju")

    item_data = item_in.model_dump()
    item_data = prepare_for_mongo(item_data)
    result = await db.tenants.insert_one(item_data)
    new_item = await db.tenants.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.get("/{id}")
async def get_tenant(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.tenants.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return parse_from_mongo(item)


@router.put("/{id}")
async def update_tenant(
    id: str,
    item_in: TenantUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    if current_user["role"] not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Nemate ovlasti za ovu radnju")

    existing = await db.tenants.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)
    await db.tenants.update_one({"id": id}, {"$set": update_data})
    updated = await db.tenants.find_one({"id": id})
    return parse_from_mongo(updated)


@router.delete("/{id}")
async def delete_tenant(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Only admin or owner can delete tenants
    # In a real SAAS, usually only System Admin can ignore tenant context.
    # Or the owner of the tenant.

    # Check if tenant exists
    tenant = await db.tenants.find_one({"id": id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Profil nije pronađen")

    # Permission check:
    # 1. System Admin (role=admin/owner on User level?)
    # OR
    # 2. Owner of this specific tenant.

    # For now, let's use the current_user role check as a simple gatekeeper
    # assuming 'owner' means they own the platform or are high privilege.
    if current_user["role"] not in ["admin", "owner"]:
        # Fallback: check if they are an owner member of THIS tenant
        # We need to query tenant_memberships
        membership = await db.tenant_memberships.find_one(
            {"tenant_id": id, "user_id": current_user["id"], "role": "owner"}
        )
        if not membership:
            raise HTTPException(
                status_code=403, detail="Nemate ovlasti za brisanje ovog profila"
            )

    # Proceed with deletion
    # 1. Delete associated memberships
    await db.tenant_memberships.delete_many({"tenant_id": id})

    # 2. Delete the tenant
    await db.tenants.delete_one({"id": id})

    return {"message": "Profil uspješno obrisan"}
