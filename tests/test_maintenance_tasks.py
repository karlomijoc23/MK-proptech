import os
import uuid
from datetime import date, timedelta
from typing import Dict, Optional

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("USE_IN_MEMORY_DB", "true")
os.environ.setdefault("OPENAI_API_KEY", "test")

from backend.server import DEFAULT_TENANT_ID, app, db  # noqa: E402

client = TestClient(app)


def _clear_collections():
    for name in (
        "nekretnine",
        "property_units",
        "zakupnici",
        "ugovori",
        "maintenance_tasks",
        "users",
        "activity_logs",
    ):
        collection = getattr(db, name, None)
        if collection and hasattr(collection, "_documents"):
            collection._documents.clear()  # type: ignore[attr-defined]


ADMIN_HEADERS: Dict[str, str] = {}
PM_HEADERS: Dict[str, str] = {}
PM_USER_ID: Optional[str] = None


def _bootstrap_users():
    global ADMIN_HEADERS, PM_HEADERS, PM_USER_ID

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
    admin_token = login_resp.json()["access_token"]
    ADMIN_HEADERS = {
        "Authorization": f"Bearer {admin_token}",
        "X-Tenant-Id": DEFAULT_TENANT_ID,
    }

    pm_payload = {
        "email": "pm@example.com",
        "password": "PmPass123!",
        "full_name": "Property Manager",
        "role": "property_manager",
    }
    response = client.post("/api/auth/register", json=pm_payload, headers=ADMIN_HEADERS)
    assert response.status_code == 200, response.text
    pm_user = response.json()
    PM_USER_ID = pm_user["id"]

    pm_login = client.post(
        "/api/auth/login",
        json={"email": pm_payload["email"], "password": pm_payload["password"]},
    )
    assert pm_login.status_code == 200, pm_login.text
    pm_token = pm_login.json()["access_token"]
    PM_HEADERS = {
        "Authorization": f"Bearer {pm_token}",
        "X-Tenant-Id": DEFAULT_TENANT_ID,
    }


def _register_user(email: str, password: str, role: str, full_name: str = ""):
    payload = {
        "email": email,
        "password": password,
        "full_name": full_name or email.split("@")[0].title(),
        "role": role,
    }
    response = client.post("/api/auth/register", json=payload, headers=ADMIN_HEADERS)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(autouse=True)
def reset_db():
    _clear_collections()
    _bootstrap_users()
    yield
    _clear_collections()


