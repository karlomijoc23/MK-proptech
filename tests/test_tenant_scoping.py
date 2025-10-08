from .factories import create_contract, create_property, create_unit, create_zakupnik


def test_cross_tenant_access_denied(client, admin_headers, pm_headers):
    response = client.post(
        "/api/tenants",
        json={"naziv": "Drugi profil"},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    other_tenant = response.json()["id"]

    cross_headers = {**pm_headers, "X-Tenant-Id": other_tenant}
    response = client.get("/api/nekretnine", headers=cross_headers)
    assert response.status_code == 403
    assert "pristup" in response.json().get("detail", "").lower()


def test_document_metadata_validation(client, pm_headers):
    property_doc = create_property(client, pm_headers, naziv="Toranj X")
    unit = create_unit(client, pm_headers, property_doc["id"], oznaka="X-1")
    tenant = create_zakupnik(
        client,
        pm_headers,
        naziv_firme="Tenant X",
        oib="98765432109",
        kontakt_email="kontakt@tenantx.hr",
    )
    contract = create_contract(
        client,
        pm_headers,
        nekretnina_id=property_doc["id"],
        zakupnik_id=tenant["id"],
        property_unit_id=unit["id"],
    )

    response = client.post(
        "/api/dokumenti",
        json={
            "naziv": "Mjesečni račun",
            "tip": "racun",
            "nekretnina_id": property_doc["id"],
            "zakupnik_id": tenant["id"],
            "ugovor_id": contract["id"],
            "metadata": {},
        },
        headers=pm_headers,
    )
    assert response.status_code == 400
    assert "metadata" in response.json().get("detail", "").lower()


def test_update_active_tenant_profile(client, admin_headers):
    tenants_response = client.get("/api/tenants", headers=admin_headers)
    assert tenants_response.status_code == 200
    tenant_list = tenants_response.json()
    assert tenant_list
    tenant_id = tenant_list[0]["id"]

    detail_response = client.get(f"/api/tenants/{tenant_id}", headers=admin_headers)
    assert detail_response.status_code == 200

    update_payload = {"naziv": "Novi naziv profila", "status": "active"}
    update_response = client.put(
        f"/api/tenants/{tenant_id}", json=update_payload, headers=admin_headers
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["naziv"] == "Novi naziv profila"


def test_tenant_update_requires_elevated_role(client, pm_headers, admin_headers):
    # Create viewer user and attempt update
    viewer_payload = {
        "email": "viewer@example.com",
        "password": "ViewerPass123!",
        "full_name": "Viewer User",
        "role": "tenant",
    }
    response = client.post(
        "/api/auth/register", json=viewer_payload, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    login = client.post(
        "/api/auth/login",
        json={
            "email": viewer_payload["email"],
            "password": viewer_payload["password"],
        },
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    viewer_headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": pm_headers["X-Tenant-Id"],
    }

    forbidden = client.put(
        f"/api/tenants/{pm_headers['X-Tenant-Id']}",
        json={"naziv": "Ne bi smio"},
        headers=viewer_headers,
    )
    assert forbidden.status_code == 403
    assert "ovlasti" in forbidden.json()["detail"].lower()
