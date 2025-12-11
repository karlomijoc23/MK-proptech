import asyncio
import sys

# Try importing httpx, if fails print error
try:
    import httpx
except ImportError:
    print("httpx not found")
    sys.exit(1)

from app.core.security import create_access_token
from app.db.document_store import DocumentRecord
from app.db.instance import session_factory
from sqlalchemy import select


async def main():
    async with session_factory() as session:
        # Get a user
        stmt = (
            select(DocumentRecord).where(DocumentRecord.collection == "users").limit(1)
        )
        result = await session.execute(stmt)
        user_doc = result.scalars().first()

        if not user_doc:
            print("No user found!")
            return

        user_id = user_doc.data["id"]

        # Create token
        token = create_access_token({"sub": user_id})

    # Make request
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        print("Requesting http://127.0.0.1:8000/api/ugovori/ ...")
        try:
            response = await client.get(
                "http://127.0.0.1:8000/api/ugovori/", headers=headers
            )
            print(f"Status: {response.status_code}")
            print(f"Body: {response.text[:1000]}")
        except Exception as e:
            print(f"Request failed: {repr(e)}")

    print("Script finished.")


if __name__ == "__main__":
    asyncio.run(main())
