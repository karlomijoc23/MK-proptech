import asyncio
import os
import sys

# Set env var BEFORE imports to ensure it picks up SQLite
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./app.db"

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import get_settings  # noqa: E402
from app.core.roles import resolve_role_scopes  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.instance import db  # noqa: E402
from app.db.utils import prepare_for_mongo  # noqa: E402
from app.models.domain import User  # noqa: E402


async def seed_from_env():
    settings = get_settings()

    email = settings.INITIAL_ADMIN_EMAIL
    password = settings.INITIAL_ADMIN_PASSWORD
    full_name = settings.INITIAL_ADMIN_FULL_NAME
    role = settings.INITIAL_ADMIN_ROLE

    print("============================================")
    print("SEEDING FROM ENVIRONMENT")
    print(f"Email:     {email}")
    print(f"Password:  {password}")
    print(f"Name:      {full_name}")
    print(f"Role:      {role}")
    print("============================================")

    if not email or not password:
        print(
            "❌ ERROR: INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set in environment."
        )
        return

    # Check if user exists
    existing = await db.users.find_one({"email": email})

    hashed_pw = hash_password(password)

    user_data = {
        "email": email,
        "full_name": full_name,
        "role": role,
        "scopes": resolve_role_scopes(role, ["*"] if role == "owner" else []),
        "password_hash": hashed_pw,
        "is_active": True,
    }

    if existing:
        print("User exists. Updating credentials...")
        await db.users.update_one({"email": email}, {"$set": user_data})
    else:
        print("User does not exist. Creating...")
        user = User(**user_data)
        await db.users.insert_one(prepare_for_mongo(user.model_dump()))

    print("✅ Admin user seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed_from_env())
