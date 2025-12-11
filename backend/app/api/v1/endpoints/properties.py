from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import PropertyUnitStatus, VrstaNekrtnine
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


# Models for requests
class PropertyCreate(BaseModel):
    naziv: str
    adresa: str
    katastarska_opcina: Optional[str] = None
    broj_kat_cestice: Optional[str] = None
    vrsta: VrstaNekrtnine = VrstaNekrtnine.OSTALO
    povrsina: float = 0.0
    godina_izgradnje: Optional[int] = None
    vlasnik: Optional[str] = None
    udio_vlasnistva: Optional[str] = None
    nabavna_cijena: Optional[float] = None
    trzisna_vrijednost: Optional[float] = None
    prosllogodisnji_prihodi: Optional[float] = None
    prosllogodisnji_rashodi: Optional[float] = None
    amortizacija: Optional[float] = None
    neto_prihod: Optional[float] = None
    zadnja_obnova: Optional[str] = None  # Date string
    potrebna_ulaganja: Optional[str] = None
    troskovi_odrzavanja: Optional[float] = None
    osiguranje: Optional[str] = None
    sudski_sporovi: Optional[str] = None
    hipoteke: Optional[str] = None
    napomene: Optional[str] = None
    slika: Optional[str] = None
    financijska_povijest: Optional[list[Dict[str, Any]]] = None
    has_parking: bool = False


class PropertyUpdate(BaseModel):
    naziv: Optional[str] = None
    adresa: Optional[str] = None
    katastarska_opcina: Optional[str] = None
    broj_kat_cestice: Optional[str] = None
    vrsta: Optional[VrstaNekrtnine] = None
    povrsina: Optional[float] = None
    godina_izgradnje: Optional[int] = None
    vlasnik: Optional[str] = None
    udio_vlasnistva: Optional[str] = None
    nabavna_cijena: Optional[float] = None
    trzisna_vrijednost: Optional[float] = None
    prosllogodisnji_prihodi: Optional[float] = None
    prosllogodisnji_rashodi: Optional[float] = None
    amortizacija: Optional[float] = None
    neto_prihod: Optional[float] = None
    zadnja_obnova: Optional[str] = None
    potrebna_ulaganja: Optional[str] = None
    troskovi_odrzavanja: Optional[float] = None
    osiguranje: Optional[str] = None
    sudski_sporovi: Optional[str] = None
    hipoteke: Optional[str] = None
    napomene: Optional[str] = None
    slika: Optional[str] = None
    financijska_povijest: Optional[list[Dict[str, Any]]] = None
    has_parking: Optional[bool] = None


class PropertyUnitCreate(BaseModel):
    oznaka: str
    naziv: str
    kat: Optional[str] = None
    povrsina_m2: float = 0.0
    status: PropertyUnitStatus = PropertyUnitStatus.DOSTUPNO
    osnovna_zakupnina: Optional[float] = None
    napomena: Optional[str] = None


class PropertyOut(PropertyCreate):
    id: str


@router.get(
    "/",
    dependencies=[Depends(deps.require_scopes("properties:read"))],
    response_model=list[PropertyOut],
)
async def get_properties(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.nekretnine.find().sort("created_at", -1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("properties:create"))],
    response_model=PropertyOut,
)
async def create_property(
    item_in: PropertyCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]

    # Prepare for storage
    item_data = prepare_for_mongo(item_data)

    result = await db.nekretnine.insert_one(item_data)

    # Fetch back
    new_item = await db.nekretnine.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.get(
    "/{id}",
    dependencies=[Depends(deps.require_scopes("properties:read"))],
    response_model=PropertyOut,
)
async def get_property(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.nekretnine.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")
    return parse_from_mongo(item)


@router.put(
    "/{id}",
    dependencies=[Depends(deps.require_scopes("properties:update"))],
    response_model=PropertyOut,
)
async def update_property(
    id: str,
    item_in: PropertyUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.nekretnine.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)

    await db.nekretnine.update_one({"id": id}, {"$set": update_data})

    updated = await db.nekretnine.find_one({"id": id})
    return parse_from_mongo(updated)


@router.delete(
    "/{id}", dependencies=[Depends(deps.require_scopes("properties:delete"))]
)
async def delete_property(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.nekretnine.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")

    await db.nekretnine.delete_one({"id": id})
    return {"poruka": "Nekretnina uspješno obrisana"}


@router.post(
    "/{id}/units",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("properties:update"))],
)
async def create_property_unit(
    id: str,
    unit_in: PropertyUnitCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.nekretnine.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")

    unit_data = unit_in.model_dump()
    unit_data["nekretnina_id"] = id
    unit_data["created_by"] = current_user["id"]

    unit_data = prepare_for_mongo(unit_data)

    result = await db.property_units.insert_one(unit_data)

    new_unit = await db.property_units.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_unit)


@router.get(
    "/{id}/units", dependencies=[Depends(deps.require_scopes("properties:read"))]
)
async def get_property_units(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.nekretnine.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")

    cursor = db.property_units.find({"nekretnina_id": id}).sort("oznaka", 1)
    items = await cursor.to_list(None)
    return [parse_from_mongo(item) for item in items]
