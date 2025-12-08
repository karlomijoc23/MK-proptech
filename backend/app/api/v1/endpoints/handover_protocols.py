from datetime import date
from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import HandoverProtocol, ProtocolType
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class ProtocolCreate(BaseModel):
    contract_id: str
    type: ProtocolType
    date: date
    meter_readings: Dict[str, Any] = {}
    keys_handed_over: Optional[str] = None
    notes: Optional[str] = None


class ProtocolUpdate(BaseModel):
    date: Optional[date] = None
    meter_readings: Optional[Dict[str, Any]] = None
    keys_handed_over: Optional[str] = None
    notes: Optional[str] = None


@router.get(
    "/contract/{contract_id}",
    dependencies=[Depends(deps.require_scopes("leases:read"))],
)
async def get_contract_protocols(
    contract_id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.handover_protocols.find({"contract_id": contract_id}).sort("date", -1)
    items = await cursor.to_list(100)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("leases:update"))],
)
async def create_protocol(
    item_in: ProtocolCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Verify contract exists
    contract = await db.ugovori.find_one({"id": item_in.contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    item_data = item_in.model_dump()
    item_data["created_by"] = current_user["id"]

    # Create domain model to validate/defaults
    protocol = HandoverProtocol(**item_data)

    mongo_data = prepare_for_mongo(protocol.model_dump())
    result = await db.handover_protocols.insert_one(mongo_data)

    new_item = await db.handover_protocols.find_one({"id": result.inserted_id})
    return parse_from_mongo(new_item)


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("leases:update"))])
async def update_protocol(
    id: str,
    item_in: ProtocolUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.handover_protocols.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zapisnik nije pronađen")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)
    await db.handover_protocols.update_one({"id": id}, {"$set": update_data})

    updated = await db.handover_protocols.find_one({"id": id})
    return parse_from_mongo(updated)


@router.delete("/{id}", dependencies=[Depends(deps.require_scopes("leases:delete"))])
async def delete_protocol(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.handover_protocols.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zapisnik nije pronađen")

    await db.handover_protocols.delete_one({"id": id})
    return {"poruka": "Zapisnik uspješno obrisan"}
