import logging
from datetime import date

from app.db.instance import db
from app.models.domain import PropertyUnitStatus, StatusUgovora

logger = logging.getLogger(__name__)


async def sync_contract_and_unit_statuses():
    """
    Synchronizes contract statuses based on dates and updates property unit statuses.
    1. Finds active contracts that have expired (end_date < today) -> Sets to EXPIRED.
    2. For any contract transition to EXPIRED, updates linked unit to AVAILABLE.
    3. (Self-healing) Ensures active contracts have units marked as RENTED.
    """
    logger.info("Starting contract status synchronization...")

    today = date.today()

    # 1. Access collection directly or via some helper? Direct is fine.

    # Find Active contracts where end_date < today
    # Note: ensure dates are stored reliably. If string, we might depend on format.
    # Best practice is to query assuming ISO strings YYYY-MM-DD which sort correctly.

    today_str = today.isoformat()

    # Find active contracts that are theoretically expired
    cursor = db.ugovori.find(
        {"status": StatusUgovora.AKTIVNO, "datum_zavrsetka": {"$lt": today_str}}
    )

    expired_contracts = await cursor.to_list(length=None)
    logger.info(f"Found {len(expired_contracts)} expired contracts to update.")

    for contract in expired_contracts:
        contract_id = contract.get("id")
        unit_id = contract.get("property_unit_id")

        logger.info(
            f"Expiring contract {contract_id} (Ended: {contract.get('datum_zavrsetka')})"
        )

        # Update Contract Status
        await db.ugovori.update_one(
            {"id": contract_id}, {"$set": {"status": StatusUgovora.ISTEKAO}}
        )

        # If there is a linked unit, free it up
        if unit_id:
            logger.info(f"Releasing unit {unit_id} to AVAILABLE.")
            await db.property_units.update_one(
                {"id": unit_id}, {"$set": {"status": PropertyUnitStatus.DOSTUPNO}}
            )

    logger.info("Contract status synchronization completed.")

    # Run self-healing for orphaned units
    await fix_orphaned_rented_units()


async def fix_orphaned_rented_units():
    """
    Finds units marked as RENTED (IZNAJMLJENO) that do NOT have a corresponding ACTIVE contract.
    Sets them back to AVAILABLE (DOSTUPNO).
    """
    logger.info("Starting orphaned unit cleanup...")

    # 1. Get all units that claim to be RENTED
    rented_units_cursor = db.property_units.find(
        {"status": PropertyUnitStatus.IZNAJMLJENO}
    )
    rented_units = await rented_units_cursor.to_list(length=None)

    count_fixed = 0
    for unit in rented_units:
        unit_id = unit.get("id")
        # 2. Check if there is an ACTIVE contract for this unit
        active_contract = await db.ugovori.find_one(
            {"property_unit_id": unit_id, "status": StatusUgovora.AKTIVNO}
        )

        # 3. If no active contract found, fix the status
        if not active_contract:
            logger.warning(
                f"Unit {unit_id} is marked RENTED but has no ACTIVE contract. Fixing to AVAILABLE."
            )
            await db.property_units.update_one(
                {"id": unit_id}, {"$set": {"status": PropertyUnitStatus.DOSTUPNO}}
            )
            count_fixed += 1

    if count_fixed > 0:
        logger.info(f"Fixed {count_fixed} orphaned rented units.")
    else:
        logger.info("No orphaned rented units found.")
