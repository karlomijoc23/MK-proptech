from datetime import date
from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class ReminderCreate(BaseModel):
    naslov: str
    opis: Optional[str] = None
    datum: date
    povezani_entitet_id: Optional[str] = None
    tip_entiteta: Optional[str] = None  # nekretnina, ugovor, zakupnik
    prioritet: str = "srednje"  # nisko, srednje, visoko
    zavrseno: bool = False


@router.get(
    "/", dependencies=[Depends(deps.require_scopes("documents:read"))]
)  # Using documents scope as proxy or need new scope
async def get_reminders(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.podsjetnici.find().sort("datum", 1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.get("/aktivni", dependencies=[Depends(deps.require_scopes("documents:read"))])
async def get_active_reminders(
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Logic for active reminders: not completed
    cursor = db.podsjetnici.find({"zavrseno": False}).sort("datum", 1)
    items = await cursor.to_list(100)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("documents:create"))],
)
async def create_reminder(
    item_in: ReminderCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]

    item_data = prepare_for_mongo(item_data)

    result = await db.podsjetnici.insert_one(item_data)

    new_item = await db.podsjetnici.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.put(
    "/{id}/toggle", dependencies=[Depends(deps.require_scopes("documents:update"))]
)
async def toggle_reminder(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.podsjetnici.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Podsjetnik nije pronađen")

    new_status = not item.get("zavrseno", False)
    await db.podsjetnici.update_one({"id": id}, {"$set": {"zavrseno": new_status}})

    updated = await db.podsjetnici.find_one({"id": id})
    return parse_from_mongo(updated)
