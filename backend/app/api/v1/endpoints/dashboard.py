from typing import Any, Dict

from app.api import deps
from app.db.instance import db
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/", dependencies=[Depends(deps.require_scopes("reports:read"))])
async def get_dashboard_stats(
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Count properties
    total_properties = await db.nekretnine.count_documents()

    # Count active contracts
    active_contracts = await db.ugovori.count_documents({"status": "aktivno"})

    # Count expiring contracts (e.g. status="na_isteku")
    expiring_contracts = await db.ugovori.count_documents({"status": "na_isteku"})

    # Count active reminders
    active_reminders = await db.podsjetnici.count_documents({"zavrseno": False})

    # Calculate monthly income (sum of osnovna_zakupnina from active contracts)
    pipeline = [
        {"$match": {"status": "aktivno"}},
        {"$group": {"_id": None, "total": {"$sum": "$osnovna_zakupnina"}}},
    ]
    cursor = db.ugovori.aggregate(pipeline)
    result = await cursor.to_list(1)
    monthly_income = result[0]["total"] if result else 0.0

    # Calculate portfolio value (sum of trzisna_vrijednost from properties)
    pipeline_value = [
        {"$group": {"_id": None, "total": {"$sum": "$trzisna_vrijednost"}}}
    ]
    cursor_value = db.nekretnine.aggregate(pipeline_value)
    result_value = await cursor_value.to_list(1)
    portfolio_value = result_value[0]["total"] if result_value else 0.0

    # Calculate actual annual yield (sum of neto_prihod from properties)
    # If neto_prihod is not set, we could approximate it from monthly_income * 12
    pipeline_yield = [{"$group": {"_id": None, "total": {"$sum": "$neto_prihod"}}}]
    cursor_yield = db.nekretnine.aggregate(pipeline_yield)
    result_yield = await cursor_yield.to_list(1)
    annual_yield = result_yield[0]["total"] if result_yield else 0.0

    # Fallback for annual yield if properties don't have neto_prihod set
    if annual_yield == 0 and monthly_income > 0:
        annual_yield = monthly_income * 12

    # Calculate ROI percentage
    roi_percentage = 0.0
    if portfolio_value > 0:
        roi_percentage = (annual_yield / portfolio_value) * 100

    return {
        "ukupno_nekretnina": total_properties,
        "aktivni_ugovori": active_contracts,
        "ugovori_na_isteku": expiring_contracts,
        "aktivni_podsjetnici": active_reminders,
        "mjesecni_prihod": monthly_income,
        "ukupna_vrijednost_portfelja": portfolio_value,
        "godisnji_prinos": annual_yield,
        "prinos_postotak": round(roi_percentage, 2),
    }
