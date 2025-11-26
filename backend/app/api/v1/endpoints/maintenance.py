from datetime import date
from typing import Any, Dict, List, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import MaintenancePriority, MaintenanceStatus
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class MaintenanceTaskCreate(BaseModel):
    naziv: str
    opis: Optional[str] = None
    nekretnina_id: Optional[str] = None
    property_unit_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    prijavio_user_id: Optional[str] = None
    dodijeljeno_user_id: Optional[str] = None
    status: MaintenanceStatus = MaintenanceStatus.NOVI
    prioritet: MaintenancePriority = MaintenancePriority.SREDNJE
    datum_prijave: Optional[date] = None
    rok: Optional[date] = None
    trosak_materijal: Optional[float] = None
    trosak_rad: Optional[float] = None
    napomena: Optional[str] = None
    oznake: List[str] = []
    aktivnosti: List[Dict[str, Any]] = []


class MaintenanceTaskUpdate(BaseModel):
    naziv: Optional[str] = None
    opis: Optional[str] = None
    nekretnina_id: Optional[str] = None
    property_unit_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    dodijeljeno_user_id: Optional[str] = None
    status: Optional[MaintenanceStatus] = None
    prioritet: Optional[MaintenancePriority] = None
    rok: Optional[date] = None
    trosak_materijal: Optional[float] = None
    trosak_rad: Optional[float] = None
    napomena: Optional[str] = None
    oznake: Optional[List[str]] = None


class CommentCreate(BaseModel):
    poruka: str
    autor: Optional[str] = None


@router.get("/", dependencies=[Depends(deps.require_scopes("maintenance:read"))])
async def get_maintenance_tasks(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    prioritet: Optional[str] = None,
    nekretnina_id: Optional[str] = None,
    rok_do: Optional[date] = None,
    oznaka: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    query = {}
    if q:
        query["naziv"] = {"$regex": q, "$options": "i"}
    if prioritet:
        query["prioritet"] = prioritet
    if nekretnina_id:
        query["nekretnina_id"] = nekretnina_id
    if rok_do:
        query["rok"] = {"$lte": rok_do.isoformat()}
    if oznaka:
        query["oznake"] = oznaka

    cursor = db.maintenance_tasks.find(query).sort("created_at", -1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("maintenance:create"))],
)
async def create_maintenance_task(
    item_in: MaintenanceTaskCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]
    if not item_data.get("datum_prijave"):
        item_data["datum_prijave"] = date.today().isoformat()

    # Initial activity
    item_data["aktivnosti"] = [
        {
            "tip": "kreiran",
            "opis": "Zadatak kreiran",
            "autor": current_user["name"],
            "timestamp": date.today().isoformat(),  # Should be datetime but keeping simple
        }
    ]

    # Validate relations (simplified)
    if item_data.get("ugovor_id"):
        contract = await db.ugovori.find_one({"id": item_data["ugovor_id"]})
        if not contract:
            raise HTTPException(status_code=400, detail="Ugovor nije pronađen")
        if (
            item_data.get("nekretnina_id")
            and contract.get("nekretnina_id") != item_data["nekretnina_id"]
        ):
            raise HTTPException(
                status_code=400, detail="Ugovor ne pripada odabranoj nekretnini"
            )
        # Infer relations
        if not item_data.get("nekretnina_id"):
            item_data["nekretnina_id"] = contract.get("nekretnina_id")
        if not item_data.get("property_unit_id"):
            item_data["property_unit_id"] = contract.get("property_unit_id")

    if item_data.get("property_unit_id") and item_data.get("nekretnina_id"):
        unit = await db.property_units.find_one({"id": item_data["property_unit_id"]})
        if unit and unit.get("nekretnina_id") != item_data["nekretnina_id"]:
            raise HTTPException(
                status_code=400, detail="Podprostor ne pripada odabranoj nekretnini"
            )

    if item_data.get("dodijeljeno_user_id"):
        assignee = await db.users.find_one({"id": item_data["dodijeljeno_user_id"]})
        if not assignee or assignee.get("role") not in [
            "property_manager",
            "admin",
            "owner",
            "maintenance",
        ]:
            raise HTTPException(
                status_code=400, detail="Voditelj naloga mora imati odgovarajuću ulogu"
            )

    item_data = prepare_for_mongo(item_data)
    result = await db.maintenance_tasks.insert_one(item_data)
    new_item = await db.maintenance_tasks.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.get("/{id}", dependencies=[Depends(deps.require_scopes("maintenance:read"))])
async def get_maintenance_task(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.maintenance_tasks.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Zadatak nije pronađen")
    return parse_from_mongo(item)


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("maintenance:update"))])
async def update_maintenance_task(
    id: str,
    item_in: MaintenanceTaskUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.maintenance_tasks.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zadatak nije pronađen")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)
    await db.maintenance_tasks.update_one({"id": id}, {"$set": update_data})
    updated = await db.maintenance_tasks.find_one({"id": id})
    return parse_from_mongo(updated)


@router.patch(
    "/{id}", dependencies=[Depends(deps.require_scopes("maintenance:update"))]
)
async def patch_maintenance_task(
    id: str,
    item_in: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.maintenance_tasks.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zadatak nije pronađen")

    update_data = item_in

    # Handle status change activity
    if "status" in update_data and update_data["status"] != existing.get("status"):
        activity = {
            "tip": "promjena_statusa",
            "opis": f"Status promijenjen u {update_data['status']}",
            "autor": current_user["name"],
            "timestamp": date.today().isoformat(),
        }
        # We need to push to array, but our simple DB layer might not support $push easily
        # So we read, append, set.
        activities = existing.get("aktivnosti", [])
        activities.append(activity)
        update_data["aktivnosti"] = activities

    update_data = prepare_for_mongo(update_data)
    await db.maintenance_tasks.update_one({"id": id}, {"$set": update_data})
    updated = await db.maintenance_tasks.find_one({"id": id})
    return parse_from_mongo(updated)


@router.post(
    "/{id}/comments", dependencies=[Depends(deps.require_scopes("maintenance:update"))]
)
async def add_comment(
    id: str,
    comment: CommentCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.maintenance_tasks.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zadatak nije pronađen")

    activity = {
        "tip": "komentar",
        "opis": comment.poruka,
        "autor": comment.autor or current_user["name"],
        "timestamp": date.today().isoformat(),
    }

    activities = existing.get("aktivnosti", [])
    activities.append(activity)

    await db.maintenance_tasks.update_one(
        {"id": id}, {"$set": {"aktivnosti": activities}}
    )
    updated = await db.maintenance_tasks.find_one({"id": id})
    return parse_from_mongo(updated)
