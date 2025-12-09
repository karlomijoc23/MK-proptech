from datetime import timedelta
from typing import Optional

from app.core.config import get_settings
from app.core.roles import DEFAULT_ROLE, resolve_role_scopes
from app.core.security import create_access_token, hash_password, verify_password
from app.db.instance import db
from app.models.domain import User, UserPublic
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

settings = get_settings()
router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserPublic


@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest):
    from datetime import datetime

    with open("debug_login.txt", "a") as f:
        f.write(
            f"[{datetime.now()}] LOGIN ATTEMPT: email='{login_data.email}', password_len={len(login_data.password)}\n"
        )
        f.write(
            f"Password (first/last): {login_data.password[0]}...{login_data.password[-1]}\n"
        )

    email = login_data.email.lower()
    user_doc = await db.users.find_one({"email": email})

    with open("debug_login.txt", "a") as f:
        f.write(f"User found: {user_doc is not None}\n")
        if user_doc:
            f.write(f"Stored hash: {user_doc.get('password_hash')}\n")
            is_valid = verify_password(
                login_data.password, user_doc.get("password_hash")
            )
            f.write(f"Password valid: {is_valid}\n")

    if not user_doc or not verify_password(
        login_data.password, user_doc.get("password_hash")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neispravan email ili lozinka",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc.get("active", True):
        raise HTTPException(status_code=400, detail="Korisnički račun nije aktivan")

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Resolve scopes
    role = user_doc.get("role", DEFAULT_ROLE)
    scopes = resolve_role_scopes(role, user_doc.get("scopes", []))

    token_payload = {
        "sub": user_doc.get("id"),
        "scopes": scopes,
        "role": role,
        "name": user_doc.get("full_name"),
        "email": user_doc.get("email"),
    }

    access_token = create_access_token(
        data=token_payload, expires_delta=access_token_expires
    )

    # Construct UserPublic
    # We need to handle datetime parsing if they are strings
    # For now, assuming the Pydantic model handles it if we pass the dict,
    # but we might need to parse strings to datetime objects first if strict.
    # Let's do a quick manual parse for critical fields or rely on Pydantic's loose parsing.

    user_public = UserPublic(
        id=user_doc["id"],
        email=user_doc["email"],
        full_name=user_doc.get("full_name"),
        role=role,
        scopes=scopes,
        active=user_doc.get("active", True),
        created_at=user_doc.get("created_at"),  # Pydantic should handle ISO string
        updated_at=user_doc.get("updated_at"),
    )

    return {"access_token": access_token, "token_type": "bearer", "user": user_public}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    create_tenant: bool = True  # Default to True to maintain backward compatibility


@router.post("/register", response_model=UserPublic)
async def register(user_in: RegisterRequest):
    email = user_in.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Korisnik s tom email adresom već postoji",
        )

    user = User(
        email=email,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=DEFAULT_ROLE,
        scopes=[],
    )

    user_data = user.model_dump()
    user_data["created_at"] = user_data["created_at"].isoformat()
    user_data["updated_at"] = user_data["updated_at"].isoformat()

    await db.users.insert_one(user_data)

    # Only create default tenant if requested
    if user_in.create_tenant:
        from app.db.utils import prepare_for_mongo
        from app.models.domain import (
            Tenant,
            TenantMembership,
            TenantMembershipRole,
            TenantMembershipStatus,
        )

        # Default Tenant
        tenant_name = f"Tvrtka korisnika {user.email.split('@')[0]}"
        if user_in.full_name:
            tenant_name = f"Tvrtka korisnika {user_in.full_name}"

        tenant = Tenant(naziv=tenant_name, created_by=user.id)
        tenant_data = tenant.model_dump()
        tenant_data = prepare_for_mongo(tenant_data)

        await db.tenants.insert_one(tenant_data)

        # Default Membership
        membership = TenantMembership(
            user_id=user.id,
            tenant_id=tenant.id,
            role=TenantMembershipRole.OWNER,
            status=TenantMembershipStatus.ACTIVE,
        )
        membership_data = membership.model_dump()
        membership_data = prepare_for_mongo(membership_data)

        await db.tenant_memberships.insert_one(membership_data)

    return UserPublic(**user_data)
