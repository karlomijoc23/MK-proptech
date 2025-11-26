from datetime import date
from typing import Any, Dict, List, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import BillStatus
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class BillCreate(BaseModel):
    broj_racuna: str
    opis: Optional[str] = None
    iznos: float
    valuta: str = "EUR"
    datum_izdavanja: date
    datum_dospijeca: date
    status: BillStatus = BillStatus.DRAFT
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    stavke: List[Dict[str, Any]] = []


@router.get("/", dependencies=[Depends(deps.require_scopes("financials:read"))])
async def get_bills(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.racuni.find().sort("datum_izdavanja", -1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("financials:create"))],
)
async def create_bill(
    item_in: BillCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]

    item_data = prepare_for_mongo(item_data)

    result = await db.racuni.insert_one(item_data)

    new_item = await db.racuni.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.get("/{id}", dependencies=[Depends(deps.require_scopes("financials:read"))])
async def get_bill(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.racuni.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")
    return parse_from_mongo(item)


@router.delete(
    "/{id}", dependencies=[Depends(deps.require_scopes("financials:delete"))]
)
async def delete_bill(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.racuni.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    await db.racuni.delete_one({"id": id})
    return {"poruka": "Račun je uspješno obrisan"}


class BillUpdate(BaseModel):
    broj_racuna: Optional[str] = None
    opis: Optional[str] = None
    iznos: Optional[float] = None
    valuta: Optional[str] = None
    datum_izdavanja: Optional[date] = None
    datum_dospijeca: Optional[date] = None
    status: Optional[BillStatus] = None
    iznos_placen: Optional[float] = None
    placeno_na_dan: Optional[date] = None
    napomena: Optional[str] = None
    stavke: Optional[List[Dict[str, Any]]] = None


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("financials:update"))])
async def update_bill(
    id: str,
    item_in: BillUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.racuni.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)
    await db.racuni.update_one({"id": id}, {"$set": update_data})
    updated = await db.racuni.find_one({"id": id})
    return parse_from_mongo(updated)
