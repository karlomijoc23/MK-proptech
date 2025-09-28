from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date
from enum import Enum
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class PropertyType(str, Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial" 
    LAND = "land"

class PropertyStatus(str, Enum):
    AVAILABLE = "available"
    RENTED = "rented"
    MAINTENANCE = "maintenance"

class RentalStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"

class PaymentStatus(str, Enum):
    PAID = "paid"
    PENDING = "pending"
    OVERDUE = "overdue"

# Helper functions
def prepare_for_mongo(data):
    """Convert date/datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Parse date/datetime strings back to Python objects"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and 'date' in key.lower():
                try:
                    # Try parsing as date first, then datetime
                    if 'T' in value:
                        item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    else:
                        item[key] = datetime.fromisoformat(value).date()
                except:
                    pass
    return item

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    role: str = "property_manager"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    email: str

class Property(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    address: str
    property_type: PropertyType
    area: float  # in square meters
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    description: Optional[str] = None
    monthly_rent: float
    status: PropertyStatus = PropertyStatus.AVAILABLE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PropertyCreate(BaseModel):
    title: str
    address: str
    property_type: PropertyType
    area: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    description: Optional[str] = None
    monthly_rent: float

class Tenant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    id_number: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TenantCreate(BaseModel):
    name: str
    email: str
    phone: str
    id_number: str

class Rental(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    tenant_id: str
    start_date: date
    end_date: date
    monthly_rent: float
    security_deposit: float
    status: RentalStatus = RentalStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RentalCreate(BaseModel):
    property_id: str
    tenant_id: str
    start_date: date
    end_date: date
    monthly_rent: float
    security_deposit: float

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rental_id: str
    amount: float
    due_date: date
    payment_date: Optional[date] = None
    status: PaymentStatus = PaymentStatus.PENDING
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentCreate(BaseModel):
    rental_id: str
    amount: float
    due_date: date
    notes: Optional[str] = None

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    title: str
    category: str  # lease_agreement, insurance, maintenance, etc
    file_path: str
    file_size: int
    uploaded_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentCreate(BaseModel):
    property_id: str
    title: str
    category: str
    uploaded_by: str

# Routes

# Root route
@api_router.get("/")
async def root():
    return {"message": "Real Estate Management API", "status": "active"}

# Authentication & Users
@api_router.post("/users", response_model=User, status_code=201)
async def create_user(user: UserCreate):
    user_dict = prepare_for_mongo(user.dict())
    user_obj = User(**user_dict)
    await db.users.insert_one(prepare_for_mongo(user_obj.dict()))
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find().to_list(1000)
    return [User(**parse_from_mongo(user)) for user in users]

# Properties
@api_router.post("/properties", response_model=Property, status_code=201)
async def create_property(property_data: PropertyCreate):
    property_dict = prepare_for_mongo(property_data.dict())
    property_obj = Property(**property_dict)
    await db.properties.insert_one(prepare_for_mongo(property_obj.dict()))
    return property_obj

@api_router.get("/properties", response_model=List[Property])
async def get_properties():
    properties = await db.properties.find().to_list(1000)
    return [Property(**parse_from_mongo(prop)) for prop in properties]

@api_router.get("/properties/{property_id}", response_model=Property)
async def get_property(property_id: str):
    property_data = await db.properties.find_one({"id": property_id})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    return Property(**parse_from_mongo(property_data))

@api_router.put("/properties/{property_id}", response_model=Property)
async def update_property(property_id: str, property_data: PropertyCreate):
    property_dict = prepare_for_mongo(property_data.dict())
    result = await db.properties.update_one(
        {"id": property_id}, 
        {"$set": property_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    
    updated_property = await db.properties.find_one({"id": property_id})
    return Property(**parse_from_mongo(updated_property))

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str):
    result = await db.properties.delete_one({"id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"message": "Property deleted successfully"}

# Tenants
@api_router.post("/tenants", response_model=Tenant, status_code=201)
async def create_tenant(tenant: TenantCreate):
    tenant_dict = prepare_for_mongo(tenant.dict())
    tenant_obj = Tenant(**tenant_dict)
    await db.tenants.insert_one(prepare_for_mongo(tenant_obj.dict()))
    return tenant_obj

@api_router.get("/tenants", response_model=List[Tenant])
async def get_tenants():
    tenants = await db.tenants.find().to_list(1000)
    return [Tenant(**parse_from_mongo(tenant)) for tenant in tenants]

# Rentals
@api_router.post("/rentals", response_model=Rental, status_code=201)
async def create_rental(rental: RentalCreate):
    rental_dict = prepare_for_mongo(rental.dict())
    rental_obj = Rental(**rental_dict)
    
    # Update property status to rented
    await db.properties.update_one(
        {"id": rental.property_id},
        {"$set": {"status": PropertyStatus.RENTED}}
    )
    
    await db.rentals.insert_one(prepare_for_mongo(rental_obj.dict()))
    return rental_obj

@api_router.get("/rentals", response_model=List[Rental])
async def get_rentals():
    rentals = await db.rentals.find().to_list(1000)
    return [Rental(**parse_from_mongo(rental)) for rental in rentals]

@api_router.get("/rentals/{rental_id}", response_model=Rental)
async def get_rental(rental_id: str):
    rental_data = await db.rentals.find_one({"id": rental_id})
    if not rental_data:
        raise HTTPException(status_code=404, detail="Rental not found")
    return Rental(**parse_from_mongo(rental_data))

# Payments
@api_router.post("/payments", response_model=Payment, status_code=201)
async def create_payment(payment: PaymentCreate):
    payment_dict = prepare_for_mongo(payment.dict())
    payment_obj = Payment(**payment_dict)
    await db.payments.insert_one(prepare_for_mongo(payment_obj.dict()))
    return payment_obj

@api_router.get("/payments", response_model=List[Payment])
async def get_payments():
    payments = await db.payments.find().to_list(1000)
    return [Payment(**parse_from_mongo(payment)) for payment in payments]

@api_router.put("/payments/{payment_id}/pay")
async def mark_payment_paid(payment_id: str):
    result = await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": PaymentStatus.PAID, "payment_date": datetime.now(timezone.utc).date().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment marked as paid"}

# Documents
@api_router.post("/documents", response_model=Document)
async def create_document(document: DocumentCreate):
    document_dict = prepare_for_mongo(document.dict())
    document_obj = Document(**document_dict, file_path="", file_size=0)
    await db.documents.insert_one(prepare_for_mongo(document_obj.dict()))
    return document_obj

@api_router.get("/documents", response_model=List[Document])
async def get_documents():
    documents = await db.documents.find().to_list(1000)
    return [Document(**parse_from_mongo(doc)) for doc in documents]

@api_router.get("/documents/property/{property_id}", response_model=List[Document])
async def get_property_documents(property_id: str):
    documents = await db.documents.find({"property_id": property_id}).to_list(1000)
    return [Document(**parse_from_mongo(doc)) for doc in documents]

# Analytics & Reports
@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics():
    # Get counts
    total_properties = await db.properties.count_documents({})
    active_rentals = await db.rentals.count_documents({"status": RentalStatus.ACTIVE})
    pending_payments = await db.payments.count_documents({"status": PaymentStatus.PENDING})
    overdue_payments = await db.payments.count_documents({"status": PaymentStatus.OVERDUE})
    
    # Calculate monthly revenue
    current_date = datetime.now(timezone.utc)
    current_month_start = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    monthly_revenue_pipeline = [
        {"$match": {"status": PaymentStatus.PAID, "payment_date": {"$gte": current_month_start.date().isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    monthly_revenue_result = await db.payments.aggregate(monthly_revenue_pipeline).to_list(1)
    monthly_revenue = monthly_revenue_result[0]["total"] if monthly_revenue_result else 0
    
    return {
        "total_properties": total_properties,
        "active_rentals": active_rentals,
        "pending_payments": pending_payments,
        "overdue_payments": overdue_payments,
        "monthly_revenue": monthly_revenue
    }

@api_router.get("/analytics/revenue")
async def get_revenue_analytics():
    # Monthly revenue for the last 12 months
    pipeline = [
        {"$match": {"status": PaymentStatus.PAID}},
        {"$group": {
            "_id": {"$substr": ["$payment_date", 0, 7]},  # YYYY-MM format
            "revenue": {"$sum": "$amount"}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12}
    ]
    
    revenue_data = await db.payments.aggregate(pipeline).to_list(12)
    
    return {
        "monthly_revenue": [
            {"month": item["_id"], "revenue": item["revenue"]} 
            for item in revenue_data
        ]
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()