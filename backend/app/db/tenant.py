from __future__ import annotations

import contextvars
from typing import Any, Dict, List, Optional, Set

from app.db.document_store import MariaDBCollection, MariaDBDatabase

CURRENT_TENANT_ID: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_tenant_id", default=None
)

TENANT_SCOPED_COLLECTIONS: Set[str] = {
    "nekretnine",
    "property_units",
    "zakupnici",
    "ugovori",
    "dokumenti",
    "podsjetnici",
    "racuni",
    "maintenance_tasks",
    "activity_logs",
}


def _tenant_filter_clause(tenant_id: str, allow_global: bool = True) -> Dict[str, Any]:
    if allow_global:
        return {"$or": [{"tenant_id": tenant_id}, {"tenant_id": None}]}
    return {"tenant_id": tenant_id}


def _with_tenant_scope(
    query: Optional[Dict[str, Any]],
    tenant_id: str,
    *,
    allow_global: bool = True,
) -> Dict[str, Any]:
    base = query.copy() if query else {}
    scope = _tenant_filter_clause(tenant_id, allow_global)
    if not base:
        return scope
    if "$and" in base:
        base["$and"].append(scope)
        return base
    return {"$and": [base, scope]}


def _backfill_tenant_id(collection, document_id: str, tenant_id: str):
    # This is a background task helper, but for now we'll just define it here
    # It might need to be moved or removed if not used directly
    pass


class TenantAwareCollection:
    def __init__(self, collection: MariaDBCollection, name: str):
        self._collection = collection
        self._name = name

    def _is_scoped(self) -> bool:
        return self._name in TENANT_SCOPED_COLLECTIONS

    def _get_tenant(self) -> Optional[str]:
        return CURRENT_TENANT_ID.get()

    def _allow_global(self, tenant_id: str) -> bool:
        # For now, simple logic: if tenant is set, we might allow global items
        # depending on the collection.
        # The original code had logic here.
        # "users" is not in TENANT_SCOPED_COLLECTIONS, so it's global.
        return True

    def _apply_scope(
        self, query: Optional[Dict[str, Any]], tenant_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        if not self._is_scoped() or not tenant_id:
            return query
        return _with_tenant_scope(query, tenant_id, allow_global=False)

    def _ensure_tenant_on_document(
        self, document: Dict[str, Any], tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        if self._is_scoped() and tenant_id:
            if "tenant_id" not in document:
                document["tenant_id"] = tenant_id
        return document

    def _normalise_update(
        self, update: Optional[Dict[str, Any]], tenant_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        if not update or not self._is_scoped() or not tenant_id:
            return update
        # Ensure we don't overwrite tenant_id with something else
        # or if it's a replacement, ensure tenant_id is there
        if "$set" in update:
            update["$set"]["tenant_id"] = tenant_id
        else:
            # If it's a full replacement (not supported by update_one usually in Mongo but here maybe)
            # But update_one usually takes $set.
            # If update is just a dict without operators, it might be a replacement?
            # The document store implementation expects $set for partial updates.
            pass
        return update

    def __getattr__(self, item: str):
        return getattr(self._collection, item)

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        tenant_id = self._get_tenant()
        scoped_query = self._apply_scope(query, tenant_id)
        return await self._collection.find_one(scoped_query or {})

    def find(self, query: Optional[Dict[str, Any]] = None, *args, **kwargs):
        tenant_id = self._get_tenant()
        scoped_query = self._apply_scope(query, tenant_id)
        return self._collection.find(scoped_query, *args, **kwargs)

    async def insert_one(self, document: Dict[str, Any], *args, **kwargs):
        tenant_id = self._get_tenant()
        print(f"DEBUG: insert_one collection={self._name} tenant_id={tenant_id}")
        doc = self._ensure_tenant_on_document(document, tenant_id)
        return await self._collection.insert_one(doc, *args, **kwargs)

    async def update_one(
        self, query: Dict[str, Any], update: Dict[str, Any], *args, **kwargs
    ):
        tenant_id = self._get_tenant()
        scoped_query = self._apply_scope(query, tenant_id)
        scoped_update = self._normalise_update(update, tenant_id)
        return await self._collection.update_one(
            scoped_query or {}, scoped_update or {}, *args, **kwargs
        )

    async def delete_one(self, query: Dict[str, Any], *args, **kwargs):
        tenant_id = self._get_tenant()
        scoped_query = self._apply_scope(query, tenant_id)
        return await self._collection.delete_one(scoped_query or {}, *args, **kwargs)

    async def delete_many(self, query: Dict[str, Any], *args, **kwargs):
        tenant_id = self._get_tenant()
        scoped_query = self._apply_scope(query, tenant_id)
        return await self._collection.delete_many(scoped_query or {}, *args, **kwargs)

    async def count_documents(
        self, query: Optional[Dict[str, Any]] = None, *args, **kwargs
    ) -> int:
        tenant_id = self._get_tenant()
        scoped_query = self._apply_scope(query, tenant_id)
        return await self._collection.count_documents(scoped_query, *args, **kwargs)

    def aggregate(self, pipeline: List[Dict[str, Any]], *args, **kwargs):
        tenant_id = self._get_tenant()
        # Inject match stage for tenant
        if self._is_scoped() and tenant_id:
            match_stage = {"$match": {"tenant_id": tenant_id}}
            pipeline = [match_stage] + pipeline
        return self._collection.aggregate(pipeline, *args, **kwargs)


class TenantAwareDatabase:
    def __init__(self, db: MariaDBDatabase):
        self._db = db

    def __getattr__(self, item: str) -> TenantAwareCollection:
        return TenantAwareCollection(self._db[item], item)

    def __getitem__(self, item: str) -> TenantAwareCollection:
        return TenantAwareCollection(self._db[item], item)
