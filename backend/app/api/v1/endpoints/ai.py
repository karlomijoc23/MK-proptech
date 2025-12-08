import base64
import io
import json
import logging
import re
from typing import Any, Dict, Optional

from app.api import deps
from app.core.config import get_settings
from app.db.instance import db
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from pypdf import PdfReader

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


class AnnexRequest(BaseModel):
    ugovor_id: str
    nova_zakupnina: Optional[float] = None
    novi_datum_zavrsetka: Optional[str] = None
    dodatne_promjene: Optional[str] = None


@router.post("/generate-contract-annex")
async def generate_contract_annex(request: AnnexRequest):
    # Verify contract exists
    contract = await db.ugovori.find_one({"id": request.ugovor_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    api_key = settings.OPENAI_API_KEY

    if not api_key:
        return {
            "success": True,
            "title": "Aneks ugovora",
            "content": "ANEKS UGOVORA\n\n1. Predmet izmjene ...\n2. Nova zakupnina ...\n3. Ostale odredbe ostaju na snazi.",
            "metadata": {
                "source": "fallback",
                "nova_zakupnina": request.nova_zakupnina,
                "novi_datum_zavrsetka": request.novi_datum_zavrsetka,
            },
        }

    try:
        client = OpenAI(api_key=api_key)

        prompt = (
            f"Sastavi aneks ugovora za ugovor {request.ugovor_id}. "
            f"Nova zakupnina: {request.nova_zakupnina}. "
            f"Novi datum završetka: {request.novi_datum_zavrsetka}. "
            f"Dodatne promjene: {request.dodatne_promjene}."
        )

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Ti si pravni asistent."},
                {"role": "user", "content": prompt},
            ],
        )

        content = response.choices[0].message.content

        return {
            "success": True,
            "title": "Aneks ugovora",
            "content": content,
            "metadata": {
                "source": "openai",
                "nova_zakupnina": request.nova_zakupnina,
                "novi_datum_zavrsetka": request.novi_datum_zavrsetka,
            },
        }
    except Exception as e:
        logger.error(f"Error generating annex: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-pdf-contract")
