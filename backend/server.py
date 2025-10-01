from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, timedelta
from enum import Enum
import json
import tempfile
import shutil
import uuid as uuid_module
from openai import OpenAI
from PyPDF2 import PdfReader
import asyncio
import copy
import re
from types import SimpleNamespace
from fastapi.staticfiles import StaticFiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)


def _parse_api_tokens() -> Dict[str, str]:
    tokens_raw = os.environ.get('API_TOKENS')
    if tokens_raw:
        mapping = {}
        for pair in tokens_raw.split(','):
            if not pair.strip():
                continue
            if ':' in pair:
                token, role = pair.split(':', 1)
            else:
                token, role = pair, 'admin'
            mapping[token.strip()] = role.strip() or 'admin'
        return mapping
    single = os.environ.get('API_TOKEN')
    if single:
        return {single: os.environ.get('DEFAULT_ROLE', 'admin')}
    return {}


API_TOKENS = _parse_api_tokens()
DEFAULT_ROLE = os.environ.get('DEFAULT_ROLE', 'admin')

# In-memory fallback implementations -------------------------------------------------

def _deepcopy(data: Dict[str, Any]) -> Dict[str, Any]:
    return copy.deepcopy(data)


def _value_matches(doc_value, condition_value, options: Dict[str, Any]) -> bool:
    if isinstance(condition_value, dict):
        if '$regex' in condition_value:
            pattern = condition_value['$regex']
            flags = re.IGNORECASE if 'i' in condition_value.get('$options', '') else 0
            return re.search(pattern, str(doc_value or ''), flags) is not None
        if '$lte' in condition_value:
            return doc_value is not None and doc_value <= condition_value['$lte']
        if '$gte' in condition_value:
            return doc_value is not None and doc_value >= condition_value['$gte']
        if '$gt' in condition_value:
            return doc_value is not None and doc_value > condition_value['$gt']
        if '$lt' in condition_value:
            return doc_value is not None and doc_value < condition_value['$lt']
        if '$ne' in condition_value:
            return doc_value != condition_value['$ne']
        # default fallback equality for other operators if present
        return doc_value == condition_value
    return doc_value == condition_value


def _document_matches(document: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
    if not query:
        return True
    for key, value in query.items():
        if key == '$or':
            if not any(_document_matches(document, sub_query) for sub_query in value):
                return False
            continue
        doc_value = document.get(key)
        if not _value_matches(doc_value, value, {}):
            return False
    return True


class InMemoryCursor:
    def __init__(self, documents: List[Dict[str, Any]]):
        self._documents = documents

    async def to_list(self, limit: int) -> List[Dict[str, Any]]:
        return [_deepcopy(doc) for doc in self._documents[:limit]]


class InMemoryCollection:
    def __init__(self):
        self._documents: List[Dict[str, Any]] = []

    async def insert_one(self, document: Dict[str, Any]) -> SimpleNamespace:
        self._documents.append(_deepcopy(document))
        return SimpleNamespace(inserted_id=document.get('id'))

    def find(self, query: Optional[Dict[str, Any]] = None) -> InMemoryCursor:
        filtered = [doc for doc in self._documents if _document_matches(doc, query)]
        return InMemoryCursor(filtered)

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for doc in self._documents:
            if _document_matches(doc, query):
                return _deepcopy(doc)
        return None

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]) -> SimpleNamespace:
        matched = 0
        modified = 0
        for index, doc in enumerate(self._documents):
            if _document_matches(doc, query):
                matched += 1
                if '$set' in update:
                    for key, value in update['$set'].items():
                        self._documents[index][key] = value
                modified += 1
                break
        return SimpleNamespace(matched_count=matched, modified_count=modified)

    async def delete_one(self, query: Dict[str, Any]) -> SimpleNamespace:
        deleted = 0
        for index, doc in enumerate(list(self._documents)):
            if _document_matches(doc, query):
                del self._documents[index]
                deleted = 1
                break
        return SimpleNamespace(deleted_count=deleted)

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        return len([doc for doc in self._documents if _document_matches(doc, query)])

    def aggregate(self, pipeline: List[Dict[str, Any]]) -> InMemoryCursor:
        results = self._documents
        for stage in pipeline:
            if '$match' in stage:
                results = [doc for doc in results if _document_matches(doc, stage['$match'])]
            elif '$group' in stage:
                group_spec = stage['$group']
                sum_key = None
                sum_field = None
                for key, value in group_spec.items():
                    if key == '_id':
                        continue
                    if isinstance(value, dict) and '$sum' in value:
                        sum_key = key
                        sum_field = value['$sum'].lstrip('$')
                total = 0
                if sum_field:
                    for doc in results:
                        total += float(doc.get(sum_field, 0) or 0)
                results = [{'_id': group_spec.get('_id'), sum_key: total}] if sum_key else results
        return InMemoryCursor(results)