def _create_property(naziv="Poslovna zgrada"):  # helper
    response = client.post(
        "/api/nekretnine",
        json={
            "naziv": naziv,
            "adresa": "Primorska 1",
            "katastarska_opcina": "Zagreb",
            "broj_kat_cestice": "123/1",
            "vrsta": "poslovna_zgrada",
            "povrsina": 1500.0,
            "godina_izgradnje": 2010,
            "vlasnik": "Riforma d.o.o.",
            "udio_vlasnistva": "1/1",
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_unit(nekretnina_id, oznaka="A1"):
    response = client.post(
        f"/api/nekretnine/{nekretnina_id}/units",
        json={
            "oznaka": oznaka,
            "status": "dostupno",
            "povrsina_m2": 120.0,
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_zakupnik(naziv="Tenant d.o.o."):
    payload = {
        "naziv_firme": naziv,
        "ime_prezime": None,
        "oib": str(uuid.uuid4().int)[:11],
        "sjediste": "Zagreb",
        "kontakt_ime": "Ana",
        "kontakt_email": "ana@example.com",
        "kontakt_telefon": "+385123456",
        "iban": "HR1210010051863000160",
    }
    response = client.post("/api/zakupnici", json=payload, headers=PM_HEADERS)
    assert response.status_code == 201, response.text
    return response.json()


def _create_contract(nekretnina_id, zakupnik_id, property_unit_id=None):
    today = date.today()
    payload = {
        "interna_oznaka": f"UG-{uuid.uuid4().hex[:6].upper()}",
        "nekretnina_id": nekretnina_id,
        "zakupnik_id": zakupnik_id,
        "property_unit_id": property_unit_id,
        "datum_potpisivanja": today.isoformat(),
        "datum_pocetka": today.isoformat(),
        "datum_zavrsetka": (today + timedelta(days=30)).isoformat(),
        "trajanje_mjeseci": 1,
        "osnovna_zakupnina": 500.0,
        "zakupnina_po_m2": 10.0,
        "cam_troskovi": 50.0,
        "polog_depozit": 100.0,
        "garancija": 0.0,
        "indeksacija": False,
        "rok_otkaza_dani": 30,
    }
    response = client.post("/api/ugovori", json=payload, headers=PM_HEADERS)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_task(payload):
    assert PM_USER_ID is not None
    payload = dict(payload)
    payload.setdefault("dodijeljeno_user_id", PM_USER_ID)
    response = client.post("/api/maintenance-tasks", json=payload, headers=PM_HEADERS)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_maintenance_task_records_initial_activity():
    property_id = _create_property()
    task = _create_task(
        {
            "naziv": "Servis lifta",
            "nekretnina_id": property_id,
            "prioritet": "visoko",
            "rok": "2024-12-01",
        }
    )

    assert task["naziv"] == "Servis lifta"
    assert task["dodijeljeno_user_id"] == PM_USER_ID
    activities = task.get("aktivnosti", [])
    assert len(activities) == 1
    assert activities[0]["tip"] == "kreiran"


def test_create_task_with_mismatched_unit_and_property():
    property_a = _create_property("Objekt A")
    property_b = _create_property("Objekt B")
    unit_id = _create_unit(property_a)

    response = client.post(
        "/api/maintenance-tasks",
        json={
            "naziv": "Popravak instalacija",
            "nekretnina_id": property_b,
            "property_unit_id": unit_id,
            "dodijeljeno_user_id": PM_USER_ID,
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 400
    assert "podprostor" in response.json()["detail"].lower()


def test_create_task_with_contract_from_other_property_is_rejected():
    property_a = _create_property("Objekt A")
    property_b = _create_property("Objekt B")
    unit_id = _create_unit(property_a)
    tenant = _create_zakupnik()
    contract_id = _create_contract(
        nekretnina_id=property_a, zakupnik_id=tenant["id"], property_unit_id=unit_id
    )

    response = client.post(
        "/api/maintenance-tasks",
        json={
            "naziv": "Koordinacija izvođača",
            "nekretnina_id": property_b,
            "ugovor_id": contract_id,
            "dodijeljeno_user_id": PM_USER_ID,
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 400
    assert "ugovor" in response.json()["detail"].lower()


def test_create_task_infers_relations_from_contract():
    property_id = _create_property("Glavni objekt")
    unit_id = _create_unit(property_id, oznaka="C1")
    tenant = _create_zakupnik("Zakupnik d.o.o.")
    contract_id = _create_contract(
        nekretnina_id=property_id, zakupnik_id=tenant["id"], property_unit_id=unit_id
    )

    task = _create_task(
        {
            "naziv": "Revizija opreme",
            "ugovor_id": contract_id,
            "opis": "Provjera opreme prema ugovoru",
        }
    )

    assert task["nekretnina_id"] == property_id
    assert task["property_unit_id"] == unit_id
    assert task["dodijeljeno_user_id"] == PM_USER_ID


def test_assignment_requires_manager_role():
    property_id = _create_property("Upravna zgrada")
    unauthorized_user = _register_user(
        email="user@example.com",
        password="UserPass123!",
        role="tenant",
        full_name="Regular User",
    )

    response = client.post(
        "/api/maintenance-tasks",
        json={
            "naziv": "Servis kotla",
            "nekretnina_id": property_id,
            "dodijeljeno_user_id": unauthorized_user["id"],
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 400
    assert "Voditelj naloga" in response.json()["detail"]


def test_status_update_adds_activity():
    property_id = _create_property()
    task = _create_task(
        {
            "naziv": "Zamjena rasvjete",
            "nekretnina_id": property_id,
        }
    )

    response = client.patch(
        f"/api/maintenance-tasks/{task['id']}",
        json={"status": "u_tijeku"},
        headers=PM_HEADERS,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "u_tijeku"
    activities = payload["aktivnosti"]
    assert len(activities) == 2
    assert activities[-1]["tip"] == "promjena_statusa"


def test_comment_endpoint_adds_activity():
    property_id = _create_property()
    task = _create_task(
        {
            "naziv": "Provjera protupožarnog sustava",
            "nekretnina_id": property_id,
        }
    )

    response = client.post(
        f"/api/maintenance-tasks/{task['id']}/comments",
        json={"poruka": "Kontaktiran izvođač", "autor": "Voditelj"},
        headers=PM_HEADERS,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    activities = payload["aktivnosti"]
    assert len(activities) == 2
    assert activities[-1]["tip"] == "komentar"
    assert activities[-1]["opis"] == "Kontaktiran izvođač"
    assert activities[-1]["autor"] == "Voditelj"


def test_list_filters_by_priority_property_and_due_date():
    property_a = _create_property("Objekt A")
    property_b = _create_property("Objekt B")

    _create_task(
        {
            "naziv": "Hitna intervencija",
            "nekretnina_id": property_a,
            "prioritet": "kriticno",
            "rok": "2024-05-01",
            "oznake": ["elektrika"],
        }
    )
    _create_task(
        {
            "naziv": "Plin godišnji servis",
            "nekretnina_id": property_b,
            "prioritet": "srednje",
            "rok": "2024-08-15",
            "oznake": ["plin"],
        }
    )

    response = client.get(
        "/api/maintenance-tasks",
        params={
            "prioritet": "kriticno",
            "nekretnina_id": property_a,
            "rok_do": "2024-06-01",
            "oznaka": "elektrika",
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 200, response.text
    results = response.json()
    assert len(results) == 1
    assert results[0]["naziv"] == "Hitna intervencija"
    assert results[0]["prioritet"] == "kriticno"

    response = client.get(
        "/api/maintenance-tasks",
        params={"q": "servis"},
        headers=PM_HEADERS,
    )
    assert response.status_code == 200
    results = response.json()
    assert {item["naziv"] for item in results} == {"Plin godišnji servis"}
