from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import ZakupnikStatus, ZakupnikTip
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class TenantCreate(BaseModel):
    naziv_firme: Optional[str] = None
    ime_prezime: Optional[str] = None
    oib: str
    adresa: Optional[str] = None
    sjediste: Optional[str] = None
    kontakt_ime: Optional[str] = None
    kontakt_email: Optional[str] = None
    kontakt_telefon: Optional[str] = None
    iban: Optional[str] = None
    status: ZakupnikStatus = ZakupnikStatus.AKTIVAN
    tip: ZakupnikTip = ZakupnikTip.ZAKUPNIK
    napomena: Optional[str] = None


class TenantUpdate(BaseModel):
    naziv_firme: Optional[str] = None
    ime_prezime: Optional[str] = None
    oib: Optional[str] = None
    adresa: Optional[str] = None
    sjediste: Optional[str] = None
    kontakt_ime: Optional[str] = None
    kontakt_email: Optional[str] = None
    kontakt_telefon: Optional[str] = None
    iban: Optional[str] = None
    status: Optional[ZakupnikStatus] = None
    tip: Optional[ZakupnikTip] = None
    napomena: Optional[str] = None


@router.get("/", dependencies=[Depends(deps.require_scopes("tenants:read"))])
async def get_tenants(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    query = {}
    if search:
        regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"naziv_firme": regex},
            {"kontakt_email": regex},
            {"oib": regex},
        ]

    cursor = db.zakupnici.find(query).sort("created_at", -1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("tenants:create"))],
)
async def create_tenant(
    item_in: TenantCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]

    item_data = prepare_for_mongo(item_data)

    result = await db.zakupnici.insert_one(item_data)

    new_item = await db.zakupnici.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.get("/{id}", dependencies=[Depends(deps.require_scopes("tenants:read"))])
async def get_tenant(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.zakupnici.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Zakupnik nije pronađen")
    return parse_from_mongo(item)


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("tenants:update"))])
async def update_tenant(
    id: str,
    item_in: TenantUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.zakupnici.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zakupnik nije pronađen")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)

    await db.zakupnici.update_one({"id": id}, {"$set": update_data})

    updated = await db.zakupnici.find_one({"id": id})
    return parse_from_mongo(updated)


@router.delete("/{id}", dependencies=[Depends(deps.require_scopes("tenants:delete"))])
async def delete_tenant(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.zakupnici.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zakupnik nije pronađen")

    await db.zakupnici.delete_one({"id": id})
    return {"poruka": "Zakupnik uspješno obrisan"}
