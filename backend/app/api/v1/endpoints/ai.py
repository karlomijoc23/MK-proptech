from typing import Any, Dict, Optional

from app.api import deps
from app.core.config import get_settings
from app.db.instance import db
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from openai import OpenAI
from pydantic import BaseModel

router = APIRouter()
settings = get_settings()


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

    # Check if API key is valid (not empty and not "test" unless we want to mock)
    # The test mocks OpenAI class, so we should try to use it if key is present.
    # But the test also tests fallback when key is empty.

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
        # If OpenAI fails, or if key is invalid/test, we might fall back or error.
        # The test expects success with source="openai" if key is present (mocked).
        # If we are in test env with "test" key, real OpenAI would fail.
        # But the test mocks the class.
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-pdf-contract")
async def parse_pdf_contract(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    import base64
    import io
    import json

    from PIL import Image
    from pypdf import PdfReader

    # 1. Extract text from PDF
    text = ""
    images = []

    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        reader = PdfReader(pdf_file)

        # Limit to first few pages to avoid token limits
        for page in reader.pages[:5]:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

            # Collect images if text is sparse
            if len(text) < 100:
                for img in page.images:
                    images.append(img)

    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Neuspješno čitanje PDF-a: {str(e)}"
        )

    # 2. Determine mode (Text vs Vision)
    use_vision = False
    if len(text.strip()) < 50 and images:
        use_vision = True
    elif len(text.strip()) < 50 and not images:
        raise HTTPException(
            status_code=400, detail="Nije pronađen tekst niti slike u PDF-u."
        )

    # 3. Call OpenAI
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        # Fallback mock
        return {
            "success": True,
            "data": {
                "broj_ugovora": "MOCK-NO-KEY",
                "zakupnik": "Nema API ključa",
                "oib": "",
                "adresa": "",
                "datum_sklapanja": None,
                "datum_pocetka": None,
                "datum_zavrsetka": None,
                "iznos_zakupnine": 0,
                "valuta": "EUR",
                "period_placanja": "mjesečno",
                "depozit": 0,
                "otkazni_rok_dani": 0,
            },
        }

    try:
        client = OpenAI(api_key=api_key)

        if use_vision:
            # Prepare image for Vision API
            # Take the first image found (usually the scan of the page)
            img_obj = images[0]
            # img_obj.data contains bytes
            # We might need to convert/resize if too large, but let's try direct base64 first
            # PIL is useful to ensure it's a valid image format (PNG/JPEG)

            image_data = img_obj.data
            try:
                pil_img = Image.open(io.BytesIO(image_data))
                # Convert to RGB if needed (e.g. if CMYK)
                if pil_img.mode not in ("RGB", "L"):
                    pil_img = pil_img.convert("RGB")

                # Resize if too big (max 2000x2000 is a good rule of thumb for tokens)
                pil_img.thumbnail((2000, 2000))

                # Save to buffer as JPEG
                buff = io.BytesIO()
                pil_img.save(buff, format="JPEG")
                base64_image = base64.b64encode(buff.getvalue()).decode("utf-8")
                media_type = "image/jpeg"
            except Exception as img_err:
                print(f"Image processing error: {img_err}")
                # Fallback to raw data if PIL fails, assuming it's already a valid format
                base64_image = base64.b64encode(image_data).decode("utf-8")
                media_type = "image/jpeg"  # Assumption

            prompt_messages = [
                {
                    "role": "system",
                    "content": "Ti si asistent za analizu pravnih dokumenata. Vraćaš isključivo JSON.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """
                                Analiziraj ovu sliku ugovora o zakupu i izvuci ključne podatke u JSON formatu.
                                Traženi format JSON-a:
                                {
                                    "broj_ugovora": "string ili null",
                                    "zakupnik": "string (naziv tvrtke ili ime) ili null",
                                    "oib": "string (11 znamenki) ili null",
                                    "adresa": "string (adresa zakupnika) ili null",
                                    "adresa_nekretnine": "string (adresa predmeta zakupa) ili null",
                                    "naziv_nekretnine_iz_ugovora": "string (naziv zgrade/centra ako postoji) ili null",
                                    "podprostor": "string (oznaka ili naziv jedinice, npr. Ured 101) ili null",
                                    "datum_sklapanja": "YYYY-MM-DD ili null",
                                    "datum_pocetka": "YYYY-MM-DD ili null",
                                    "datum_zavrsetka": "YYYY-MM-DD ili null",
                                    "iznos_zakupnine": number (samo iznos) ili null,
                                    "valuta": "string (EUR, USD...) ili null",
                                    "period_placanja": "string (mjesečno, kvartalno...) ili null",
                                    "depozit": number ili null,
                                    "otkazni_rok_dani": number (broj dana) ili null
                                }
                                Vrati SAMO JSON objekt.
                            """,
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
            model = "gpt-4o"  # Vision capable model

        else:
            # Text mode
            prompt = f"""
            Analiziraj sljedeći tekst ugovora o zakupu i izvuci ključne podatke u JSON formatu.
            Tekst ugovora:
            {text[:4000]}

            Traženi format JSON-a:
            {{
                "broj_ugovora": "string ili null",
                "zakupnik": "string (naziv tvrtke ili ime) ili null",
                "oib": "string (11 znamenki) ili null",
                "adresa": "string (adresa zakupnika) ili null",
                "adresa_nekretnine": "string (adresa predmeta zakupa) ili null",
                "naziv_nekretnine_iz_ugovora": "string (naziv zgrade/centra ako postoji) ili null",
                "podprostor": "string (oznaka ili naziv jedinice, npr. Ured 101) ili null",
                "datum_sklapanja": "YYYY-MM-DD ili null",
                "datum_pocetka": "YYYY-MM-DD ili null",
                "datum_zavrsetka": "YYYY-MM-DD ili null",
                "iznos_zakupnine": number (samo iznos) ili null,
                "valuta": "string (EUR, USD...) ili null",
                "period_placanja": "string (mjesečno, kvartalno...) ili null",
                "depozit": number ili null,
                "otkazni_rok_dani": number (broj dana) ili null
            }}
            Vrati SAMO JSON objekt, bez dodatnog teksta.
            """
            prompt_messages = [
                {
                    "role": "system",
                    "content": "Ti si asistent za analizu pravnih dokumenata. Vraćaš isključivo JSON.",
                },
                {"role": "user", "content": prompt},
            ]
            model = "gpt-3.5-turbo"

        response = client.chat.completions.create(
            model=model, messages=prompt_messages, temperature=0, max_tokens=1000
        )

        content = response.choices[0].message.content.strip()
        # Clean up markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]

        data = json.loads(content)

        # Restructure data for frontend
        structured_data = {
            "document_type": "ugovor",  # Default, or inferred
            "nekretnina": {
                "adresa": data.get("adresa_nekretnine"),
                "naziv": data.get("naziv_nekretnine_iz_ugovora"),
            },
            "zakupnik": {
                "naziv_firme": data.get("zakupnik"),
                "oib": data.get("oib"),
                "adresa": data.get("adresa"),
            },
            "ugovor": {
                "interna_oznaka": data.get("broj_ugovora"),
                "datum_sklapanja": data.get("datum_sklapanja"),
                "datum_pocetka": data.get("datum_pocetka"),
                "datum_zavrsetka": data.get("datum_zavrsetka"),
                "iznos": data.get("iznos_zakupnine"),
                "valuta": data.get("valuta"),
            },
            "property_unit": {"naziv": data.get("podprostor")},
            "financije": {
                "iznos": data.get("iznos_zakupnine"),
                "valuta": data.get("valuta"),
                "period": data.get("period_placanja"),
            },
        }

        # 1. Try to find Property
        extracted_address = data.get("adresa_nekretnine")
        extracted_prop_name = data.get("naziv_nekretnine_iz_ugovora")
        found_property = None

        if extracted_address or extracted_prop_name:
            import re

            queries = []
            if extracted_address:
                safe_addr = re.escape(extracted_address.split(",")[0].strip())
                if len(safe_addr) > 3:
                    queries.append({"adresa": {"$regex": safe_addr, "$options": "i"}})

            if extracted_prop_name:
                safe_name = re.escape(extracted_prop_name)
                if len(safe_name) > 3:
                    queries.append({"naziv": {"$regex": safe_name, "$options": "i"}})

            if queries:
                found_property = await db.nekretnine.find_one({"$or": queries})
                if found_property:
                    # Enrich structured data with found ID (optional, frontend might do its own lookup)
                    structured_data["nekretnina"]["id"] = found_property.get("id")
                    structured_data["nekretnina"]["found_naziv"] = found_property.get(
                        "naziv"
                    )

        # 2. Try to find Unit (Podprostor)
        extracted_unit = data.get("podprostor")
        if found_property and extracted_unit:
            safe_unit = re.escape(extracted_unit)
            unit = await db.property_units.find_one(
                {
                    "nekretnina_id": found_property.get("id"),
                    "naziv": {"$regex": safe_unit, "$options": "i"},
                }
            )
            if unit:
                structured_data["matched_property_unit"] = {
                    "id": unit.get("id"),
                    "naziv": unit.get("naziv"),
                    "oznaka": unit.get("oznaka"),
                    "nekretnina_id": unit.get("nekretnina_id"),
                }

        # 3. Try to find Tenant
        extracted_tenant = data.get("zakupnik")
        extracted_oib = data.get("oib")
        if extracted_oib or extracted_tenant:
            tenant_queries = []
            if extracted_oib:
                tenant_queries.append({"oib": extracted_oib})
            if extracted_tenant:
                safe_tenant = re.escape(extracted_tenant)
                tenant_queries.append(
                    {"naziv": {"$regex": safe_tenant, "$options": "i"}}
                )
                tenant_queries.append({"ime": {"$regex": safe_tenant, "$options": "i"}})

            found_tenant = await db.zakupnici.find_one({"$or": tenant_queries})
            if found_tenant:
                structured_data["zakupnik"]["id"] = found_tenant.get("id")

        return {"success": True, "data": structured_data}

    except Exception as e:
        print(f"OpenAI error: {e}")
        raise HTTPException(status_code=500, detail=f"Greška pri AI analizi: {str(e)}")
