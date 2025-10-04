import os
import uuid
from datetime import datetime, date, timedelta

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("USE_IN_MEMORY_DB", "true")
os.environ.setdefault("OPENAI_API_KEY", "test")

from backend.server import app, db  # noqa: E402

client = TestClient(app)


def _clear_collections():
    for name in (
        "nekretnine",
        "property_units",
        "zakupnici",
        "ugovori",
        "maintenance_tasks",
    ):
        collection = getattr(db, name, None)
        if collection and hasattr(collection, "_documents"):
            collection._documents.clear()  # type: ignore[attr-defined]


@pytest.fixture(autouse=True)
def reset_db():
    _clear_collections()
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
    response = client.post("/api/zakupnici", json=payload)
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
    response = client.post("/api/ugovori", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_task(payload):
    response = client.post("/api/maintenance-tasks", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_maintenance_task_records_initial_activity():
    property_id = _create_property()
    task = _create_task({
        "naziv": "Servis lifta",
        "nekretnina_id": property_id,
        "prioritet": "visoko",
        "rok": "2024-12-01",
    })

    assert task["naziv"] == "Servis lifta"
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
        },
    )
    assert response.status_code == 400
    assert "podprostor" in response.json()["detail"].lower()


def test_create_task_with_contract_from_other_property_is_rejected():
    property_a = _create_property("Objekt A")
    property_b = _create_property("Objekt B")
    unit_id = _create_unit(property_a)
    tenant = _create_zakupnik()
    contract_id = _create_contract(nekretnina_id=property_a, zakupnik_id=tenant["id"], property_unit_id=unit_id)

    response = client.post(
        "/api/maintenance-tasks",
        json={
            "naziv": "Koordinacija izvođača",
            "nekretnina_id": property_b,
            "ugovor_id": contract_id,
        },
    )
    assert response.status_code == 400
    assert "ugovor" in response.json()["detail"].lower()


def test_create_task_infers_relations_from_contract():
    property_id = _create_property("Glavni objekt")
    unit_id = _create_unit(property_id, oznaka="C1")
    tenant = _create_zakupnik("Zakupnik d.o.o.")
    contract_id = _create_contract(nekretnina_id=property_id, zakupnik_id=tenant["id"], property_unit_id=unit_id)

    task = _create_task({
        "naziv": "Revizija opreme",
        "ugovor_id": contract_id,
        "opis": "Provjera opreme prema ugovoru",
    })

    assert task["nekretnina_id"] == property_id
    assert task["property_unit_id"] == unit_id


def test_status_update_adds_activity():
    property_id = _create_property()
    task = _create_task({
        "naziv": "Zamjena rasvjete",
        "nekretnina_id": property_id,
    })

    response = client.patch(
        f"/api/maintenance-tasks/{task['id']}",
        json={"status": "u_tijeku"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "u_tijeku"
    activities = payload["aktivnosti"]
    assert len(activities) == 2
    assert activities[-1]["tip"] == "promjena_statusa"


def test_comment_endpoint_adds_activity():
    property_id = _create_property()
    task = _create_task({
        "naziv": "Provjera protupožarnog sustava",
        "nekretnina_id": property_id,
    })

    response = client.post(
        f"/api/maintenance-tasks/{task['id']}/comments",
        json={"poruka": "Kontaktiran izvođač", "autor": "Voditelj"},
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

    _create_task({
        "naziv": "Hitna intervencija",
        "nekretnina_id": property_a,
        "prioritet": "kriticno",
        "rok": "2024-05-01",
        "oznake": ["elektrika"],
    })
    _create_task({
        "naziv": "Plin godišnji servis",
        "nekretnina_id": property_b,
        "prioritet": "srednje",
        "rok": "2024-08-15",
        "oznake": ["plin"],
    })

    response = client.get(
        "/api/maintenance-tasks",
        params={
            "prioritet": "kriticno",
            "nekretnina_id": property_a,
            "rok_do": "2024-06-01",
            "oznaka": "elektrika",
        },
    )
    assert response.status_code == 200, response.text
    results = response.json()
    assert len(results) == 1
    assert results[0]["naziv"] == "Hitna intervencija"
    assert results[0]["prioritet"] == "kriticno"

    response = client.get("/api/maintenance-tasks", params={"q": "servis"})
    assert response.status_code == 200
    results = response.json()
    assert {item["naziv"] for item in results} == {"Plin godišnji servis"}
