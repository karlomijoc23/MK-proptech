from datetime import timedelta

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
    email = login_data.email.lower()
    user_doc = await db.users.find_one({"email": email})

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


@router.post("/register", response_model=UserPublic)
async def register(user_in: LoginRequest):  # Reusing LoginRequest for simple email/pass
    # In a real app we'd have a RegisterRequest with full name etc.
    # The original code had a /register endpoint? Let's check server.py.
    # server.py had /api/auth/register

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
        role=DEFAULT_ROLE,
        scopes=[],
    )

    # We need to prepare for mongo (enums to values, dates to strings)
    # I should import prepare_for_mongo from somewhere.
    # I'll add it to app/db/utils.py later.
    # For now, I'll just dump the model which gives correct types,
    # but the DB layer expects JSON compatible types (ISO strings for dates).

    user_data = user.model_dump()
    # Manual conversion for now
    user_data["created_at"] = user_data["created_at"].isoformat()
    user_data["updated_at"] = user_data["updated_at"].isoformat()

    await db.users.insert_one(user_data)

    return UserPublic(**user_data)
