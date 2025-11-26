from __future__ import annotations

import uuid
from datetime import datetime
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

import sqlalchemy as sa
from app.db.base import Base
from app.db.query_utils import (
    aggregate_pipeline,
    apply_set,
    deepcopy_document,
    document_matches,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped, mapped_column


class DocumentRecord(Base):
    """Generic JSON document stored per collection."""

    __tablename__ = "document_store"

    collection: Mapped[str] = mapped_column(sa.String(length=64), primary_key=True)
    document_id: Mapped[str] = mapped_column(sa.String(length=64), primary_key=True)
    data: Mapped[Dict[str, Any]] = mapped_column(
        MutableDict.as_mutable(sa.JSON()), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=False),
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=False),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class MariaDBCursor:
    """Lazy cursor that loads documents when consumed."""

    def __init__(
        self,
        collection: "MariaDBCollection",
        query: Optional[Dict[str, Any]],
        pipeline: Optional[List[Dict[str, Any]]] = None,
    ):
        self._collection = collection
        self._query = query
        self._pipeline = pipeline
        self._sort_fields: List[Tuple[str, int]] = []

    def sort(self, key: str, direction: int):
        self._sort_fields.append((key, direction))
        return self

    async def to_list(self, limit: Optional[int]) -> List[Dict[str, Any]]:
        if self._pipeline is not None:
            documents = await self._collection._load_documents(None)
            documents = aggregate_pipeline(documents, self._pipeline)
        else:
            documents = await self._collection._load_documents(self._query)
        for key, direction in self._sort_fields:
            reverse = direction < 0
            documents.sort(
                key=lambda doc: (doc.get(key) is None, doc.get(key)), reverse=reverse
            )
        if limit is None or limit == 0:
            return [deepcopy_document(doc) for doc in documents]
        return [deepcopy_document(doc) for doc in documents[:limit]]


class MariaDBCollection:
    """Collection-like interface backed by the document_store table."""

    def __init__(
        self, name: str, session_factory: async_sessionmaker[AsyncSession]
    ) -> None:
        self._name = name
        self._session_factory = session_factory

    def find(self, query: Optional[Dict[str, Any]] = None) -> MariaDBCursor:
        return MariaDBCursor(self, query, None)

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        documents = await self._load_documents(query)
        if not documents:
            return None
        return deepcopy_document(documents[0])

    async def insert_one(self, document: Dict[str, Any]) -> SimpleNamespace:
        document_id = str(document.get("id") or uuid.uuid4())
        payload = deepcopy_document(document)
        payload.setdefault("id", document_id)
        record = DocumentRecord(
            collection=self._name,
            document_id=document_id,
            data=payload,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        async with self._session_factory() as session:
            session.add(record)
            await session.commit()
        return SimpleNamespace(inserted_id=record.document_id)

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        matched = 0
        modified = 0
        async with self._session_factory() as session:
            records = await self._select_records(session)
            for record in records:
                if document_matches(record.data, query):
                    matched += 1
                    original = deepcopy_document(record.data)
                    if "$set" in update:
                        apply_set(record.data, update["$set"])
                    if record.data != original:
                        record.updated_at = datetime.utcnow()
                        modified += 1
                    await session.commit()
                    break
        return SimpleNamespace(matched_count=matched, modified_count=modified)

    async def delete_one(self, query: Dict[str, Any]):
        deleted = 0
        async with self._session_factory() as session:
            records = await self._select_records(session)
            for record in records:
                if document_matches(record.data, query):
                    await session.delete(record)
                    await session.commit()
                    deleted = 1
                    break
        return SimpleNamespace(deleted_count=deleted)

    async def delete_many(self, query: Dict[str, Any]):
        deleted = 0
        async with self._session_factory() as session:
            records = await self._select_records(session)
            for record in records:
                if document_matches(record.data, query):
                    await session.delete(record)
                    deleted += 1
            if deleted:
                await session.commit()
        return SimpleNamespace(deleted_count=deleted)

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        documents = await self._load_documents(query)
        return len(documents)

    def aggregate(self, pipeline: List[Dict[str, Any]]) -> MariaDBCursor:
        return MariaDBCursor(self, None, pipeline)

    async def _load_documents(
        self, query: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        async with self._session_factory() as session:
            records = await self._select_records(session)
        documents = [
            deepcopy_document(record.data)
            for record in records
            if document_matches(record.data, query)
        ]
        return documents

    async def _select_records(self, session: AsyncSession) -> List[DocumentRecord]:
        stmt = sa.select(DocumentRecord).where(DocumentRecord.collection == self._name)
        result = await session.execute(stmt)
        return list(result.scalars())


class MariaDBDatabase:
    """Expose Mongo-style collections backed by MariaDB."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory
        self._collections: Dict[str, MariaDBCollection] = {}

    def __getattr__(self, item: str) -> MariaDBCollection:
        return self._get_collection(item)

    def __getitem__(self, item: str) -> MariaDBCollection:
        return self._get_collection(item)

    def _get_collection(self, name: str) -> MariaDBCollection:
        if name not in self._collections:
            self._collections[name] = MariaDBCollection(name, self._session_factory)
        return self._collections[name]
