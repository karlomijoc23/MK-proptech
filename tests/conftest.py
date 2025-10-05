import os
from typing import Dict, Iterable

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("USE_IN_MEMORY_DB", "true")
os.environ.setdefault("OPENAI_API_KEY", "test")
os.environ.setdefault("AUTO_RUN_MIGRATIONS", "false")
os.environ.setdefault("SEED_ADMIN_ON_STARTUP", "false")

from backend.server import app, db  # noqa: E402

RESET_COLLECTIONS = (
    "nekretnine",
    "property_units",
    "zakupnici",
    "ugovori",
    "dokumenti",
    "podsjetnici",
    "racuni",
    "activity_logs",
    "maintenance_tasks",
    "users",
)


def _clear_collections(collection_names: Iterable[str] = RESET_COLLECTIONS) -> None:
    for name in collection_names:
        collection = getattr(db, name, None)
        if collection is None:
            continue
        documents = getattr(collection, "_documents", None)
        if documents is not None:
            documents.clear()


def _bootstrap_users(client: TestClient) -> Dict[str, Dict[str, str]]:
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
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    pm_payload = {
        "email": "pm@example.com",
        "password": "PmPass123!",
        "full_name": "Property Manager",
        "role": "property_manager",
    }
    response = client.post("/api/auth/register", json=pm_payload, headers=admin_headers)
    assert response.status_code == 200, response.text
    pm_user = response.json()

    pm_login = client.post(
        "/api/auth/login",
        json={"email": pm_payload["email"], "password": pm_payload["password"]},
    )
    assert pm_login.status_code == 200, pm_login.text
    pm_token = pm_login.json()["access_token"]

    return {
        "admin_headers": admin_headers,
        "pm_headers": {"Authorization": f"Bearer {pm_token}"},
        "pm_user": pm_user,
    }


@pytest.fixture()
def client() -> TestClient:
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()


@pytest.fixture()
def app_context(client: TestClient) -> Dict[str, Dict[str, str]]:
    _clear_collections()
    context = _bootstrap_users(client)
    yield context
    _clear_collections()


@pytest.fixture()
def admin_headers(app_context: Dict[str, Dict[str, str]]) -> Dict[str, str]:
    return app_context["admin_headers"]


@pytest.fixture()
def pm_headers(app_context: Dict[str, Dict[str, str]]) -> Dict[str, str]:
    return app_context["pm_headers"]


@pytest.fixture()
def pm_user_id(app_context: Dict[str, Dict[str, str]]) -> str:
    return app_context["pm_user"]["id"]
