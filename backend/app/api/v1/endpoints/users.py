from typing import Any, Dict, List, Optional

from app.api import deps
from app.core.roles import resolve_membership_role, resolve_role_scopes, scope_matches
from app.core.security import hash_password
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import User, UserPublic
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "viewer"
    scopes: List[str] = []


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    scopes: Optional[List[str]] = None
    active: Optional[bool] = None


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
    # Convert to UserPublic to hide password hash
    return [UserPublic(**parse_from_mongo(item)) for item in items]


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
