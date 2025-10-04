import os
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("USE_IN_MEMORY_DB", "true")
os.environ.setdefault("OPENAI_API_KEY", "test")

from backend.server import app, db  # noqa: E402

client = TestClient(app)


def _clear_collections():
    for name in ("nekretnine", "zakupnici", "ugovori", "podsjetnici", "users", "activity_logs"):
        collection = getattr(db, name, None)
        if collection and hasattr(collection, "_documents"):
            collection._documents.clear()  # type: ignore[attr-defined]

ADMIN_HEADERS = {}
PM_HEADERS = {}


def _bootstrap_users():
    global ADMIN_HEADERS, PM_HEADERS

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
    ADMIN_HEADERS = {"Authorization": f"Bearer {admin_token}"}

    pm_payload = {
        "email": "pm@example.com",
        "password": "PmPass123!",
        "full_name": "Property Manager",
        "role": "property_manager",
    }
    response = client.post("/api/auth/register", json=pm_payload, headers=ADMIN_HEADERS)
    assert response.status_code == 200, response.text

    pm_login = client.post(
        "/api/auth/login",
        json={"email": pm_payload["email"], "password": pm_payload["password"]},
    )
    assert pm_login.status_code == 200, pm_login.text
    pm_token = pm_login.json()["access_token"]
    PM_HEADERS = {"Authorization": f"Bearer {pm_token}"}


@pytest.fixture(autouse=True)
def reset_db(monkeypatch):
    _clear_collections()
    _bootstrap_users()

    class StubChat:
        def __init__(self):
            self.completions = SimpleNamespace(create=self._create)

        @staticmethod
        def _create(**kwargs):
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="""ANEKS UGOVORA\n\n1. Predmet izmjene ...\n2. Nova zakupnina ...\n3. Ostale odredbe ostaju na snazi."""))]
            )

    class StubOpenAI:
        def __init__(self, *args, **kwargs):
            self.chat = StubChat()

    monkeypatch.setattr("backend.server.OpenAI", StubOpenAI)
    yield
    _clear_collections()


def _create_property():
    response = client.post(
        "/api/nekretnine",
        json={
            "naziv": "Poslovni prostor A",
            "adresa": "Ilica 1, Zagreb",
            "katastarska_opcina": "Zagreb",
            "broj_kat_cestice": "123/45",
            "vrsta": "poslovna_zgrada",
            "povrsina": 250.0,
            "vlasnik": "Riforma d.o.o.",
            "udio_vlasnistva": "1/1",
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_tenant():
    response = client.post(
        "/api/zakupnici",
        json={
            "naziv_firme": "Alpha d.o.o.",
            "ime_prezime": None,
            "oib": "12345678901",
            "sjediste": "Zagreb",
            "kontakt_ime": "Ana",
            "kontakt_email": "ana@example.com",
            "kontakt_telefon": "+385123456",
            "iban": "HR1210010051863000160",
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_contract(nekretnina_id, zakupnik_id):
    response = client.post(
        "/api/ugovori",
        json={
            "interna_oznaka": "UG-001",
            "nekretnina_id": nekretnina_id,
            "zakupnik_id": zakupnik_id,
            "datum_potpisivanja": "2024-01-01",
            "datum_pocetka": "2024-02-01",
            "datum_zavrsetka": "2025-01-31",
            "trajanje_mjeseci": 12,
            "opcija_produljenja": True,
            "uvjeti_produljenja": "Dodatni dogovor 60 dana prije isteka",
            "rok_otkaza_dani": 60,
            "osnovna_zakupnina": 2500.0,
        },
        headers=PM_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_generate_contract_annex_success():
    nekretnina_id = _create_property()
    zakupnik_id = _create_tenant()
    ugovor_id = _create_contract(nekretnina_id, zakupnik_id)

    response = client.post(
        "/api/ai/generate-contract-annex",
        json={
            "ugovor_id": ugovor_id,
            "nova_zakupnina": 2750.0,
            "novi_datum_zavrsetka": "2025-12-31",
            "dodatne_promjene": "Indeksacija prema HICP od iduće godine.",
        },
        headers=PM_HEADERS,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "Aneks ugovora" in payload["title"]
    assert "ANEKS UGOVORA" in payload["content"]
    assert payload["metadata"]["nova_zakupnina"] == 2750.0
    assert payload["metadata"]["novi_datum_zavrsetka"] == "2025-12-31"
    assert payload["metadata"].get("source") == "openai"


def test_generate_contract_annex_without_key(monkeypatch):
    monkqp = monkeypatch
    monkqp.setenv("OPENAI_API_KEY", "")

    nekretnina_id = _create_property()
    zakupnik_id = _create_tenant()
    ugovor_id = _create_contract(nekretnina_id, zakupnik_id)

    response = client.post(
        "/api/ai/generate-contract-annex",
        json={
            "ugovor_id": ugovor_id,
            "nova_zakupnina": None,
            "novi_datum_zavrsetka": None,
            "dodatne_promjene": None,
        },
        headers=PM_HEADERS,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["metadata"].get("source") == "fallback"
    assert "ANEKS UGOVORA" in payload["content"]
