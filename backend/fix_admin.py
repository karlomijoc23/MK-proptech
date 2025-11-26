import asyncio
import os
import sys

# Set env var BEFORE imports to ensure it picks up SQLite
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./app.db"

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))


from app.core.roles import resolve_role_scopes  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.instance import db  # noqa: E402
from app.db.utils import prepare_for_mongo  # noqa: E402
from app.models.domain import User  # noqa: E402


async def fix_admin():

    email = "admin@example.com"
    password = "AdminPass123!"

    print("Fixing admin user...")
    print(f"Target Email: {email}")
    print(f"Target Password: {password}")

    # Check if user exists
    existing = await db.users.find_one({"email": email})

    hashed_pw = hash_password(password)

    user_data = {
        "email": email,
        "full_name": "System Admin",
        "role": "owner",
        "scopes": resolve_role_scopes("owner", ["*"]),
        "password_hash": hashed_pw,
        "is_active": True,
    }

    if existing:
        print("User exists. Updating password...")
        await db.users.update_one({"email": email}, {"$set": user_data})
    else:
        print("User does not exist. Creating...")
        # We need to use the model to validate/prepare, but we can just insert the dict for now if we are careful
        # Better to use the User model
        user = User(**user_data)
        await db.users.insert_one(prepare_for_mongo(user.model_dump()))

    print("✅ Admin user fixed successfully.")
    print("============================================")
    print(f"LOGIN EMAIL:    {email}")
    print(f"LOGIN PASSWORD: {password}")
    print("============================================")


if __name__ == "__main__":
    # Ensure we use the same DB URL as the running server
    if "DATABASE_URL" not in os.environ:
        os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./app.db"

    asyncio.run(fix_admin())
