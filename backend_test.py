import requests
import sys
import json
from datetime import datetime, date

class CroatianRealEstateAPITester:
    def __init__(self, base_url="https://real-estate-manager.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_entities = {
            'nekretnine': [],
            'zakupnici': [],
            'ugovori': [],
            'dokumenti': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.text}")
                except:
                    pass
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root Endpoint",
            "GET",
            "",
            200
        )
        if success and 'message' in response:
            print(f"   Message: {response['message']}")
        return success

    def test_dashboard(self):
        """Test dashboard endpoint with Croatian metrics"""
        success, response = self.run_test(
            "Dashboard Croatian Metrics",
            "GET",
            "dashboard",
            200
        )
        if success:
            expected_fields = ['ukupno_nekretnina', 'aktivni_ugovori', 'ugovori_na_isteku', 'aktivni_podsjetnici', 'mjesecni_prihod']
            for field in expected_fields:
                if field in response:
                    print(f"   ✅ {field}: {response[field]}")
                else:
                    print(f"   ❌ Missing field: {field}")
                    return False
        return success

    def test_create_nekretnina(self):
        """Test creating a Croatian property"""
        nekretnina_data = {
            "naziv": "Testna nekretnina Zagreb",
            "adresa": "Ilica 1, Zagreb",
            "katastarska_opcina": "Zagreb-Centar",
            "broj_kat_cestice": "1234/5",
            "vrsta": "stan",
            "povrsina": 85.5,
            "godina_izgradnje": 2010,
            "vlasnik": "Marko Marković",
            "udio_vlasnistva": "1/1",
            "nabavna_cijena": 150000.0,
            "trzisna_vrijednost": 180000.0,
            "prosllogodisnji_prihodi": 12000.0,
            "prosllogodisnji_rashodi": 3000.0,
            "amortizacija": 5000.0,
            "neto_prihod": 9000.0,
            "zadnja_obnova": "2020-05-15",
            "potrebna_ulaganja": "Potrebno obnoviti kupaonicu",
            "troskovi_odrzavanja": 2000.0,
            "osiguranje": "Croatia osiguranje",
            "sudski_sporovi": "Nema aktivnih sporova",
            "hipoteke": "Nema hipoteka",
            "napomene": "Odličan stan u centru grada"
        }
        
        success, response = self.run_test(
            "Create Croatian Property (Nekretnina)",
            "POST",
            "nekretnine",
            201,
            nekretnina_data
        )
        
        if success and 'id' in response:
            self.created_entities['nekretnine'].append(response['id'])
            print(f"   Created nekretnina ID: {response['id']}")
            # Verify Croatian fields
            croatian_fields = ['katastarska_opcina', 'broj_kat_cestice', 'vlasnik', 'udio_vlasnistva']
            for field in croatian_fields:
                if field in response:
                    print(f"   ✅ Croatian field {field}: {response[field]}")
        
        return success

    def test_get_nekretnine(self):
        """Test getting all properties"""
        success, response = self.run_test(
            "Get All Properties (Nekretnine)",
            "GET",
            "nekretnine",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} nekretnine")
            if len(response) > 0:
                # Check Croatian fields in first property
                first_property = response[0]
                croatian_fields = ['katastarska_opcina', 'broj_kat_cestice', 'vlasnik', 'udio_vlasnistva']
                for field in croatian_fields:
                    if field in first_property:
                        print(f"   ✅ Croatian field {field}: {first_property[field]}")
        
        return success

    def test_create_zakupnik(self):
        """Test creating a Croatian tenant"""
        zakupnik_data = {
            "naziv_firme": "Test d.o.o.",
            "ime_prezime": None,
            "oib": "12345678901",
            "sjediste": "Trg bana Jelačića 1, Zagreb",
            "kontakt_ime": "Ana Anić",
            "kontakt_email": "ana.anic@test.hr",
            "kontakt_telefon": "+385 1 234 5678",
            "iban": "HR1234567890123456789"
        }
        
        success, response = self.run_test(
            "Create Croatian Tenant (Zakupnik)",
            "POST",
            "zakupnici",
            201,
            zakupnik_data
        )
        
        if success and 'id' in response:
            self.created_entities['zakupnici'].append(response['id'])
            print(f"   Created zakupnik ID: {response['id']}")
            # Verify Croatian fields
            croatian_fields = ['oib', 'sjediste', 'kontakt_ime', 'iban']
            for field in croatian_fields:
                if field in response:
                    print(f"   ✅ Croatian field {field}: {response[field]}")
        
        return success

    def test_get_zakupnici(self):
        """Test getting all tenants"""
        success, response = self.run_test(
            "Get All Tenants (Zakupnici)",
            "GET",
            "zakupnici",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} zakupnici")
            if len(response) > 0:
                # Check Croatian fields in first tenant
                first_tenant = response[0]
                croatian_fields = ['oib', 'sjediste', 'kontakt_ime']
                for field in croatian_fields:
                    if field in first_tenant:
                        print(f"   ✅ Croatian field {field}: {first_tenant[field]}")
        
        return success

    def test_create_ugovor(self):
        """Test creating a Croatian contract"""
        if not self.created_entities['nekretnine'] or not self.created_entities['zakupnici']:
            print("   ⚠️  Skipping contract creation - need nekretnina and zakupnik first")
            return True
            
        ugovor_data = {
            "interna_oznaka": "UG-2024-001",
            "nekretnina_id": self.created_entities['nekretnine'][0],
            "zakupnik_id": self.created_entities['zakupnici'][0],
            "datum_potpisivanja": "2024-01-15",
            "datum_pocetka": "2024-02-01",
            "datum_zavrsetka": "2025-01-31",
            "trajanje_mjeseci": 12,
            "opcija_produljenja": True,
            "uvjeti_produljenja": "Automatsko produljenje za 12 mjeseci",
            "rok_otkaza_dani": 30,
            "osnovna_zakupnina": 800.0,
            "zakupnina_po_m2": 9.36,
            "cam_troskovi": 50.0,
            "polog_depozit": 1600.0,
            "garancija": 800.0,
            "indeksacija": True,
            "indeks": "Potrošačke cijene",
            "formula_indeksacije": "Godišnja indeksacija prema HNB",
            "obveze_odrzavanja": "zakupodavac",
            "namjena_prostora": "Stanovanje",
            "rezije_brojila": "Na zakupnika"
        }
        
        success, response = self.run_test(
            "Create Croatian Contract (Ugovor)",
            "POST",
            "ugovori",
            201,
            ugovor_data
        )
        
        if success and 'id' in response:
            self.created_entities['ugovori'].append(response['id'])
            print(f"   Created ugovor ID: {response['id']}")
            # Verify Croatian fields
            croatian_fields = ['interna_oznaka', 'osnovna_zakupnina', 'indeksacija']
            for field in croatian_fields:
                if field in response:
                    print(f"   ✅ Croatian field {field}: {response[field]}")
        
        return success

    def test_get_ugovori(self):
        """Test getting all contracts"""
        success, response = self.run_test(
            "Get All Contracts (Ugovori)",
            "GET",
            "ugovori",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} ugovori")
            if len(response) > 0:
                # Check Croatian fields in first contract
                first_contract = response[0]
                croatian_fields = ['interna_oznaka', 'osnovna_zakupnina', 'status']
                for field in croatian_fields:
                    if field in first_contract:
                        print(f"   ✅ Croatian field {field}: {first_contract[field]}")
        
        return success

    def test_create_dokument(self):
        """Test creating a Croatian document"""
        if not self.created_entities['nekretnine']:
            print("   ⚠️  Skipping document creation - need nekretnina first")
            return True
            
        dokument_data = {
            "naziv": "Zemljišnoknjižni izvadak",
            "tip": "zemljisnoknjizni_izvadak",
            "opis": "Izvadak iz zemljišnih knjiga za nekretninu",
            "verzija": "1.0",
            "nekretnina_id": self.created_entities['nekretnine'][0],
            "uploadao": "Administrator"
        }
        
        success, response = self.run_test(
            "Create Croatian Document (Dokument)",
            "POST",
            "dokumenti",
            201,
            dokument_data
        )
        
        if success and 'id' in response:
            self.created_entities['dokumenti'].append(response['id'])
            print(f"   Created dokument ID: {response['id']}")
            # Verify Croatian fields
            if 'tip' in response:
                print(f"   ✅ Croatian document type: {response['tip']}")
        
        return success

    def test_get_dokumenti(self):
        """Test getting all documents"""
        success, response = self.run_test(
            "Get All Documents (Dokumenti)",
            "GET",
            "dokumenti",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} dokumenti")
        
        return success

    def test_get_podsjetnici(self):
        """Test getting reminders"""
        success, response = self.run_test(
            "Get Reminders (Podsjećanja)",
            "GET",
            "podsjetnici",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} podsjećanja")
        
        return success

    def test_get_aktivni_podsjetnici(self):
        """Test getting active reminders"""
        success, response = self.run_test(
            "Get Active Reminders (Aktivna podsjećanja)",
            "GET",
            "podsjetnici/aktivni",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} aktivna podsjećanja")
        
        return success

    def test_pretraga(self):
        """Test Croatian search functionality"""
        success, response = self.run_test(
            "Search Functionality (Pretraga)",
            "GET",
            "pretraga",
            200,
            params={"q": "Zagreb"}
        )
        
        if success and isinstance(response, dict):
            search_categories = ['nekretnine', 'zakupnici', 'ugovori']
            for category in search_categories:
                if category in response:
                    count = len(response[category]) if isinstance(response[category], list) else 0
                    print(f"   ✅ Found {count} results in {category}")
                else:
                    print(f"   ❌ Missing search category: {category}")
        
        return success

    def test_update_nekretnina(self):
        """Test updating a property"""
        if not self.created_entities['nekretnine']:
            print("   ⚠️  Skipping update test - no nekretnina to update")
            return True
            
        nekretnina_id = self.created_entities['nekretnine'][0]
        update_data = {
            "naziv": "Ažurirana testna nekretnina Zagreb",
            "adresa": "Ilica 1, Zagreb",
            "katastarska_opcina": "Zagreb-Centar",
            "broj_kat_cestice": "1234/5",
            "vrsta": "stan",
            "povrsina": 85.5,
            "godina_izgradnje": 2010,
            "vlasnik": "Marko Marković",
            "udio_vlasnistva": "1/1",
            "trzisna_vrijednost": 190000.0  # Updated value
        }
        
        success, response = self.run_test(
            "Update Property (Ažuriraj nekretninu)",
            "PUT",
            f"nekretnine/{nekretnina_id}",
            200,
            update_data
        )
        
        if success and 'naziv' in response:
            print(f"   ✅ Updated naziv: {response['naziv']}")
        
        return success

    def test_delete_nekretnina(self):
        """Test deleting a property"""
        if not self.created_entities['nekretnine']:
            print("   ⚠️  Skipping delete test - no nekretnina to delete")
            return True
            
        nekretnina_id = self.created_entities['nekretnine'][0]
        
        success, response = self.run_test(
            "Delete Property (Obriši nekretninu)",
            "DELETE",
            f"nekretnine/{nekretnina_id}",
            200
        )
        
        if success and 'poruka' in response:
            print(f"   ✅ Delete message: {response['poruka']}")
            # Remove from our tracking
            self.created_entities['nekretnine'].remove(nekretnina_id)
        
        return success

def main():
    print("🏢 Croatian Real Estate Management System API Testing")
    print("=" * 60)
    
    tester = CroatianRealEstateAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_dashboard,
        tester.test_create_nekretnina,
        tester.test_get_nekretnine,
        tester.test_create_zakupnik,
        tester.test_get_zakupnici,
        tester.test_create_ugovor,
        tester.test_get_ugovori,
        tester.test_create_dokument,
        tester.test_get_dokumenti,
        tester.test_get_podsjetnici,
        tester.test_get_aktivni_podsjetnici,
        tester.test_pretraga,
        tester.test_update_nekretnina,
        tester.test_delete_nekretnina
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.tests_run += 1
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("🎉 Croatian Real Estate API is working excellently!")
    elif success_rate >= 70:
        print("✅ Croatian Real Estate API is working well with minor issues")
    else:
        print("⚠️  Croatian Real Estate API has significant issues")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())