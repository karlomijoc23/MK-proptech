import asyncio

from app.db.document_store import DocumentRecord
from app.db.instance import session_factory
from sqlalchemy import desc, select


async def main():
    async with session_factory() as session:
        # Get last 10 activity logs
        stmt = (
            select(DocumentRecord)
            .where(DocumentRecord.collection == "activity_logs")
            .order_by(desc(DocumentRecord.created_at))
            .limit(10)
        )
        result = await session.execute(stmt)
        logs = result.scalars().all()

        print(f"Found {len(logs)} recent logs:")
        for log in logs:
            data = log.data
            print(
                f"Time: {log.created_at} | Method: {data.get('method')} | "
                f"Path: {data.get('path')} | Status: {data.get('status_code')} | "
                f"User: {data.get('user')} | Role: {data.get('role')} | "
                f"Tenant Request Context: {data.get('tenant_id')}"
            )


if __name__ == "__main__":
    asyncio.run(main())
