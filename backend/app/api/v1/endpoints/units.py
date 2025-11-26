from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import PropertyUnitStatus
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PropertyUnitUpdate(BaseModel):
    oznaka: Optional[str] = None
    naziv: Optional[str] = None
    kat: Optional[str] = None
    povrsina_m2: Optional[float] = None
    status: Optional[PropertyUnitStatus] = None
    osnovna_zakupnina: Optional[float] = None
    napomena: Optional[str] = None


@router.get("/", dependencies=[Depends(deps.require_scopes("properties:read"))])
async def get_units(
    skip: int = 0,
    limit: int = 100,
    nekretnina_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    query = {}
    if nekretnina_id:
        query["nekretnina_id"] = nekretnina_id

    cursor = db.property_units.find(query).sort("oznaka", 1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.get("/{id}", dependencies=[Depends(deps.require_scopes("properties:read"))])
async def get_unit(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.property_units.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Jedinica nije pronađena")
    return parse_from_mongo(item)


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("properties:update"))])
async def update_unit(
    id: str,
    item_in: PropertyUnitUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.property_units.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Jedinica nije pronađena")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)

    await db.property_units.update_one({"id": id}, {"$set": update_data})

    updated = await db.property_units.find_one({"id": id})
    return parse_from_mongo(updated)


@router.delete(
    "/{id}", dependencies=[Depends(deps.require_scopes("properties:delete"))]
)
async def delete_unit(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.property_units.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Jedinica nije pronađena")

    await db.property_units.delete_one({"id": id})
    return {"poruka": "Jedinica uspješno obrisana"}