class InMemoryDatabase:
    def __init__(self):
        self.nekretnine = InMemoryCollection()
        self.zakupnici = InMemoryCollection()
        self.ugovori = InMemoryCollection()
        self.dokumenti = InMemoryCollection()
        self.podsjetnici = InMemoryCollection()
        self.racuni = InMemoryCollection()
        self.activity_logs = InMemoryCollection()


# MongoDB connection with optional in-memory fallback
USE_IN_MEMORY_DB = os.environ.get('USE_IN_MEMORY_DB', 'false').lower() == 'true'
client = None

if USE_IN_MEMORY_DB:
    db = InMemoryDatabase()
else:
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]


async def log_activity(user: Dict[str, str], method: str, path: str, status: int):
    try:
        log = ActivityLog(
            user=user.get('name', 'anonymous'),
            role=user.get('role', DEFAULT_ROLE),
            method=method,
            path=path,
            status_code=status,
        )
        await db.activity_logs.insert_one(prepare_for_mongo(log.dict()))
    except Exception as exc:
        logger.error("Failed to log activity: %s", exc)


def get_current_user(request: Request) -> Dict[str, str]:
    if not API_TOKENS:
        user = {"name": "anonymous", "role": DEFAULT_ROLE}
        request.state.current_user = user
        return user

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        role = API_TOKENS.get(token)
        if role:
            user = {"name": token, "role": role}
            request.state.current_user = user
            return user

    raise HTTPException(status_code=401, detail="Neautorizirano", headers={"WWW-Authenticate": "Bearer"})

# Create the main app without a prefix
app = FastAPI()

# Activity logging middleware
@app.middleware("http")
async def activity_logger(request: Request, call_next):
    user = getattr(request.state, "current_user", {"name": "guest", "role": DEFAULT_ROLE})
    response = await call_next(request)
    await log_activity(user, request.method, request.url.path, response.status_code)
    return response

# Create a router with the /api prefix and auth dependency
api_router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])

# Enums
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

# Helper functions
def prepare_for_mongo(data):
    """Convert date/datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, list):
                data[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
    return data

def parse_from_mongo(item):
    """Parse date/datetime strings back to Python objects"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and 'datum' in key.lower():
                try:
                    if 'T' in value:
                        item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    else:
                        item[key] = datetime.fromisoformat(value).date()
                except (ValueError, TypeError):
                    pass
    return item

# Models

