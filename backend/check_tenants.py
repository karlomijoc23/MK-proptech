import asyncio
import os
import sys

# Set env var BEFORE imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./app.db"

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import get_settings  # noqa: E402
from app.db.instance import db  # noqa: E402


async def check_tenants():
    settings = get_settings()
    print("Checking tenants...")

    tenants = await db.tenants.find().to_list(100)
    print(f"Found {len(tenants)} tenants.")

    for t in tenants:
        print(f" - {t.get('id')} ({t.get('naziv')})")

    if not tenants:
        print("No tenants found. Creating default tenant...")
        default_tenant = {
            "id": settings.DEFAULT_TENANT_ID,
            "naziv": settings.DEFAULT_TENANT_NAME,
            "status": "active",
        }
        await db.tenants.insert_one(default_tenant)
        print(f"Created tenant: {default_tenant['id']}")

        # Also ensure admin is a member?
        # The backend logic for get_my_tenants currently returns ALL tenants and injects global role.
        # So membership might not be strictly required for the list, but good to have.

        # Let's find the admin user
        admin = await db.users.find_one({"email": "karlo.mijoc@pm.me"})
        if admin:
            print(f"Adding admin {admin['email']} to tenant...")
            membership = {
                "user_id": admin["id"],
                "tenant_id": settings.DEFAULT_TENANT_ID,
                "role": "owner",
                "status": "active",
            }
            await db.tenant_memberships.insert_one(membership)
            print("Membership created.")

    print("Done.")


if __name__ == "__main__":
    asyncio.run(check_tenants())
