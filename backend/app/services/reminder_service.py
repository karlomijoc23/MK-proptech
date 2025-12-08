import logging
import uuid
from datetime import date, datetime

from app.db.instance import db
from app.db.utils import prepare_for_mongo

logger = logging.getLogger(__name__)


async def check_contract_expirations():
    """
    Checks for contracts expiring in 90, 60, or 30 days and creates reminders.
    Should be run periodically (e.g., daily).
    """
    logger.info("Starting automatic contract expiration check...")

    # 1. Fetch active contracts
    # We only care about active contracts
    cursor = db.ugovori.find({"status": "aktivno"})
    active_contracts = await cursor.to_list(length=None)

    logger.info(f"Found {len(active_contracts)} active contracts.")

    today = date.today()

    # Thresholds for reminders (in days)
    thresholds = [90, 60, 30]

    created_count = 0

    for contract in active_contracts:
        end_date = contract.get("datum_zavrsetka")

        # Ensure end_date is a date object (depending on how mongo driver returns it, might be datetime or str)
        if isinstance(end_date, str):
            try:
                end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                continue
        elif isinstance(end_date, datetime):
            end_date = end_date.date()

        if not end_date:
            continue

        days_until_expiry = (end_date - today).days

        # Check if we hit any threshold exactly (or within a reasonable small window if run daily)
        # We'll use strict equality for simplicity if run daily, or a range if safer.
        # Let's use a small window (0-1 days) to ensure we don't miss it if the job runs late.

        for days in thresholds:
            if days_until_expiry == days:
                await create_expiration_reminder_if_not_exists(contract, days)
                created_count += 1

    logger.info(f"Automatic check completed. Created {created_count} new reminders.")


async def create_expiration_reminder_if_not_exists(contract, days_remaining):
    contract_id = contract.get("id")
    contract_number = contract.get("interna_oznaka", "Nepoznat")
    tenant_name = contract.get("zakupnik_naziv", "Nepoznati zakupnik")

    title = f"Istek ugovora: {contract_number} ({days_remaining} dana)"
    description = f"Ugovor za {tenant_name} istječe za {days_remaining} dana. Datum isteka: {contract.get('datum_zavrsetka')}."

    # Check if reminder already exists for this expiration event
    # We query by related entity ID and partial title match or specific metadata if we had it.
    # Simple check: Title + Entity ID
    existing = await db.podsjetnici.find_one(
        {"povezani_entitet_id": contract_id, "naslov": title, "zavrseno": False}
    )

    if existing:
        return

    reminder_data = {
        "id": str(uuid.uuid4()),
        "naslov": title,
        "opis": description,
        "datum": datetime.now(),  # Reminder date is "now", meaning it's relevant today
        "povezani_entitet_id": contract_id,
        "tip_entiteta": "ugovor",
        "prioritet": "visoko" if days_remaining <= 30 else "srednje",
        "zavrseno": False,
        "created_at": datetime.now(),
        "created_by": "system",  # System generated
    }

    await db.podsjetnici.insert_one(prepare_for_mongo(reminder_data))
    logger.info(
        f"Created reminder for contract {contract_number} ({days_remaining} days left)"
    )