class Nekretnina(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str
    adresa: str
    katastarska_opcina: str
    broj_kat_cestice: str
    vrsta: VrstaNekrtnine
    povrsina: float  # m²
    godina_izgradnje: Optional[int] = None
    vlasnik: str
    udio_vlasnistva: str
    
    # Financije
    nabavna_cijena: Optional[float] = None  # €
    trzisna_vrijednost: Optional[float] = None  # €
    prosllogodisnji_prihodi: Optional[float] = None  # €
    prosllogodisnji_rashodi: Optional[float] = None  # €
    amortizacija: Optional[float] = None  # €
    neto_prihod: Optional[float] = None  # €
    
    # Održavanje
    zadnja_obnova: Optional[date] = None
    potrebna_ulaganja: Optional[str] = None
    troskovi_odrzavanja: Optional[float] = None  # €
    osiguranje: Optional[str] = None
    
    # Rizici
    sudski_sporovi: Optional[str] = None
    hipoteke: Optional[str] = None
    napomene: Optional[str] = None
    
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NekretninarCreate(BaseModel):
    naziv: str
    adresa: str
    katastarska_opcina: str
    broj_kat_cestice: str
    vrsta: VrstaNekrtnine
    povrsina: float
    godina_izgradnje: Optional[int] = None
    vlasnik: str
    udio_vlasnistva: str
    nabavna_cijena: Optional[float] = None
    trzisna_vrijednost: Optional[float] = None
    prosllogodisnji_prihodi: Optional[float] = None
    prosllogodisnji_rashodi: Optional[float] = None
    amortizacija: Optional[float] = None
    neto_prihod: Optional[float] = None
    zadnja_obnova: Optional[date] = None
    potrebna_ulaganja: Optional[str] = None
    troskovi_odrzavanja: Optional[float] = None
    osiguranje: Optional[str] = None
    sudski_sporovi: Optional[str] = None
    hipoteke: Optional[str] = None
    napomene: Optional[str] = None

class Zakupnik(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv_firme: Optional[str] = None
    ime_prezime: Optional[str] = None
    oib: str  # OIB ili VAT ID
    sjediste: str
    kontakt_ime: str
    kontakt_email: str
    kontakt_telefon: str
    iban: Optional[str] = None
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ZakupnikCreate(BaseModel):
    naziv_firme: Optional[str] = None
    ime_prezime: Optional[str] = None
    oib: str
    sjediste: str
    kontakt_ime: str
    kontakt_email: str
    kontakt_telefon: str
    iban: Optional[str] = None

class Ugovor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interna_oznaka: str
    status: StatusUgovora = StatusUgovora.AKTIVNO
    nekretnina_id: str
    zakupnik_id: str
    
    datum_potpisivanja: date
    datum_pocetka: date
    datum_zavrsetka: date
    trajanje_mjeseci: int
    
    opcija_produljenja: bool = False
    uvjeti_produljenja: Optional[str] = None
    rok_otkaza_dani: int = 30
    
    # Financije
    osnovna_zakupnina: float  # €
    zakupnina_po_m2: Optional[float] = None  # €/m²
    cam_troskovi: Optional[float] = None  # €
    polog_depozit: Optional[float] = None  # €
    garancija: Optional[float] = None  # €
    indeksacija: bool = False
    indeks: Optional[str] = None
    formula_indeksacije: Optional[str] = None
    
    obveze_odrzavanja: Optional[str] = None  # zakupodavac/zakupnik
    namjena_prostora: Optional[str] = None
    rezije_brojila: Optional[str] = None
    
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UgovorCreate(BaseModel):
    interna_oznaka: str
    nekretnina_id: str
    zakupnik_id: str
    datum_potpisivanja: date
    datum_pocetka: date
    datum_zavrsetka: date
    trajanje_mjeseci: int
    opcija_produljenja: bool = False
    uvjeti_produljenja: Optional[str] = None
    rok_otkaza_dani: int = 30
    osnovna_zakupnina: float
    zakupnina_po_m2: Optional[float] = None
    cam_troskovi: Optional[float] = None
    polog_depozit: Optional[float] = None
    garancija: Optional[float] = None
    indeksacija: bool = False
    indeks: Optional[str] = None
    formula_indeksacije: Optional[str] = None
    obveze_odrzavanja: Optional[str] = None
    namjena_prostora: Optional[str] = None
    rezije_brojila: Optional[str] = None

class Dokument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str
    tip: TipDokumenta
    opis: Optional[str] = None
    verzija: str = "1.0"
    
    # Povezanosti
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    
    putanja_datoteke: str
    velicina_datoteke: int
    uploadao: str
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DokumentCreate(BaseModel):
    naziv: str
    tip: TipDokumenta
    opis: Optional[str] = None
    verzija: str = "1.0"
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    uploadao: str

class Podsjetnik(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tip: str  # istek_ugovora, obnova_garancije, indeksacija
    ugovor_id: str
    datum_podsjetnika: date
    dani_prije: int  # 180, 120, 90, 60, 30
    poslan: bool = False
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConsumptionItem(BaseModel):
    naziv: Optional[str] = None
    metric: Optional[str] = None  # kWh, m3, itd.
    prethodno_stanje: Optional[float] = None
    trenutno_stanje: Optional[float] = None
    potrosnja: Optional[float] = None
    cijena_po_jedinici: Optional[float] = None


class Racun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nekretnina_id: str
    ugovor_id: Optional[str] = None
    dokument_id: Optional[str] = None
    tip_rezije: UtilityType
    dobavljac: Optional[str] = None
    broj_racuna: Optional[str] = None
    razdoblje_od: Optional[date] = None
    razdoblje_do: Optional[date] = None
    datum_izdavanja: Optional[date] = None
    datum_dospijeca: Optional[date] = None
    iznos_za_platiti: float
    iznos_placen: Optional[float] = None
    valuta: str = "EUR"
    status: BillStatus = BillStatus.DUE
    napomena: Optional[str] = None
    stavke: Optional[List[ConsumptionItem]] = None
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    placeno_na_dan: Optional[date] = None


class RacunCreate(BaseModel):
    nekretnina_id: str
    ugovor_id: Optional[str] = None
    dokument_id: Optional[str] = None
    tip_rezije: UtilityType
    dobavljac: Optional[str] = None
    broj_racuna: Optional[str] = None
    razdoblje_od: Optional[date] = None
    razdoblje_do: Optional[date] = None
    datum_izdavanja: Optional[date] = None
    datum_dospijeca: Optional[date] = None
    iznos_za_platiti: float
    iznos_placen: Optional[float] = None
    valuta: Optional[str] = None
    status: Optional[BillStatus] = None
    napomena: Optional[str] = None
    stavke: Optional[List[ConsumptionItem]] = None
    placeno_na_dan: Optional[date] = None


class RacunUpdate(BaseModel):
    nekretnina_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    tip_rezije: Optional[UtilityType] = None
    dobavljac: Optional[str] = None
    broj_racuna: Optional[str] = None
    razdoblje_od: Optional[date] = None
    razdoblje_do: Optional[date] = None
    datum_izdavanja: Optional[date] = None
    datum_dospijeca: Optional[date] = None
    iznos_za_platiti: Optional[float] = None
    iznos_placen: Optional[float] = None
    valuta: Optional[str] = None
    status: Optional[BillStatus] = None
    napomena: Optional[str] = None
    stavke: Optional[List[ConsumptionItem]] = None
    dokument_id: Optional[str] = None
    placeno_na_dan: Optional[date] = None


class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user: str
    role: str
    method: str
    path: str
    status_code: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: Optional[str] = None


# Routes

# Root route
@api_router.get("/")
async def root():
    return {"message": "Sustav za upravljanje nekretninama", "status": "aktivan"}

# Nekretnine
@api_router.post("/nekretnine", response_model=Nekretnina, status_code=201)
async def create_nekretnina(nekretnina: NekretninarCreate):
    nekretnina_dict = prepare_for_mongo(nekretnina.dict())
    nekretnina_obj = Nekretnina(**nekretnina_dict)
    await db.nekretnine.insert_one(prepare_for_mongo(nekretnina_obj.dict()))
    return nekretnina_obj

@api_router.get("/nekretnine", response_model=List[Nekretnina])
async def get_nekretnine():
    nekretnine = await db.nekretnine.find().to_list(1000)
    return [Nekretnina(**parse_from_mongo(n)) for n in nekretnine]

@api_router.get("/nekretnine/{nekretnina_id}", response_model=Nekretnina)
async def get_nekretnina(nekretnina_id: str):
    nekretnina = await db.nekretnine.find_one({"id": nekretnina_id})
    if not nekretnina:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")
    return Nekretnina(**parse_from_mongo(nekretnina))

@api_router.put("/nekretnine/{nekretnina_id}", response_model=Nekretnina)
async def update_nekretnina(nekretnina_id: str, nekretnina: NekretninarCreate):
    nekretnina_dict = prepare_for_mongo(nekretnina.dict())
    result = await db.nekretnine.update_one(
        {"id": nekretnina_id}, 
        {"$set": nekretnina_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")
    
    updated_nekretnina = await db.nekretnine.find_one({"id": nekretnina_id})
    return Nekretnina(**parse_from_mongo(updated_nekretnina))

@api_router.delete("/nekretnine/{nekretnina_id}")
async def delete_nekretnina(nekretnina_id: str):
    result = await db.nekretnine.delete_one({"id": nekretnina_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")
    return {"poruka": "Nekretnina je uspješno obrisana"}

# Zakupnici
@api_router.post("/zakupnici", response_model=Zakupnik, status_code=201)
async def create_zakupnik(zakupnik: ZakupnikCreate):
    zakupnik_dict = prepare_for_mongo(zakupnik.dict())
    zakupnik_obj = Zakupnik(**zakupnik_dict)
    await db.zakupnici.insert_one(prepare_for_mongo(zakupnik_obj.dict()))
    return zakupnik_obj

@api_router.get("/zakupnici", response_model=List[Zakupnik])
async def get_zakupnici():
    zakupnici = await db.zakupnici.find().to_list(1000)
    return [Zakupnik(**parse_from_mongo(z)) for z in zakupnici]

@api_router.get("/zakupnici/{zakupnik_id}", response_model=Zakupnik)
async def get_zakupnik(zakupnik_id: str):
    zakupnik = await db.zakupnici.find_one({"id": zakupnik_id})
    if not zakupnik:
        raise HTTPException(status_code=404, detail="Zakupnik nije pronađen")
    return Zakupnik(**parse_from_mongo(zakupnik))

# Ugovori
@api_router.post("/ugovori", response_model=Ugovor, status_code=201)
async def create_ugovor(ugovor: UgovorCreate):
    ugovor_dict = prepare_for_mongo(ugovor.dict())
    ugovor_obj = Ugovor(**ugovor_dict)
    
    # Kreiraj automatske podsjetnike
    await create_podsjetnici_za_ugovor(ugovor_obj)
    
    await db.ugovori.insert_one(prepare_for_mongo(ugovor_obj.dict()))
    return ugovor_obj

@api_router.get("/ugovori", response_model=List[Ugovor])
async def get_ugovori():
    ugovori = await db.ugovori.find().to_list(1000)
    return [Ugovor(**parse_from_mongo(u)) for u in ugovori]

@api_router.get("/ugovori/{ugovor_id}", response_model=Ugovor)
async def get_ugovor(ugovor_id: str):
    ugovor = await db.ugovori.find_one({"id": ugovor_id})
    if not ugovor:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
    return Ugovor(**parse_from_mongo(ugovor))

class StatusUpdate(BaseModel):
    novi_status: StatusUgovora

@api_router.put("/ugovori/{ugovor_id}/status")
async def update_status_ugovora(ugovor_id: str, status_data: StatusUpdate):
    result = await db.ugovori.update_one(
        {"id": ugovor_id},
        {"$set": {"status": status_data.novi_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
    return {"poruka": f"Status ugovora ažuriran na {status_data.novi_status}"}

# Dokumenti
@api_router.post("/dokumenti", response_model=Dokument, status_code=201)
async def create_dokument(request: Request):
    content_type = request.headers.get('content-type', '')
    upload_file: Optional[UploadFile] = None

    try:
        if 'application/json' in content_type:
            payload = await request.json()
            dokument_input = DokumentCreate(**payload)
        else:
            form = await request.form()
            upload_file = form.get('file')
            field_values = {
                'naziv': form.get('naziv'),
                'tip': form.get('tip'),
                'opis': form.get('opis') or None,
                'verzija': form.get('verzija') or '1.0',
                'nekretnina_id': form.get('nekretnina_id'),
                'zakupnik_id': form.get('zakupnik_id'),
                'ugovor_id': form.get('ugovor_id'),
                'uploadao': form.get('uploadao'),
            }

            for key in ('nekretnina_id', 'zakupnik_id', 'ugovor_id'):
                if not field_values[key] or field_values[key] == 'none':
                    field_values[key] = None

            if not field_values['naziv'] or not field_values['tip'] or not field_values['uploadao']:
                raise HTTPException(status_code=400, detail='Naziv, tip i uploadao su obavezni')

            dokument_input = DokumentCreate(**field_values)

    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    file_path = ""
    file_size = 0

    if upload_file and getattr(upload_file, 'filename', ''):
        filename = Path(upload_file.filename).name
        if not filename.lower().endswith('.pdf') or (upload_file.content_type and 'pdf' not in upload_file.content_type):
            raise HTTPException(status_code=400, detail='Datoteka mora biti PDF format')

        file_bytes = await upload_file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail='PDF datoteka je prazna')

        safe_name = f"{uuid.uuid4()}_{filename}"
        destination = UPLOAD_DIR / safe_name

        with destination.open('wb') as buffer:
            buffer.write(file_bytes)

        file_path = f"uploads/{safe_name}"
        file_size = len(file_bytes)

    dokument_dict = prepare_for_mongo(dokument_input.dict())
    dokument_obj = Dokument(**dokument_dict, putanja_datoteke=file_path, velicina_datoteke=file_size)
    await db.dokumenti.insert_one(prepare_for_mongo(dokument_obj.dict()))
    return dokument_obj

@api_router.get("/dokumenti", response_model=List[Dokument])
async def get_dokumenti():
    dokumenti = await db.dokumenti.find().to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]

@api_router.get("/dokumenti/nekretnina/{nekretnina_id}", response_model=List[Dokument])
async def get_dokumenti_nekretnine(nekretnina_id: str):
    dokumenti = await db.dokumenti.find({"nekretnina_id": nekretnina_id}).to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]

@api_router.get("/dokumenti/zakupnik/{zakupnik_id}", response_model=List[Dokument])
async def get_dokumenti_zakupnika(zakupnik_id: str):
    dokumenti = await db.dokumenti.find({"zakupnik_id": zakupnik_id}).to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]

@api_router.get("/dokumenti/ugovor/{ugovor_id}", response_model=List[Dokument])
async def get_dokumenti_ugovora(ugovor_id: str):
    dokumenti = await db.dokumenti.find({"ugovor_id": ugovor_id}).to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]

# Računi (utility bills)

def _enrich_racun_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    if 'iznos_za_platiti' in data and data['iznos_za_platiti'] is None:
        data['iznos_za_platiti'] = 0.0
    if 'valuta' not in data or not data['valuta']:
        data['valuta'] = 'EUR'
    if 'status' not in data or data['status'] is None:
        data['status'] = BillStatus.DUE
    return data


@api_router.post("/racuni", response_model=Racun, status_code=201)
async def create_racun(racun: RacunCreate):
    racun_dict = _enrich_racun_payload(racun.dict())
    racun_obj = Racun(**racun_dict)
    await db.racuni.insert_one(prepare_for_mongo(racun_obj.dict()))
    return racun_obj


@api_router.get("/racuni", response_model=List[Racun])
async def list_racuni(
    nekretnina_id: Optional[str] = None,
    ugovor_id: Optional[str] = None,
    status: Optional[BillStatus] = None,
    tip_rezije: Optional[UtilityType] = None,
    overdue: Optional[bool] = False,
):
    racuni_raw = await db.racuni.find().to_list(2000)
    racuni = [Racun(**parse_from_mongo(r)) for r in racuni_raw]

    if nekretnina_id:
        racuni = [r for r in racuni if r.nekretnina_id == nekretnina_id]
    if ugovor_id:
        racuni = [r for r in racuni if r.ugovor_id == ugovor_id]
    if status:
        racuni = [r for r in racuni if r.status == status]
    if tip_rezije:
        racuni = [r for r in racuni if r.tip_rezije == tip_rezije]
    if overdue:
        today = datetime.now(timezone.utc).date()
        racuni = [
            r for r in racuni
            if r.status in {BillStatus.DUE, BillStatus.DISPUTED, BillStatus.PARTIAL}
            and r.datum_dospijeca
            and r.datum_dospijeca < today
        ]

    return racuni


@api_router.get("/racuni/{racun_id}", response_model=Racun)
async def get_racun(racun_id: str):
    racun = await db.racuni.find_one({"id": racun_id})
    if not racun:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")
    return Racun(**parse_from_mongo(racun))


@api_router.put("/racuni/{racun_id}", response_model=Racun)
async def update_racun(racun_id: str, racun_update: RacunUpdate):
    update_data = {k: v for k, v in racun_update.dict(exclude_unset=True).items()}
    if not update_data:
        return await get_racun(racun_id)

    _enrich_racun_payload(update_data)
    result = await db.racuni.update_one({"id": racun_id}, {"$set": prepare_for_mongo(update_data)})
    if getattr(result, "matched_count", 0) == 0:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    updated = await db.racuni.find_one({"id": racun_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")
    return Racun(**parse_from_mongo(updated))


@api_router.delete("/racuni/{racun_id}")
async def delete_racun(racun_id: str):
    result = await db.racuni.delete_one({"id": racun_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")
    return {"poruka": "Račun je uspješno obrisan"}


@api_router.get("/activity-logs", response_model=List[ActivityLog])
async def get_activity_logs(limit: int = 100):
    raw_logs = await db.activity_logs.find().to_list(limit)
    logs = [ActivityLog(**parse_from_mongo(log)) for log in raw_logs]
    logs.sort(key=lambda item: item.timestamp, reverse=True)
    return logs[:limit]

# Podsjećanja
@api_router.get("/podsjetnici", response_model=List[Podsjetnik])
async def get_podsjetnici():
    podsjetnici = await db.podsjetnici.find().to_list(1000)
    return [Podsjetnik(**parse_from_mongo(p)) for p in podsjetnici]

@api_router.get("/podsjetnici/aktivni", response_model=List[Podsjetnik])
async def get_aktivni_podsjetnici():
    danas = datetime.now(timezone.utc).date()
    podsjetnici = await db.podsjetnici.find({
        "datum_podsjetnika": {"$lte": danas.isoformat()},
        "poslan": False
    }).to_list(1000)
    return [Podsjetnik(**parse_from_mongo(p)) for p in podsjetnici]

@api_router.put("/podsjetnici/{podsjetnik_id}/oznaci-poslan")
async def oznaci_podsjetnik_poslan(podsjetnik_id: str):
    result = await db.podsjetnici.update_one(
        {"id": podsjetnik_id},
        {"$set": {"poslan": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Podsjetnik nije pronađen")
    return {"poruka": "Podsjetnik je označen kao riješen"}

# Dashboard i analitika
@api_router.get("/dashboard")
async def get_dashboard():
    ukupno_nekretnina = await db.nekretnine.count_documents({})
    aktivni_ugovori = await db.ugovori.count_documents({"status": StatusUgovora.AKTIVNO})
    ugovori_na_isteku = await db.ugovori.count_documents({"status": StatusUgovora.NA_ISTEKU})
    aktivni_podsjetnici = await db.podsjetnici.count_documents({"poslan": False})
    
    # Izračunaj mjesečne prihode
    mjesecni_prihod_pipeline = [
        {"$match": {"status": StatusUgovora.AKTIVNO}},
        {"$group": {"_id": None, "ukupno": {"$sum": "$osnovna_zakupnina"}}}
    ]
    mjesecni_prihod_result = await db.ugovori.aggregate(mjesecni_prihod_pipeline).to_list(1)
    mjesecni_prihod = mjesecni_prihod_result[0]["ukupno"] if mjesecni_prihod_result else 0
    
    # Izračunaj ukupnu vrijednost portfelja
    portfelj_pipeline = [
        {"$match": {"trzisna_vrijednost": {"$ne": None, "$gt": 0}}},
        {"$group": {"_id": None, "ukupna_vrijednost": {"$sum": "$trzisna_vrijednost"}}}
    ]
    portfelj_result = await db.nekretnine.aggregate(portfelj_pipeline).to_list(1)
    ukupna_vrijednost_portfelja = portfelj_result[0]["ukupna_vrijednost"] if portfelj_result else 0
    
    # Izračunaj godišnji prinos
    godisnji_prinos = (mjesecni_prihod * 12) if mjesecni_prihod > 0 else 0
    prinos_postotak = (godisnji_prinos / ukupna_vrijednost_portfelja * 100) if ukupna_vrijednost_portfelja > 0 else 0
    
    return {
        "ukupno_nekretnina": ukupno_nekretnina,
        "aktivni_ugovori": aktivni_ugovori,
        "ugovori_na_isteku": ugovori_na_isteku,
        "aktivni_podsjetnici": aktivni_podsjetnici,
        "mjesecni_prihod": mjesecni_prihod,
        "ukupna_vrijednost_portfelja": ukupna_vrijednost_portfelja,
        "godisnji_prinos": godisnji_prinos,
        "prinos_postotak": round(prinos_postotak, 2)
    }

@api_router.get("/pretraga")
async def pretraga(q: str):
    # Pretraži po svim relevantnim poljima
    nekretnine = await db.nekretnine.find({
        "$or": [
            {"naziv": {"$regex": q, "$options": "i"}},
            {"adresa": {"$regex": q, "$options": "i"}},
            {"katastarska_opcina": {"$regex": q, "$options": "i"}}
        ]
    }).to_list(10)
    
    zakupnici = await db.zakupnici.find({
        "$or": [
            {"naziv_firme": {"$regex": q, "$options": "i"}},
            {"ime_prezime": {"$regex": q, "$options": "i"}},
            {"oib": {"$regex": q, "$options": "i"}}
        ]
    }).to_list(10)
    
    ugovori = await db.ugovori.find({
        "$or": [
            {"interna_oznaka": {"$regex": q, "$options": "i"}}
        ]
    }).to_list(10)
    
    return {
        "nekretnine": [Nekretnina(**parse_from_mongo(n)) for n in nekretnine],
        "zakupnici": [Zakupnik(**parse_from_mongo(z)) for z in zakupnici],
        "ugovori": [Ugovor(**parse_from_mongo(u)) for u in ugovori]
    }

@api_router.post("/ai/parse-pdf-contract")
async def parse_pdf_contract(file: UploadFile = File(...)):
    """AI funkcija za čitanje i izvlačenje podataka iz PDF ugovora (OpenAI)"""
    try:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Datoteka mora biti PDF format")

        openai_key = os.environ.get("OPENAI_API_KEY")
        if not openai_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY nije postavljen u okruženju")

        # Spremi privremenu datoteku
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name

        try:
            # Ekstrakcija teksta iz PDF-a lokalno
            reader = PdfReader(tmp_path)
            pages_text = []
            max_pages = min(len(reader.pages), 20)
            for i in range(max_pages):
                try:
                    page = reader.pages[i]
                    pages_text.append(page.extract_text() or "")
                except Exception:
                    pages_text.append("")
            pdf_text = "\n\n".join(pages_text)

            if len(pdf_text) > 20000:
                pdf_text = pdf_text[:20000]

            client = OpenAI(api_key=openai_key)

            system_prompt = (
                "Ti si digitalni asistent za upravljanje nekretninama. "
                "Tvoj zadatak je analizirati učitani PDF (ugovor, račun ili drugi dokument) i vratiti strukturirane podatke. "
                "Vrati STROGO validan JSON prema shemi. Bez dodatnog teksta."
            )

            instructions = (
                "Molim te analiziraj sljedeći tekst dokumenta i vrati JSON u ovom formatu:"\
                "\n\n{\n  \"document_type\": \"ugovor/racun/ostalo\",\n  \"ugovor\": {\n    \"interna_oznaka\": \"string ili null\",\n    \"datum_potpisivanja\": \"YYYY-MM-DD ili null\",\n    \"datum_pocetka\": \"YYYY-MM-DD ili null\",\n    \"datum_zavrsetka\": \"YYYY-MM-DD ili null\",\n    \"trajanje_mjeseci\": \"broj ili null\",\n    \"opcija_produljenja\": \"boolean ili null\",\n    \"uvjeti_produljenja\": \"string ili null\",\n    \"rok_otkaza_dani\": \"broj ili null\"\n  },\n  \"nekretnina\": {\n    \"naziv\": \"string ili null\",\n    \"adresa\": \"string ili null\",\n    \"katastarska_opcina\": \"string ili null\",\n    \"broj_kat_cestice\": \"string ili null\",\n    \"povrsina\": \"broj ili null\",\n    \"vrsta\": \"poslovna_zgrada/stan/zemljiste/ostalo ili null\",\n    \"namjena_prostora\": \"string ili null\"\n  },\n  \"zakupnik\": {\n    \"naziv_firme\": \"string ili null\",\n    \"ime_prezime\": \"string ili null\",\n    \"oib\": \"string ili null\",\n    \"sjediste\": \"string ili null\",\n    \"kontakt_ime\": \"string ili null\",\n    \"kontakt_email\": \"string ili null\",\n    \"kontakt_telefon\": \"string ili null\"\n  },\n  \"financije\": {\n    \"osnovna_zakupnina\": \"broj ili null\",\n    \"zakupnina_po_m2\": \"broj ili null\",\n    \"cam_troskovi\": \"broj ili null\",\n    \"polog_depozit\": \"broj ili null\",\n    \"garancija\": \"broj ili null\",\n    \"indeksacija\": \"boolean ili null\",\n    \"indeks\": \"string ili null\",\n    \"formula_indeksacije\": \"string ili null\"\n  },\n  \"ostalo\": {\n    \"obveze_odrzavanja\": \"zakupodavac/zakupnik/podijeljeno ili null\",\n    \"rezije_brojila\": \"string ili null\"\n  },\n  \"racun\": {\n    \"dobavljac\": \"string ili null\",\n    \"broj_racuna\": \"string ili null\",\n    \"tip_rezije\": \"struja/voda/plin/komunalije/internet/ostalo ili null\",\n    \"razdoblje_od\": \"YYYY-MM-DD ili null\",\n    \"razdoblje_do\": \"YYYY-MM-DD ili null\",\n    \"datum_izdavanja\": \"YYYY-MM-DD ili null\",\n    \"datum_dospijeca\": \"YYYY-MM-DD ili null\",\n    \"iznos_za_platiti\": \"broj ili null\",\n    \"iznos_placen\": \"broj ili null\",\n    \"valuta\": \"string ili null\"\n  }\n}\n\n"
                "VAŽNO: Ako ne možeš pronaći informaciju, stavi null. Datume u YYYY-MM-DD. Brojevi bez valute. Boolean true/false. Enum vrijednosti točno kako su zadane. Odgovori SAMO JSON objektom."
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{instructions}\n\nTekst ugovora (sažeto):\n\n{pdf_text}"},
            ]

            response = await asyncio.to_thread(
                client.chat.completions.create,
                model="gpt-4o-mini",
                messages=messages,
                temperature=0,
            )

            ai_text = response.choices[0].message.content if response.choices else ""

            try:
                parsed_data = json.loads(ai_text)
                return {"success": True, "data": parsed_data, "message": "PDF je uspješno analiziran i podaci su izvučeni"}
            except json.JSONDecodeError:
                start = ai_text.find('{')
                end = ai_text.rfind('}') + 1
                if start != -1 and end > start:
                    json_part = ai_text[start:end]
                    try:
                        parsed_data = json.loads(json_part)
                        return {"success": True, "data": parsed_data, "message": "PDF je uspješno analiziran i podaci su izvučeni"}
                    except json.JSONDecodeError:
                        pass
                return {"success": False, "data": None, "message": f"AI je analizirao dokument, ali odgovor nije čist JSON: {ai_text[:500]}..."}

        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    except Exception as e:
        logger.error(f"Greška pri AI analizi PDF-a (OpenAI): {str(e)}")
        return {"success": False, "data": None, "message": f"Greška pri analizi PDF-a: {str(e)}"}

# Helper funkcija za kreiranje podsjećanja
async def create_podsjetnici_za_ugovor(ugovor: Ugovor):
    """Kreira automatske podsjetnike za ugovor"""
    datum_zavrsetka = datetime.fromisoformat(ugovor.datum_zavrsetka) if isinstance(ugovor.datum_zavrsetka, str) else ugovor.datum_zavrsetka
    
    dani_prije_lista = [180, 120, 90, 60, 30]
    
    for dani_prije in dani_prije_lista:
        datum_podsjetnika = datum_zavrsetka - timedelta(days=dani_prije)
        
        podsjetnik = Podsjetnik(
            tip="istek_ugovora",
            ugovor_id=ugovor.id,
            datum_podsjetnika=datum_podsjetnika,
            dani_prije=dani_prije
        )
        
        await db.podsjetnici.insert_one(prepare_for_mongo(podsjetnik.dict()))

# Include the router in the main app
app.include_router(api_router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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
    if client:
        client.close()
