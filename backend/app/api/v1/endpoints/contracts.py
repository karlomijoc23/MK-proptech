from datetime import date, datetime
from typing import Any, Dict, Optional

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import PropertyUnitStatus, StatusUgovora
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
    osnovna_zakupnina: float = 0
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


async def check_contract_overlap(
    unit_id: str,
    start_date: date,
    end_date: date,
    exclude_contract_id: Optional[str] = None,
):
    """
    Check if there is any active contract for the given unit in the given time range.
    Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    """
    if not unit_id:
        return

    # Convert dates to datetime for MongoDB comparison if they are stored as datetime
    # But schema says date. Prepare_for_mongo might convert them to datetime or str.
    # Looking at other files, it seems Prepare_for_mongo handles conversions.
    # For query, we should use the same format as stored.
    # Assuming stored as ISO strings or datetime objects.
    # Let's try string comparison which works for ISO dates, or native objects.
    # To be safe, we query where status is ACTIVE or NA_ISTEKU.

    query = {
        "property_unit_id": unit_id,
        "status": {"$in": [StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU]},
        "$or": [
            # New start is between existing start and end
            {
                "datum_pocetka": {"$lte": end_date.isoformat()},
                "datum_zavrsetka": {"$gte": start_date.isoformat()},
            }
        ],
    }

    if exclude_contract_id:
        query["id"] = {"$ne": exclude_contract_id}

    overlap = await db.ugovori.find_one(query)
    if overlap:
        raise HTTPException(
            status_code=400,
            detail=f"Postoji preklapanje s ugovorom {overlap.get('interna_oznaka')} za ovaj period.",
        )


async def calculate_rent_if_needed(item_data: dict):
    """
    Calculate basic rent from rent_per_m2 if basic rent is 0 or missing,
    and we have unit surface area.
    """
    if (
        item_data.get("zakupnina_po_m2")
        and item_data.get("osnovna_zakupnina", 0) == 0
        and item_data.get("property_unit_id")
    ):
        unit = await db.property_units.find_one({"id": item_data["property_unit_id"]})
        if unit and unit.get("povrsina_m2"):
            item_data["osnovna_zakupnina"] = (
                item_data["zakupnina_po_m2"] * unit["povrsina_m2"]
            )
    return item_data


@router.get("/", dependencies=[Depends(deps.require_scopes("leases:read"))])
async def get_contracts(
    skip: int = 0,
    limit: int = 100,
    nekretnina_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    query = {}
    if nekretnina_id:
        query["nekretnina_id"] = nekretnina_id

    cursor = db.ugovori.find(query).sort("created_at", -1)

    # MariaDBCursor doesn't support skip/limit chaining, so we handle it here
    fetch_limit = skip + limit if limit else None
    items = await cursor.to_list(fetch_limit)

    if skip:
        items = items[skip:]

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

    # 1. Check Overlap
    if item_data.get("property_unit_id"):
        await check_contract_overlap(
            item_data["property_unit_id"],
            item_data["datum_pocetka"],
            item_data["datum_zavrsetka"],
        )

    # 2. Financial Logic
    item_data = await calculate_rent_if_needed(item_data)

    item_data["created_by"] = current_user["id"]
    item_data = prepare_for_mongo(item_data)

    result = await db.ugovori.insert_one(item_data)

    # 3. Status Sync (Update Unit)
    # If contract is active, set unit to RENTED
    if item_data.get("status") == StatusUgovora.AKTIVNO and item_data.get(
        "property_unit_id"
    ):
        await db.property_units.update_one(
            {"id": item_data["property_unit_id"]},
            {"$set": {"status": PropertyUnitStatus.IZNAJMLJENO}},
        )

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

    # Prepare complete data for validation (merge existing with update)
    # We need dates and unit_id to check overlap
    merged_data = {**existing, **update_data}

    # Convert string dates back to date objects if needed for overlap check helper
    # (The helper expects date objects, but existing data from mongo might be strings or datetimes)
    # We'll rely on the helper to handle query params, but we need date objects for arguments.
    # Simplest is to parse them:

    def parse_date(d):
        if isinstance(d, str):
            try:
                return datetime.strptime(d, "%Y-%m-%d").date()
            except ValueError:
                return datetime.fromisoformat(d).date()
        return d

    # 1. Check Overlap
    if (
        "datum_pocetka" in update_data
        or "datum_zavrsetka" in update_data
        or "property_unit_id" in update_data
    ):
        unit_id = merged_data.get("property_unit_id")
        start = parse_date(merged_data.get("datum_pocetka"))
        end = parse_date(merged_data.get("datum_zavrsetka"))

        if unit_id and start and end:
            await check_contract_overlap(unit_id, start, end, exclude_contract_id=id)

    # 2. Financial Logic
    # We only recalculate if unit or price changed significantly, or if specifically requested?
    # Let's apply valid logic: if update contains both unit and price/m2, we recalc.
    # Or if update contains price/m2 but not total price.
    if "zakupnina_po_m2" in update_data and "osnovna_zakupnina" not in update_data:
        # User updated price per m2, let's update total
        # We need to act on the merged dict but only update what's changed
        temp_merged = {**existing, **update_data}
        temp_merged = await calculate_rent_if_needed(temp_merged)
        if temp_merged["osnovna_zakupnina"] != existing.get("osnovna_zakupnina"):
            update_data["osnovna_zakupnina"] = temp_merged["osnovna_zakupnina"]

    mongo_update_data = prepare_for_mongo(update_data)

    await db.ugovori.update_one({"id": id}, {"$set": mongo_update_data})

    # 3. Status Sync
    # If status changed to ACTIVE -> Set Unit to RENTED
    # If status changed to ENDED/ARCHIVED -> Set Unit to AVAILABLE
    new_status = update_data.get("status")
    unit_id = merged_data.get("property_unit_id")

    if new_status and unit_id:
        if new_status == StatusUgovora.AKTIVNO:
            await db.property_units.update_one(
                {"id": unit_id},
                {"$set": {"status": PropertyUnitStatus.IZNAJMLJENO}},
            )
        elif new_status in [
            StatusUgovora.RASKINUTO,
            StatusUgovora.ARHIVIRANO,
            StatusUgovora.ISTEKAO,
        ]:
            await db.property_units.update_one(
                {"id": unit_id},
                {"$set": {"status": PropertyUnitStatus.DOSTUPNO}},
            )

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


class ContractStatusUpdate(BaseModel):
    novi_status: StatusUgovora


@router.put(
    "/{id}/status", dependencies=[Depends(deps.require_scopes("leases:update"))]
)
async def update_contract_status(
    id: str,
    status_update: ContractStatusUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.ugovori.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    await db.ugovori.update_one(
        {"id": id}, {"$set": {"status": status_update.novi_status}}
    )

    # Sync Unit Status if exists
    if existing.get("property_unit_id"):
        unit_id = existing["property_unit_id"]
        if status_update.novi_status == StatusUgovora.AKTIVNO:
            await db.property_units.update_one(
                {"id": unit_id},
                {"$set": {"status": PropertyUnitStatus.IZNAJMLJENO}},
            )
        elif status_update.novi_status in [
            StatusUgovora.RASKINUTO,
            StatusUgovora.ARHIVIRANO,
            StatusUgovora.ISTEKAO,
        ]:
            await db.property_units.update_one(
                {"id": unit_id},
                {"$set": {"status": PropertyUnitStatus.DOSTUPNO}},
            )

    updated = await db.ugovori.find_one({"id": id})
    return parse_from_mongo(updated)
