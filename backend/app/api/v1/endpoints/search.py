from typing import Any, Dict

from app.api import deps
from app.db.instance import db
from app.db.utils import parse_from_mongo
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/", dependencies=[Depends(deps.require_scopes("properties:read"))])
async def search(
    q: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    if not q:
        return {}

    # Simple regex search across multiple collections
    regex = {"$regex": q, "$options": "i"}

    results = {}

    # Search properties
    prop_cursor = db.nekretnine.find(
        {"$or": [{"naziv": regex}, {"adresa": regex}, {"katastarska_opcina": regex}]}
    )
    props = await prop_cursor.to_list(10)
    results["nekretnine"] = [parse_from_mongo(p) for p in props]

    # Search tenants
    tenant_cursor = db.zakupnici.find(
        {"$or": [{"naziv_firme": regex}, {"ime_prezime": regex}, {"oib": regex}]}
    )
    tenants = await tenant_cursor.to_list(10)
    results["zakupnici"] = [parse_from_mongo(t) for t in tenants]

    # Search contracts
    contract_cursor = db.ugovori.find(
        {"$or": [{"interna_oznaka": regex}, {"napomena": regex}]}
    )
    contracts = await contract_cursor.to_list(10)
    results["ugovori"] = [parse_from_mongo(c) for c in contracts]

    return results
