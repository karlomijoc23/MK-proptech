from datetime import date, datetime
from enum import Enum


def prepare_for_mongo(data):
    """Convert date/datetime objects to ISO strings for JSON-compatible storage."""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, Enum):
                data[key] = value.value
            elif isinstance(value, list):
                normalised_list = []
                for item in value:
                    if isinstance(item, dict):
                        normalised_list.append(prepare_for_mongo(item))
                    elif isinstance(item, Enum):
                        normalised_list.append(item.value)
                    else:
                        normalised_list.append(item)
                data[key] = normalised_list
    return data


def parse_from_mongo(item):
    """Parse stored date/datetime strings back to Python objects."""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and "datum" in key.lower():
                try:
                    if "T" in value:
                        item[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    else:
                        item[key] = datetime.fromisoformat(value).date()
                except (ValueError, TypeError):
                    pass
            # Also handle created_at/updated_at
            if key in ("created_at", "updated_at") and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
    return item
