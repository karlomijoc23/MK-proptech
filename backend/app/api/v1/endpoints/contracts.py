from datetime import date
from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import StatusUgovora
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class ContractCreate(BaseModel):
    interna_oznaka: str
    nekretnina_id: str
    zakupnik_id: str
    property_unit_id: Optional[str] = None
    datum_potpisivanja: Optional[date] = None
    datum_pocetka: date
    datum_zavrsetka: date
    trajanje_mjeseci: int
    opcija_produljenja: bool = False
    uvjeti_produljenja: Optional[str] = None
    rok_otkaza_dani: Optional[int] = None
    osnovna_zakupnina: float
    zakupnina_po_m2: Optional[float] = None
    cam_troskovi: Optional[float] = None
    polog_depozit: Optional[float] = None
    garancija: Optional[float] = None
    indeksacija: bool = False
    indeks: Optional[str] = None
    formula_indeksacije: Optional[str] = None
    obveze_odrzavanja: Optional[str] = None
    namjena_prostora: Optional[str] = None
    rezije_brojila: Optional[str] = None
    status: StatusUgovora = StatusUgovora.AKTIVNO
    napomena: Optional[str] = None


class ContractUpdate(BaseModel):
    interna_oznaka: Optional[str] = None
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    property_unit_id: Optional[str] = None
    datum_potpisivanja: Optional[date] = None
    datum_pocetka: Optional[date] = None
    datum_zavrsetka: Optional[date] = None
    trajanje_mjeseci: Optional[int] = None
    opcija_produljenja: Optional[bool] = None
    uvjeti_produljenja: Optional[str] = None
    rok_otkaza_dani: Optional[int] = None
    osnovna_zakupnina: Optional[float] = None
    zakupnina_po_m2: Optional[float] = None
    cam_troskovi: Optional[float] = None
    polog_depozit: Optional[float] = None
    garancija: Optional[float] = None
    indeksacija: Optional[bool] = None
    indeks: Optional[str] = None
    formula_indeksacije: Optional[str] = None
    obveze_odrzavanja: Optional[str] = None
    namjena_prostora: Optional[str] = None
    rezije_brojila: Optional[str] = None
    status: Optional[StatusUgovora] = None
    napomena: Optional[str] = None


@router.get("/", dependencies=[Depends(deps.require_scopes("leases:read"))])
async def get_contracts(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.ugovori.find().sort("created_at", -1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("leases:create"))],
)
async def create_contract(
    item_in: ContractCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]

    item_data = prepare_for_mongo(item_data)

    result = await db.ugovori.insert_one(item_data)

    new_item = await db.ugovori.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.get("/{id}", dependencies=[Depends(deps.require_scopes("leases:read"))])
async def get_contract(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.ugovori.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
    return parse_from_mongo(item)


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("leases:update"))])
async def update_contract(
    id: str,
    item_in: ContractUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.ugovori.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)

    await db.ugovori.update_one({"id": id}, {"$set": update_data})

    updated = await db.ugovori.find_one({"id": id})
    return parse_from_mongo(updated)


@router.delete("/{id}", dependencies=[Depends(deps.require_scopes("leases:delete"))])
async def delete_contract(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.ugovori.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    await db.ugovori.delete_one({"id": id})
    return {"poruka": "Ugovor uspješno obrisan"}