async def parse_pdf_contract(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    logger.info(f"Starting PDF analysis for file: {file.filename}")

    # 1. Read file content
    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        reader = PdfReader(pdf_file)
    except Exception as e:
        logger.error(f"Failed to read PDF: {e}")
        raise HTTPException(
            status_code=400, detail=f"Neuspješno čitanje PDF-a: {str(e)}"
        )

    # 2. Extract text and images
    text = ""
    images = []

    try:
        # Limit to first 5 pages
        for i, page in enumerate(reader.pages[:5]):
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

            # If text is sparse, look for images (scans)
            if len(text) < 200:
                try:
                    for img in page.images:
                        images.append(img)
                except Exception as img_err:
                    logger.warning(f"Failed to extract images from page {i}: {img_err}")

    except Exception as e:
        logger.error(f"Error extracting content from PDF: {e}")
        # Continue if we have at least some content, otherwise raise
        if not text and not images:
            raise HTTPException(
                status_code=400, detail=f"Greška pri analizi sadržaja PDF-a: {str(e)}"
            )

    # 3. Determine mode
    use_vision = False
    if len(text.strip()) < 50 and images:
        use_vision = True
        logger.info("Using Vision mode (scanned document detected)")
    elif len(text.strip()) < 50 and not images:
        raise HTTPException(
            status_code=400, detail="Nije pronađen tekst niti slike u PDF-u."
        )
    else:
        logger.info("Using Text mode")

    # 4. Prepare OpenAI Client
    api_key = settings.OPENAI_API_KEY

    # MOCK RESPONSE if no key
    if not api_key:
        logger.warning("No OpenAI API key found. Returning mock response.")
        return {
            "success": True,
            "data": {
                "ugovor": {
                    "interna_oznaka": "MOCK-UGOVOR-001",
                    "datum_sklapanja": "2024-01-01",
                    "datum_pocetka": "2024-02-01",
                    "datum_zavrsetka": "2025-02-01",
                    "sazetak": "Ovo je mock sažetak jer nema API ključa.",
                },
                "financije": {"iznos": 1000.00, "valuta": "EUR"},
                "zakupnik": {
                    "naziv_firme": "Mock Tvrtka d.o.o.",
                    "oib": "12345678901",
                    "adresa": "Ilica 1, Zagreb",
                },
                "nekretnina": {"naziv": "Poslovni Centar", "adresa": "Vukovarska 10"},
            },
        }

    try:
        client = OpenAI(api_key=api_key)
        model = "gpt-3.5-turbo"
        messages = []

        system_prompt = "Ti si asistent za analizu pravnih dokumenata (ugovora o zakupu). Vraćaš isključivo JSON."

        json_structure = """
        {
            "ugovor": {
                "interna_oznaka": "string ili null (broj ugovora)",
                "datum_sklapanja": "YYYY-MM-DD ili null (pretvori iz teksta npr. '1. siječnja 2024.' -> '2024-01-01')",
                "datum_pocetka": "YYYY-MM-DD ili null (pretvori iz teksta)",
                "datum_zavrsetka": "YYYY-MM-DD ili null (pretvori iz teksta, ako je na 1 godinu dodaj 1 godinu na početak)",
                "sazetak": "string (kratki opis bitnih stavki)"
            },
            "financije": {
                "iznos": number (samo iznos zakupnine) ili null,
                "valuta": "string (EUR, USD...)"
            },
            "zakupnik": {
                "naziv_firme": "string ili null",
                "oib": "string ili null",
                "adresa": "string ili null"
            },
            "nekretnina": {
                "naziv": "string ili null",
                "adresa": "string ili null"
            },
            "property_unit": {
                "naziv": "string ili null (oznaka podprostora)"
            }
        }
        """

        if use_vision:
            model = "gpt-4o"
            # Process first image
            img_obj = images[0]
            image_data = img_obj.data

            # Convert to base64
            # Try to ensure it's a valid format using PIL
            try:
                pil_img = Image.open(io.BytesIO(image_data))
                if pil_img.mode not in ("RGB", "L"):
                    pil_img = pil_img.convert("RGB")

                # Resize to avoid token limits
                pil_img.thumbnail((2000, 2000))

                buff = io.BytesIO()
                pil_img.save(buff, format="JPEG")
                base64_image = base64.b64encode(buff.getvalue()).decode("utf-8")
                media_type = "image/jpeg"
            except Exception as e:
                logger.warning(f"Image conversion failed, trying raw bytes: {e}")
                base64_image = base64.b64encode(image_data).decode("utf-8")
                media_type = "image/jpeg"

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Analiziraj ovu sliku ugovora i izvuci podatke u JSON formatu:\n{json_structure}",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{base64_image}"
                            },
                        },
                    ],
                },
            ]
        else:
            # Text mode
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Analiziraj tekst ugovora i izvuci podatke u JSON formatu:\n{json_structure}\n\nTekst ugovora:\n{text[:4000]}",
                },
            ]

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        # Post-processing / Enrichment
        # Try to match Tenant and Property from DB

        # 1. Match Tenant
        if data.get("zakupnik"):
            zakupnik_data = data["zakupnik"]
            query = []
            if zakupnik_data.get("oib"):
                query.append({"oib": zakupnik_data["oib"]})
            if zakupnik_data.get("naziv_firme"):
                query.append(
                    {
                        "naziv_firme": {
                            "$regex": re.escape(zakupnik_data["naziv_firme"]),
                            "$options": "i",
                        }
                    }
                )

            if query:
                found_tenant = await db.zakupnici.find_one({"$or": query})
                if found_tenant:
                    data["zakupnik"]["id"] = found_tenant["id"]
                    # Update fields if missing in AI response but present in DB? No, prefer AI for now or keep as is.

        # 2. Match Property
        if data.get("nekretnina"):
            prop_data = data["nekretnina"]
            query = []
            if prop_data.get("naziv"):
                query.append(
                    {
                        "naziv": {
                            "$regex": re.escape(prop_data["naziv"]),
                            "$options": "i",
                        }
                    }
                )
            if prop_data.get("adresa"):
                # Simple address match (first part)
                addr_part = prop_data["adresa"].split(",")[0].strip()
                if len(addr_part) > 3:
                    query.append(
                        {"adresa": {"$regex": re.escape(addr_part), "$options": "i"}}
                    )

            if query:
                found_prop = await db.nekretnine.find_one({"$or": query})
                if found_prop:
                    data["nekretnina"]["id"] = found_prop["id"]

                    # 3. Match Unit if Property found
                    if data.get("property_unit") and data["property_unit"].get("naziv"):
                        unit_name = data["property_unit"]["naziv"]
                        found_unit = await db.property_units.find_one(
                            {
                                "nekretnina_id": found_prop["id"],
                                "oznaka": {
                                    "$regex": re.escape(unit_name),
                                    "$options": "i",
                                },
                            }
                        )
                        if found_unit:
                            data["property_unit"]["id"] = found_unit["id"]

        return {"success": True, "data": data}

    except Exception as e:
        logger.error(f"OpenAI analysis failed: {e}")

        # Check for Quota Exceeded or other API errors
        error_msg = str(e).lower()
        if (
            "quota" in error_msg
            or "rate limit" in error_msg
            or "insufficient_quota" in error_msg
        ):
            logger.warning("OpenAI Quota Exceeded. Returning mock data.")
            return {
                "success": True,
                "data": {
                    "ugovor": {
                        "interna_oznaka": "MOCK-QUOTA-001",
                        "datum_sklapanja": "2024-01-01",
                        "datum_pocetka": "2024-02-01",
                        "datum_zavrsetka": "2025-02-01",
                        "sazetak": "Ovo je mock sažetak jer je OpenAI kvota prekoračena.",
                    },
                    "financije": {"iznos": 1500.00, "valuta": "EUR"},
                    "zakupnik": {
                        "naziv_firme": "Mock Tvrtka (Quota Exceeded)",
                        "oib": "12345678901",
                        "adresa": "Ilica 1, Zagreb",
                    },
                    "nekretnina": {
                        "naziv": "Poslovni Centar",
                        "adresa": "Vukovarska 10",
                    },
                },
                "metadata": {
                    "source": "fallback_quota_exceeded",
                    "original_error": str(e),
                },
            }

        raise HTTPException(status_code=500, detail=f"Greška pri AI analizi: {str(e)}")
