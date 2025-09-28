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
        self.test_results = []
        
        # Store created entities for cleanup and reference
        self.created_entities = {
            'properties': [],
            'tenants': [],
            'rentals': [],
            'payments': [],
            'documents': []
        }

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            'name': name,
            'success': success,
            'details': details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_test(name, True)
                    return True, response_data
                except:
                    self.log_test(name, True)
                    return True, {}
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error details: {error_data}")
                except:
                    print(f"   Response text: {response.text}")
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API endpoint", "GET", "", 200)

    def test_analytics_dashboard(self):
        """Test dashboard analytics endpoint"""
        return self.run_test("Dashboard analytics", "GET", "analytics/dashboard", 200)

    def test_analytics_revenue(self):
        """Test revenue analytics endpoint"""
        return self.run_test("Revenue analytics", "GET", "analytics/revenue", 200)

    def test_create_property(self):
        """Test property creation"""
        property_data = {
            "title": "Test Property",
            "address": "123 Test Street, Test City",
            "property_type": "residential",
            "area": 100.5,
            "bedrooms": 3,
            "bathrooms": 2,
            "description": "A beautiful test property",
            "monthly_rent": 50000
        }
        
        success, response = self.run_test("Create property", "POST", "properties", 201, property_data)
        if success and 'id' in response:
            self.created_entities['properties'].append(response['id'])
            return True, response
        return False, {}

    def test_get_properties(self):
        """Test getting all properties"""
        return self.run_test("Get all properties", "GET", "properties", 200)

    def test_get_property_by_id(self, property_id):
        """Test getting a specific property"""
        return self.run_test(f"Get property {property_id[:8]}", "GET", f"properties/{property_id}", 200)

    def test_update_property(self, property_id):
        """Test updating a property"""
        update_data = {
            "title": "Updated Test Property",
            "address": "456 Updated Street, Test City",
            "property_type": "commercial",
            "area": 150.0,
            "bedrooms": 4,
            "bathrooms": 3,
            "description": "An updated test property",
            "monthly_rent": 75000
        }
        
        return self.run_test(f"Update property {property_id[:8]}", "PUT", f"properties/{property_id}", 200, update_data)

    def test_create_tenant(self):
        """Test tenant creation"""
        tenant_data = {
            "name": "John Doe",
            "email": "john.doe@test.com",
            "phone": "+381601234567",
            "id_number": "1234567890123"
        }
        
        success, response = self.run_test("Create tenant", "POST", "tenants", 201, tenant_data)
        if success and 'id' in response:
            self.created_entities['tenants'].append(response['id'])
            return True, response
        return False, {}

    def test_get_tenants(self):
        """Test getting all tenants"""
        return self.run_test("Get all tenants", "GET", "tenants", 200)

    def test_create_rental(self, property_id, tenant_id):
        """Test rental creation"""
        start_date = date.today()
        end_date = start_date + timedelta(days=365)
        
        rental_data = {
            "property_id": property_id,
            "tenant_id": tenant_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "monthly_rent": 50000,
            "security_deposit": 100000
        }
        
        success, response = self.run_test("Create rental", "POST", "rentals", 201, rental_data)
        if success and 'id' in response:
            self.created_entities['rentals'].append(response['id'])
            return True, response
        return False, {}

    def test_get_rentals(self):
        """Test getting all rentals"""
        return self.run_test("Get all rentals", "GET", "rentals", 200)

    def test_get_rental_by_id(self, rental_id):
        """Test getting a specific rental"""
        return self.run_test(f"Get rental {rental_id[:8]}", "GET", f"rentals/{rental_id}", 200)

    def test_create_payment(self, rental_id):
        """Test payment creation"""
        due_date = date.today() + timedelta(days=30)
        
        payment_data = {
            "rental_id": rental_id,
            "amount": 50000,
            "due_date": due_date.isoformat(),
            "notes": "Test payment"
        }
        
        success, response = self.run_test("Create payment", "POST", "payments", 201, payment_data)
        if success and 'id' in response:
            self.created_entities['payments'].append(response['id'])
            return True, response
        return False, {}

    def test_get_payments(self):
        """Test getting all payments"""
        return self.run_test("Get all payments", "GET", "payments", 200)

    def test_mark_payment_paid(self, payment_id):
        """Test marking payment as paid"""
        return self.run_test(f"Mark payment {payment_id[:8]} as paid", "PUT", f"payments/{payment_id}/pay", 200)

    def test_create_document(self, property_id):
        """Test document creation"""
        document_data = {
            "property_id": property_id,
            "title": "Test Lease Agreement",
            "category": "lease_agreement",
            "uploaded_by": "Test Manager"
        }
        
        success, response = self.run_test("Create document", "POST", "documents", 201, document_data)
        if success and 'id' in response:
            self.created_entities['documents'].append(response['id'])
            return True, response
        return False, {}

    def test_get_documents(self):
        """Test getting all documents"""
        return self.run_test("Get all documents", "GET", "documents", 200)

    def test_get_property_documents(self, property_id):
        """Test getting documents for a specific property"""
        return self.run_test(f"Get documents for property {property_id[:8]}", "GET", f"documents/property/{property_id}", 200)

    def test_delete_property(self, property_id):
        """Test property deletion"""
        return self.run_test(f"Delete property {property_id[:8]}", "DELETE", f"properties/{property_id}", 200)

    def test_property_status_change(self):
        """Test that property status changes to 'rented' when rental is created"""
        # Create a property
        success, property_data = self.test_create_property()
        if not success:
            return False
        
        property_id = property_data['id']
        
        # Create a tenant
        success, tenant_data = self.test_create_tenant()
        if not success:
            return False
        
        tenant_id = tenant_data['id']
        
        # Verify property is initially available
        success, initial_property = self.test_get_property_by_id(property_id)
        if not success:
            return False
        
        if initial_property.get('status') != 'available':
            self.log_test("Property initial status check", False, f"Expected 'available', got '{initial_property.get('status')}'")
            return False
        
        # Create rental
        success, rental_data = self.test_create_rental(property_id, tenant_id)
        if not success:
            return False
        
        # Verify property status changed to rented
        success, updated_property = self.test_get_property_by_id(property_id)
        if not success:
            return False
        
        if updated_property.get('status') == 'rented':
            self.log_test("Property status change to rented", True)
            return True
        else:
            self.log_test("Property status change to rented", False, f"Expected 'rented', got '{updated_property.get('status')}'")
            return False

