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

        # In a real app, we'd filter by user membership.
        # For now, we return all tenants.
        cursor = db.tenants.find()
        items = await cursor.to_list(100)

        with open("debug_tenants.txt", "a") as f:
            f.write(f"Fetched {len(items)} tenants from DB\n")

        results = []
        for item in items:
            data = parse_from_mongo(item)
            # Inject the user's global role as their role in this tenant
            # This is a simplification. In a real SaaS, we'd look up the user's membership for this tenant.
            data["role"] = current_user.get("role", "member")
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
