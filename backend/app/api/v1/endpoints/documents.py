import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from app.api import deps
from app.core.config import get_settings
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import TipDokumenta
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

settings = get_settings()
router = APIRouter()


class DocumentCreate(BaseModel):
    naziv: str
    tip: TipDokumenta = TipDokumenta.OSTALO
    opis: Optional[str] = None
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    maintenance_task_id: Optional[str] = None


@router.get("/", dependencies=[Depends(deps.require_scopes("documents:read"))])
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.dokumenti.find().sort("created_at", -1)
    items = await cursor.to_list(limit)

    parsed_items = [parse_from_mongo(item) for item in items]
    for item in parsed_items:
        if "putanja_datoteke" not in item and item.get("file_path"):
            fp = item["file_path"]
            if "uploads/" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads/") :]
            elif "uploads\\" in fp:  # Windows support just in case
                item["putanja_datoteke"] = fp[fp.rfind("uploads\\") :].replace(
                    "\\", "/"
                )
    return parsed_items


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("documents:create"))],
)
async def create_document(
    naziv: str = Form(...),
    tip: str = Form("ostalo"),
    opis: Optional[str] = Form(None),
    nekretnina_id: Optional[str] = Form(None),
    zakupnik_id: Optional[str] = Form(None),
    ugovor_id: Optional[str] = Form(None),
    maintenance_task_id: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),
    file: UploadFile = File(None),
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Validate tip
    try:
        tip_enum = TipDokumenta(tip)
    except ValueError:
        tip_enum = TipDokumenta.OSTALO

    # Parse metadata
    parsed_metadata = {}
    if metadata:
        import json

        try:
            parsed_metadata = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Metadata must be valid JSON")

    doc_id = str(uuid.uuid4())
    file_path = None

    if file:
        filename = f"{doc_id}_{file.filename}"
        settings.UPLOAD_DIR.mkdir(exist_ok=True)
        dest_path = settings.UPLOAD_DIR / filename

        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_path = str(dest_path)

    doc_data = {
        "id": doc_id,
        "naziv": naziv,
        "tip": tip_enum.value,
        "opis": opis,
        "nekretnina_id": nekretnina_id,
        "zakupnik_id": zakupnik_id,
        "ugovor_id": ugovor_id,
        "maintenance_task_id": maintenance_task_id,
        "metadata": parsed_metadata,
        "file_path": file_path,
        "original_filename": file.filename if file else None,
        "content_type": file.content_type if file else None,
        "created_by": current_user["id"],
        "putanja_datoteke": f"uploads/{filename}" if file_path else None,
    }

    doc_data = prepare_for_mongo(doc_data)

    await db.dokumenti.insert_one(doc_data)

    new_doc = await db.dokumenti.find_one({"id": doc_id})
    return parse_from_mongo(new_doc)


@router.get(
    "/nekretnina/{id}", dependencies=[Depends(deps.require_scopes("documents:read"))]
)
async def get_documents_by_property(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.dokumenti.find({"nekretnina_id": id}).sort("created_at", -1)
    items = await cursor.to_list(None)
    parsed_items = [parse_from_mongo(item) for item in items]
    for item in parsed_items:
        if "putanja_datoteke" not in item and item.get("file_path"):
            fp = item["file_path"]
            if "uploads/" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads/") :]
            elif "uploads\\" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads\\") :].replace(
                    "\\", "/"
                )
    return parsed_items


@router.get(
    "/zakupnik/{id}", dependencies=[Depends(deps.require_scopes("documents:read"))]
)
async def get_documents_by_tenant(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.dokumenti.find({"zakupnik_id": id}).sort("created_at", -1)
    items = await cursor.to_list(None)
    parsed_items = [parse_from_mongo(item) for item in items]
    for item in parsed_items:
        if "putanja_datoteke" not in item and item.get("file_path"):
            fp = item["file_path"]
            if "uploads/" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads/") :]
            elif "uploads\\" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads\\") :].replace(
                    "\\", "/"
                )
    return parsed_items