def main():
    print("🏠 Starting Real Estate Management API Tests")
    print("=" * 50)
    
    tester = RealEstateAPITester()
    
    # Test basic endpoints
    print("\n📊 Testing Basic Endpoints...")
    tester.test_root_endpoint()
    tester.test_analytics_dashboard()
    tester.test_analytics_revenue()
    
    # Test property management
    print("\n🏢 Testing Property Management...")
    tester.test_get_properties()
    success, property_data = tester.test_create_property()
    
    if success and property_data:
        property_id = property_data['id']
        tester.test_get_property_by_id(property_id)
        tester.test_update_property(property_id)
    
    # Test tenant management
    print("\n👥 Testing Tenant Management...")
    tester.test_get_tenants()
    success, tenant_data = tester.test_create_tenant()
    
    # Test rental management
    print("\n📋 Testing Rental Management...")
    tester.test_get_rentals()
    
    if (success and tenant_data and 
        tester.created_entities['properties'] and 
        tester.created_entities['tenants']):
        
        property_id = tester.created_entities['properties'][0]
        tenant_id = tester.created_entities['tenants'][0]
        
        success, rental_data = tester.test_create_rental(property_id, tenant_id)
        if success and rental_data:
            rental_id = rental_data['id']
            tester.test_get_rental_by_id(rental_id)
    
    # Test payment management
    print("\n💰 Testing Payment Management...")
    tester.test_get_payments()
    
    if tester.created_entities['rentals']:
        rental_id = tester.created_entities['rentals'][0]
        success, payment_data = tester.test_create_payment(rental_id)
        if success and payment_data:
            payment_id = payment_data['id']
            tester.test_mark_payment_paid(payment_id)
    
    # Test document management
    print("\n📄 Testing Document Management...")
    tester.test_get_documents()
    
    if tester.created_entities['properties']:
        property_id = tester.created_entities['properties'][0]
        tester.test_create_document(property_id)
        tester.test_get_property_documents(property_id)
    
    # Test business logic
    print("\n🔄 Testing Business Logic...")
    tester.test_property_status_change()
    
    # Clean up - delete created property (this should be done last)
    print("\n🧹 Testing Cleanup...")
    if tester.created_entities['properties']:
        # Only delete the first property to test deletion functionality
        property_id = tester.created_entities['properties'][0]
        tester.test_delete_property(property_id)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed!")
        failed_tests = [test for test in tester.test_results if not test['success']]
        print("\nFailed tests:")
        for test in failed_tests:
            print(f"  - {test['name']}: {test['details']}")
        return 1

if __name__ == "__main__":
    sys.exit(main())