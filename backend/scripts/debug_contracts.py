import asyncio

from app.db.document_store import DocumentRecord
from app.db.instance import session_factory
from sqlalchemy import select


async def main():
    async with session_factory() as session:
        # Get active contracts
        stmt = select(DocumentRecord).where(DocumentRecord.collection == "ugovori")
        result = await session.execute(stmt)
        docs = result.scalars().all()

        print(f"Found {len(docs)} contracts:")
        for doc in docs:
            data = doc.data
            status = data.get("status")
            rent = data.get("osnovna_zakupnina")
            rent_type = type(rent).__name__
            print(
                f"ID: {data.get('id')} | Status: {status} | Rent: {rent} ({rent_type}) | Title: {data.get('interna_oznaka')}"
            )


if __name__ == "__main__":
    asyncio.run(main())
