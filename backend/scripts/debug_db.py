import asyncio

from app.db.document_store import DocumentRecord
from app.db.instance import session_factory
from sqlalchemy import select


async def main():
    print("Connecting to DB...")
    async with session_factory() as session:
        # Get one property
        stmt = (
            select(DocumentRecord)
            .where(DocumentRecord.collection == "nekretnine")
            .limit(1)
        )
        result = await session.execute(stmt)
        doc = result.scalars().first()
        if doc:
            print(f"Property ID: {doc.document_id}")
            print(f"Data: {doc.data}")
            print(f"Tenant ID: {doc.data.get('tenant_id')}")
        else:
            print("No properties found.")


if __name__ == "__main__":
    asyncio.run(main())