@router.get(
    "/ugovor/{id}", dependencies=[Depends(deps.require_scopes("documents:read"))]
)
async def get_documents_by_contract(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.dokumenti.find({"ugovor_id": id}).sort("created_at", -1)
    items = await cursor.to_list(None)
    parsed_items = [parse_from_mongo(item) for item in items]
    for item in parsed_items:
        if "putanja_datoteke" not in item and item.get("file_path"):
            fp = item["file_path"]
            if "uploads/" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads/") :]
            elif "uploads\\" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads\\") :].replace(
                    "\\", "/"
                )
    return parsed_items


@router.get(
    "/property-unit/{id}", dependencies=[Depends(deps.require_scopes("documents:read"))]
)
async def get_documents_by_unit(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.dokumenti.find({"property_unit_id": id}).sort("created_at", -1)
    items = await cursor.to_list(None)
    parsed_items = [parse_from_mongo(item) for item in items]
    for item in parsed_items:
        if "putanja_datoteke" not in item and item.get("file_path"):
            fp = item["file_path"]
            if "uploads/" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads/") :]
            elif "uploads\\" in fp:
                item["putanja_datoteke"] = fp[fp.rfind("uploads\\") :].replace(
                    "\\", "/"
                )
    return parsed_items


@router.get("/{id}", dependencies=[Depends(deps.require_scopes("documents:read"))])
async def get_document(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.dokumenti.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen")
    parsed = parse_from_mongo(item)
    if "putanja_datoteke" not in parsed and parsed.get("file_path"):
        fp = parsed["file_path"]
        if "uploads/" in fp:
            parsed["putanja_datoteke"] = fp[fp.rfind("uploads/") :]
        elif "uploads\\" in fp:
            parsed["putanja_datoteke"] = fp[fp.rfind("uploads\\") :].replace("\\", "/")
    return parsed


@router.get(
    "/{id}/download", dependencies=[Depends(deps.require_scopes("documents:read"))]
)
async def download_document(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    try:
        item = await db.dokumenti.find_one({"id": id})
        if not item:
            print(f"DEBUG: Document {id} not found in DB")
            raise HTTPException(status_code=404, detail="Dokument nije pronađen")

        file_path = item.get("file_path")
        print(f"DEBUG: Document {id} file_path: {file_path}")

        if not file_path or not Path(file_path).exists():
            print(f"DEBUG: File path does not exist: {file_path}")
            raise HTTPException(status_code=404, detail="Datoteka nije pronađena")

        return FileResponse(
            path=file_path,
            filename=item.get("original_filename", "document"),
            media_type=item.get("content_type", "application/octet-stream"),
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR: Download failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


class DocumentUpdate(BaseModel):
    naziv: Optional[str] = None
    tip: Optional[TipDokumenta] = None
    opis: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@router.put("/{id}", dependencies=[Depends(deps.require_scopes("documents:create"))])
async def update_document(
    id: str,
    update_data: DocumentUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.dokumenti.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen")

    update_dict = update_data.model_dump(exclude_unset=True)
    if "tip" in update_dict:
        update_dict["tip"] = update_dict["tip"].value

    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        await db.dokumenti.update_one({"id": id}, {"$set": update_dict})

    updated_item = await db.dokumenti.find_one({"id": id})
    return parse_from_mongo(updated_item)


@router.delete("/{id}", dependencies=[Depends(deps.require_scopes("documents:delete"))])
async def delete_document(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.dokumenti.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Dokument nije pronađen")

    # Delete file
    file_path = item.get("file_path")
    if file_path:
        path = Path(file_path)
        if path.exists():
            try:
                path.unlink()
            except Exception:
                pass  # Log error

    await db.dokumenti.delete_one({"id": id})
    return {"poruka": "Dokument uspješno obrisan"}
