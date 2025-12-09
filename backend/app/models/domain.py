from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


# Enums
class TenantType(str, Enum):
    PERSONAL = "personal"
    COMPANY = "company"


class TenantStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class TenantMembershipRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class TenantMembershipStatus(str, Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


class VrstaNekrtnine(str, Enum):
    POSLOVNA_ZGRADA = "poslovna_zgrada"
    STAN = "stan"
    ZEMLJISTE = "zemljiste"
    OSTALO = "ostalo"


class StatusUgovora(str, Enum):
    AKTIVNO = "aktivno"
    NA_ISTEKU = "na_isteku"
    RASKINUTO = "raskinuto"
    ARHIVIRANO = "arhivirano"


class ZakupnikStatus(str, Enum):
    AKTIVAN = "aktivan"
    ARHIVIRAN = "arhiviran"


class ZakupnikTip(str, Enum):
    ZAKUPNIK = "zakupnik"
    PARTNER = "partner"


class TipDokumenta(str, Enum):
    UGOVOR = "ugovor"
    ANEKS = "aneks"
    CERTIFIKAT = "certifikat"
    OSIGURANJE = "osiguranje"
    ZEMLJISNOKNJIZNI_IZVADAK = "zemljisnoknjizni_izvadak"
    UPORABNA_DOZVOLA = "uporabna_dozvola"
    GRADEVINSKA_DOZVOLA = "gradevinska_dozvola"
    ENERGETSKI_CERTIFIKAT = "energetski_certifikat"
    IZVADAK_IZ_REGISTRA = "izvadak_iz_registra"
    BON_2 = "bon_2"
    RACUN = "racun"
    PROCJENA_VRIJEDNOSTI = "procjena_vrijednosti"
    LOKACIJSKA_INFORMACIJA = "lokacijska_informacija"
    PRIMOPREDAJNI_ZAPISNIK = "primopredajni_zapisnik"
    OSTALO = "ostalo"


class UtilityType(str, Enum):
    STRUJA = "struja"
    VODA = "voda"
    PLIN = "plin"
    KOMUNALIJE = "komunalije"
    INTERNET = "internet"
    OSTALE = "ostalo"


class BillStatus(str, Enum):
    DRAFT = "draft"
    DUE = "due"
    PAID = "paid"
    PARTIAL = "partial"
    DISPUTED = "disputed"


class PropertyUnitStatus(str, Enum):
    DOSTUPNO = "dostupno"
    REZERVIRANO = "rezervirano"
    IZNAJMLJENO = "iznajmljeno"
    U_ODRZAVANJU = "u_odrzavanju"


class MaintenanceStatus(str, Enum):
    NOVI = "novi"
    PLANIRAN = "planiran"
    U_TOKU = "u_tijeku"
    CEKA_DOBAVLJACA = "ceka_dobavljaca"
    POTREBNA_ODLUKA = "potrebna_odluka"
    ZAVRSENO = "zavrseno"
    ARHIVIRANO = "arhivirano"


class MaintenancePriority(str, Enum):
    NISKO = "nisko"
    SREDNJE = "srednje"
    VISOKO = "visoko"
    KRITICNO = "kriticno"


# Models
class KontaktOsoba(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ime: str
    uloga: Optional[str] = None
    email: Optional[EmailStr] = None
    telefon: Optional[str] = None
    napomena: Optional[str] = None
    preferirani_kanal: Optional[str] = None
    hitnost_odziva_sati: Optional[int] = None


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    full_name: Optional[str] = None
    role: str = "viewer"
    scopes: List[str] = []
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserMembershipDisplay(BaseModel):
    tenant_id: str
    tenant_name: str
    role: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    scopes: List[str]
    active: bool
    created_at: datetime
    updated_at: datetime
    memberships: Optional[List[UserMembershipDisplay]] = []


class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user: str
    role: str
    actor_id: Optional[str] = None
    method: str
    path: str
    status_code: int
    scopes: List[str] = []
    query_params: Dict[str, Any] = {}
    request_payload: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    request_id: Optional[str] = None
    message: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_parent_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None


class Tenant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str
    tip: TenantType = TenantType.COMPANY
    status: TenantStatus = TenantStatus.ACTIVE
    oib: Optional[str] = None
    iban: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None


class TenantMembership(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tenant_id: str
    role: TenantMembershipRole = TenantMembershipRole.MEMBER
    status: TenantMembershipStatus = TenantMembershipStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    invited_by: Optional[str] = None


class ProtocolType(str, Enum):
    ENTRY = "entry"  # Ulazni
    EXIT = "exit"  # Izlazni


class HandoverProtocol(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contract_id: str
    type: ProtocolType
    date: date
    meter_readings: Dict[str, Any] = {}  # e.g. {"struja": "12345", "voda": "555"}
    keys_handed_over: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
