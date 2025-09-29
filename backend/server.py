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
from datetime import datetime, timezone, date, timedelta
from enum import Enum
import json
import tempfile
import shutil
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import uuid as uuid_module

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
    OSTALO = "ostalo"

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
async def create_dokument(dokument: DokumentCreate):
    dokument_dict = prepare_for_mongo(dokument.dict())
    dokument_obj = Dokument(**dokument_dict, putanja_datoteke="", velicina_datoteke=0)
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
    
    return {
        "ukupno_nekretnina": ukupno_nekretnina,
        "aktivni_ugovori": aktivni_ugovori,
        "ugovori_na_isteku": ugovori_na_isteku,
        "aktivni_podsjetnici": aktivni_podsjetnici,
        "mjesecni_prihod": mjesecni_prihod
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
    """AI funkcija za čitanje i izvlačenje podataka iz PDF ugovora"""
    try:
        # Provjeri je li PDF datoteka
        if not file.content_type == "application/pdf":
            raise HTTPException(status_code=400, detail="Datoteka mora biti PDF format")
        
        # Spremi privremenu datoteku
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name
        
        try:
            # Inicijaliziraj AI chat s Gemini (jedini model koji podržava datoteke)
            chat = LlmChat(
                api_key=os.environ.get('EMERGENT_LLM_KEY'),
                session_id=f"pdf-parse-{uuid_module.uuid4()}",
                system_message="Ti si ekspert za čitanje i izvlačenje podataka iz ugovora o zakupu nekretnina. Tvoj zadatak je pažljivo analizirati PDF dokument i izvući sve dostupne informacije u strukturiranom JSON formatu."
            ).with_model("gemini", "gemini-2.0-flash")
            
            # Kreiraj file content objekt
            pdf_file = FileContentWithMimeType(
                file_path=tmp_path,
                mime_type="application/pdf"
            )
            
            # Pošalji zahtjev za analizu
            user_message = UserMessage(
                text="""Molim te analiziraj ovaj PDF ugovor o zakupu i izvuci sljedeće informacije u JSON formatu:

{
  "ugovor": {
    "interna_oznaka": "string ili null",
    "datum_potpisivanja": "YYYY-MM-DD ili null",
    "datum_pocetka": "YYYY-MM-DD ili null", 
    "datum_zavrsetka": "YYYY-MM-DD ili null",
    "trajanje_mjeseci": "broj ili null",
    "opcija_produljenja": "boolean ili null",
    "uvjeti_produljenja": "string ili null",
    "rok_otkaza_dani": "broj ili null"
  },
  "nekretnina": {
    "naziv": "string ili null",
    "adresa": "string ili null",
    "katastarska_opcina": "string ili null",
    "broj_kat_cestice": "string ili null",
    "povrsina": "broj ili null",
    "vrsta": "poslovna_zgrada/stan/zemljiste/ostalo ili null",
    "namjena_prostora": "string ili null"
  },
  "zakupnik": {
    "naziv_firme": "string ili null",
    "ime_prezime": "string ili null", 
    "oib": "string ili null",
    "sjediste": "string ili null",
    "kontakt_ime": "string ili null",
    "kontakt_email": "string ili null",
    "kontakt_telefon": "string ili null"
  },
  "financije": {
    "osnovna_zakupnina": "broj ili null",
    "zakupnina_po_m2": "broj ili null",
    "cam_troskovi": "broj ili null", 
    "polog_depozit": "broj ili null",
    "garancija": "broj ili null",
    "indeksacija": "boolean ili null",
    "indeks": "string ili null",
    "formula_indeksacije": "string ili null"
  },
  "ostalo": {
    "obveze_odrzavanja": "zakupodavac/zakupnik/podijeljeno ili null",
    "rezije_brojila": "string ili null"
  }
}

VAŽNO: 
- Ako ne možeš pronaći određenu informaciju, stavi null
- Za datume koristi YYYY-MM-DD format
- Za brojeve koristi decimalne vrijednosti bez valute 
- Za boolean vrijednosti koristi true/false
- Za enum vrijednosti koristi točno navedene opcije
- Odgovori SAMO s JSON objektom, bez dodatnih objašnjenja""",
                file_contents=[pdf_file]
            )
            
            # Dobij odgovor od AI-ja
            response = await chat.send_message(user_message)
            
            # Pokušaj parsirati JSON odgovor
            try:
                parsed_data = json.loads(response)
                return {
                    "success": True,
                    "data": parsed_data,
                    "message": "PDF je uspješno analiziran i podaci su izvučeni"
                }
            except json.JSONDecodeError:
                # Ako JSON parsing ne uspije, pokušaj izvući JSON iz odgovora
                start = response.find('{')
                end = response.rfind('}') + 1
                if start != -1 and end != 0:
                    json_part = response[start:end]
                    try:
                        parsed_data = json.loads(json_part)
                        return {
                            "success": True,
                            "data": parsed_data,
                            "message": "PDF je uspješno analiziran i podaci su izvučeni"
                        }
                    except json.JSONDecodeError:
                        pass
                
                # Ako ni to ne uspije, vrati raw odgovor
                return {
                    "success": False,
                    "data": None,
                    "message": f"AI je analizirao dokument, ali odgovor nije u očekivanom JSON formatu: {response[:500]}..."
                }
        
        finally:
            # Obriši privremenu datoteku
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
                
    except Exception as e:
        logger.error(f"Greška pri AI analizi PDF-a: {str(e)}")
        return {
            "success": False,
            "data": None,
            "message": f"Greška pri analizi PDF-a: {str(e)}"
        }

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