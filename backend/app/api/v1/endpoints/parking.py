from datetime import datetime
from typing import Any, Dict, List, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import ParkingSpace
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ParkingSpaceCreate(BaseModel):
    nekretnina_id: str
    tenant_id: Optional[str] = None
    floor: str
    internal_id: str
    vehicle_plates: List[str] = []
    notes: Optional[str] = None


class ParkingSpaceUpdate(BaseModel):
    nekretnina_id: Optional[str] = None
    tenant_id: Optional[str] = None
    floor: Optional[str] = None
    internal_id: Optional[str] = None
    vehicle_plates: Optional[List[str]] = None
    notes: Optional[str] = None


@router.get("", response_model=List[ParkingSpace])
async def get_parking_spaces(
    nekretnina_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve parking spaces, optionally filtered by property.
    """
    query = {}
    if nekretnina_id:
        query["nekretnina_id"] = nekretnina_id

    cursor = db.parking_spaces.find(query)
    spaces = await cursor.to_list(None)
    return [parse_from_mongo(space) for space in spaces]


@router.post("", response_model=ParkingSpace)
async def create_parking_space(
    space_in: ParkingSpaceCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new parking space.
    """
    # Convert to domain model to generate IDs/timestamps
    space = ParkingSpace(**space_in.model_dump())

    space_data = space.model_dump()
    space_data["created_by"] = current_user["id"]

    # Prepare for storage
    space_data = prepare_for_mongo(space_data)

    await db.parking_spaces.insert_one(space_data)

    # Return as Pydantic model
    return parse_from_mongo(space_data)


@router.put("/{space_id}", response_model=ParkingSpace)
async def update_parking_space(
    space_id: str,
    space_update: ParkingSpaceUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
) -> Any:
    """
    Update a parking space.
    """
    existing = await db.parking_spaces.find_one({"id": space_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Parking space not found")

    # Limit to max 2 plates if provided
    if space_update.vehicle_plates is not None and len(space_update.vehicle_plates) > 2:
        raise HTTPException(
            status_code=400, detail="Maximum 2 vehicle plates allowed per space"
        )

    update_data = space_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    update_data = prepare_for_mongo(update_data)

    await db.parking_spaces.update_one({"id": space_id}, {"$set": update_data})

    updated = await db.parking_spaces.find_one({"id": space_id})
    return parse_from_mongo(updated)


@router.delete("/{space_id}")
async def delete_parking_space(
    space_id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a parking space.
    """
    result = await db.parking_spaces.delete_one({"id": space_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Parking space not found")
    return {"status": "success"}
