import os
from typing import Dict, Iterable

import pytest
from fastapi.testclient import TestClient

# Ensure the backend uses the in-memory database for tests
os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("USE_IN_MEMORY_DB", "true")

from backend.server import DEFAULT_TENANT_ID, app, db  # noqa: E402

client = TestClient(app)


def _clear_collections(collection_names: Iterable[str]) -> None:
    """Helper to reset in-memory collections between tests."""
    for name in collection_names:
        collection = getattr(db, name, None)
        if collection and hasattr(collection, "_documents"):
            collection._documents.clear()  # type: ignore[attr-defined]


AUTH_HEADERS: Dict[str, str] = {}


def _bootstrap_auth():
    global AUTH_HEADERS
    admin_payload = {
        "email": "admin@example.com",
        "password": "AdminPass123!",
        "full_name": "Admin User",
        "role": "admin",
        "scopes": ["users:create", "users:read"],
    }
    response = client.post("/api/auth/register", json=admin_payload)
    assert response.status_code == 200, response.text

    login_resp = client.post(
        "/api/auth/login",
        json={"email": admin_payload["email"], "password": admin_payload["password"]},
    )
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]
    AUTH_HEADERS = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": DEFAULT_TENANT_ID,
    }


@pytest.fixture(autouse=True)
def cleanup_database():
    _clear_collections(["zakupnici", "users", "activity_logs"])
    _bootstrap_auth()
    yield
    _clear_collections(["zakupnici", "users", "activity_logs"])


def _create_zakupnik(**overrides):
    payload = {
        "naziv_firme": "Alpha d.o.o.",
        "ime_prezime": None,
        "oib": "12345678901",
        "sjediste": "Zagreb",
        "kontakt_ime": "Ana",
        "kontakt_email": "ana@example.com",
        "kontakt_telefon": "+385123456",
        "iban": "HR1210010051863000160",
    }
    payload.update(overrides)
    response = client.post("/api/zakupnici", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 201, response.text
    return response.json()


def test_search_zakupnici_matches_multiple_fields():
    _create_zakupnik(naziv_firme="Alpha d.o.o.", oib="11111111111")
    _create_zakupnik(
        naziv_firme="Beta LLC",
        oib="22222222222",
        kontakt_email="kontakt@beta.hr",
        kontakt_telefon="0038512345678",
    )

    # Search by partial company name (case-insensitive)
    response = client.get(
        "/api/zakupnici", params={"search": "beta"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["naziv_firme"] == "Beta LLC"

    # Search by email fragment
    response = client.get(
        "/api/zakupnici", params={"search": "@beta.hr"}, headers=AUTH_HEADERS
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["oib"] == "22222222222"


def test_search_zakupnici_returns_all_without_query():
    created = [
        _create_zakupnik(naziv_firme=f"Tenant {i}", oib=f"{i:011d}") for i in range(3)
    ]
    response = client.get("/api/zakupnici", headers=AUTH_HEADERS)
    assert response.status_code == 200
    results = response.json()
    obtained_ids = {item["id"] for item in results}
    expected_ids = {item["id"] for item in created}
    assert expected_ids.issubset(obtained_ids)


def test_update_zakupnik_applies_changes():
    created = _create_zakupnik(naziv_firme="Gamma d.o.o.", kontakt_ime="Maja")

    update_payload = {
        "naziv_firme": "Gamma Consulting",
        "ime_prezime": None,
        "oib": created["oib"],
        "sjediste": "Split",
        "kontakt_ime": "Marija",
        "kontakt_email": "marija@gamma.hr",
        "kontakt_telefon": "+38595123456",
        "iban": "HR6623400091110623200",
    }

    response = client.put(
        f"/api/zakupnici/{created['id']}", json=update_payload, headers=AUTH_HEADERS
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["naziv_firme"] == "Gamma Consulting"
    assert updated["sjediste"] == "Split"
    assert updated["kontakt_ime"] == "Marija"

    # Fetch again to ensure persistence
    fetch_response = client.get(
        "/api/zakupnici", params={"search": "Gamma"}, headers=AUTH_HEADERS
    )
    assert fetch_response.status_code == 200
    results = fetch_response.json()
    assert results
    assert results[0]["kontakt_email"] == "marija@gamma.hr"


def test_update_zakupnik_returns_404_for_missing_entity():
    missing_payload = {
        "naziv_firme": "Nonexistent",
        "ime_prezime": None,
        "oib": "99999999999",
        "sjediste": "Nowhere",
        "kontakt_ime": "Niko",
        "kontakt_email": "niko@example.com",
        "kontakt_telefon": "+385999999",
        "iban": None,
    }

    response = client.put(
        "/api/zakupnici/missing-id", json=missing_payload, headers=AUTH_HEADERS
    )
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == "Zakupnik nije pronađen"
