from datetime import date

from .factories import (
    create_contract,
    create_invoice,
    create_property,
    create_unit,
    create_zakupnik,
)


def test_invoice_crud_and_filters(client, pm_headers, admin_headers):
    property_doc = create_property(client, pm_headers, naziv="Tower A")
    unit = create_unit(client, pm_headers, property_doc["id"], oznaka="A-101")
    tenant = create_zakupnik(client, pm_headers, naziv_firme="Energo d.o.o.")
    contract = create_contract(
        client,
        pm_headers,
        nekretnina_id=property_doc["id"],
        zakupnik_id=tenant["id"],
        property_unit_id=unit["id"],
        interna_oznaka="UG-ENERGO",
    )

    invoice = create_invoice(
        client,
        admin_headers,
        nekretnina_id=property_doc["id"],
        ugovor_id=contract["id"],
        property_unit_id=unit["id"],
        broj_racuna="INV-2024-001",
        iznos_za_platiti=750.0,
        tip_rezije="struja",
    )

    assert invoice["nekretnina_id"] == property_doc["id"]
    assert invoice["ugovor_id"] == contract["id"]
    assert invoice["status"] == "due"

    list_response = client.get("/api/racuni", headers=pm_headers)
    assert list_response.status_code == 200
    results = list_response.json()
    assert any(item["id"] == invoice["id"] for item in results)

    filter_response = client.get(
        "/api/racuni",
        params={"nekretnina_id": property_doc["id"], "status": "due"},
        headers=pm_headers,
    )
    assert filter_response.status_code == 200
    filtered = filter_response.json()
    assert len(filtered) == 1
    assert filtered[0]["broj_racuna"] == "INV-2024-001"

    update_response = client.put(
        f"/api/racuni/{invoice['id']}",
        json={
            "status": "paid",
            "iznos_placen": 750.0,
            "placeno_na_dan": date.today().isoformat(),
        },
        headers=admin_headers,
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["status"] == "paid"
    assert updated["iznos_placen"] == 750.0

    delete_response = client.delete(
        f"/api/racuni/{invoice['id']}",
        headers=admin_headers,
    )
    assert delete_response.status_code == 200
    body = delete_response.json()
    assert body["poruka"] == "Račun je uspješno obrisan"

    confirm_response = client.get(
        "/api/racuni",
        params={"nekretnina_id": property_doc["id"]},
        headers=pm_headers,
    )
    assert confirm_response.status_code == 200
    assert all(item["id"] != invoice["id"] for item in confirm_response.json())
