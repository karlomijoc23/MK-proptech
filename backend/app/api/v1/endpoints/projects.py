import shutil
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.api import deps
from app.core.config import get_settings
from app.db.instance import db
from app.db.utils import parse_from_mongo, prepare_for_mongo
from app.models.domain import (
    Project,
    ProjectDocument,
    ProjectPhase,
    ProjectStakeholder,
    ProjectStatus,
    ProjectTransaction,
    TransactionCategory,
    TransactionType,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    budget: Optional[float] = None
    start_date: Optional[str] = None  # ISO date string
    end_date: Optional[str] = None  # ISO date string
    budget_breakdown: Optional[Dict[str, float]] = None
    projected_revenue: Optional[float] = None
    linked_property_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    budget: Optional[float] = None
    spent: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget_breakdown: Optional[Dict[str, float]] = None
    projected_revenue: Optional[float] = None
    linked_property_id: Optional[str] = None


class PhaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "pending"
    order: int = 0


class DocumentCreate(BaseModel):
    name: str
    type: str
    phase_id: Optional[str] = None
    notes: Optional[str] = None


class TransactionCreate(BaseModel):
    date: str
    type: TransactionType = TransactionType.EXPENSE
    category: TransactionCategory = TransactionCategory.OTHER
    amount: float
    description: Optional[str] = None
    paid_to: Optional[str] = None


class StakeholderCreate(BaseModel):
    name: str
    role: str
    contact_info: Optional[str] = None
    notes: Optional[str] = None


@router.get(
    "/",
    dependencies=[Depends(deps.require_scopes("projects:read"))],
    response_model=List[Project],
)
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    cursor = db.projects.find().sort("created_at", -1)
    items = await cursor.to_list(limit)
    return [parse_from_mongo(item) for item in items]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_scopes("projects:create"))],
    response_model=Project,
)
async def create_project(
    item_in: ProjectCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    # Create domain model to populate defaults (id, created_at, status, etc.)
    project = Project(**item_in.model_dump())

    item_data = project.model_dump()
    item_data["created_by"] = current_user["id"]
    # phases and documents are empty by default in model, but safe to set explicitly if needed

    # Prepare for storage (handles date parsing if utils support it, or we rely on pydantic)
    item_data = prepare_for_mongo(item_data)

    await db.projects.insert_one(item_data)
    new_item = await db.projects.find_one({"id": project.id})
    return parse_from_mongo(new_item)


@router.get(
    "/{id}",
    dependencies=[Depends(deps.require_scopes("projects:read"))],
    response_model=Project,
)
async def get_project(
    id: str,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    item = await db.projects.find_one({"id": id})
    if not item:
        raise HTTPException(status_code=404, detail="Projekt nije pronađen")
    return parse_from_mongo(item)


@router.put(
    "/{id}",
    dependencies=[Depends(deps.require_scopes("projects:update"))],
    response_model=Project,
)
async def update_project(
    id: str,
    item_in: ProjectUpdate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.projects.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Projekt nije pronađen")

    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        return parse_from_mongo(existing)

    update_data = prepare_for_mongo(update_data)
    await db.projects.update_one({"id": id}, {"$set": update_data})

    updated = await db.projects.find_one({"id": id})
    return parse_from_mongo(updated)


@router.post(
    "/{id}/phases",
    dependencies=[Depends(deps.require_scopes("projects:update"))],
    response_model=Project,
)
async def add_project_phase(
    id: str,
    phase_in: PhaseCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.projects.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Projekt nije pronađen")

    # Auto-assign order if 0
    if phase_in.order == 0:
        existing_phases = existing.get("phases", [])
        phase_in.order = len(existing_phases) + 1

    phase = ProjectPhase(**phase_in.model_dump())
    print(f"DEBUG: Adding phase {phase.dict()}")  # Debug

    phase_data = prepare_for_mongo(phase.model_dump())
    print(f"DEBUG: Mongo data {phase_data}")  # Debug

    await db.projects.update_one({"id": id}, {"$push": {"phases": phase_data}})

    updated = await db.projects.find_one({"id": id})
    return parse_from_mongo(updated)


@router.post(
    "/{id}/documents",
    dependencies=[Depends(deps.require_scopes("projects:update"))],
    response_model=Project,
)
async def add_project_document(
    id: str,
    name: str = Form(...),
    type: str = Form(...),
    phase_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    status: str = Form("pending"),
    file: Optional[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.projects.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Projekt nije pronađen")

    file_url = None
    if file:
        settings = get_settings()
        # Create user-specific or project-specific directory
        upload_path = settings.UPLOAD_DIR / "projects" / id
        upload_path.mkdir(parents=True, exist_ok=True)

        # Initial name - we could make it unique
        safe_name = file.filename.replace(" ", "_")
        file_dest = upload_path / safe_name

        with file_dest.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_url = f"uploads/projects/{id}/{safe_name}"

    doc = ProjectDocument(
        name=name,
        type=type,
        phase_id=phase_id,
        notes=notes,
        status=status,
        file_url=file_url,
    )
    doc_data = prepare_for_mongo(doc.model_dump())

    await db.projects.update_one({"id": id}, {"$push": {"documents": doc_data}})

    updated = await db.projects.find_one({"id": id})
    return parse_from_mongo(updated)


@router.post(
    "/{id}/transactions",
    dependencies=[Depends(deps.require_scopes("projects:update"))],
    response_model=Project,
)
async def add_project_transaction(
    id: str,
    transaction_in: TransactionCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.projects.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Projekt nije pronađen")

    # We use domain model to create transaction object
    transaction_data = transaction_in.model_dump()
    transaction = ProjectTransaction(**transaction_data)

    # Calculate new spent
    current_spent = float(existing.get("spent", 0.0) or 0.0)
    if transaction.type == TransactionType.EXPENSE:
        current_spent += transaction.amount

    tx_data = prepare_for_mongo(transaction.model_dump())

    await db.projects.update_one(
        {"id": id},
        {
            "$push": {"transactions": tx_data},
            "$set": {"spent": current_spent, "updated_at": datetime.utcnow()},
        },
    )

    updated = await db.projects.find_one({"id": id})
    return parse_from_mongo(updated)


# ==========================================
# Stakeholder Helper Endpoints
# ==========================================
@router.post(
    "/{id}/stakeholders",
    dependencies=[Depends(deps.require_scopes("projects:update"))],
    response_model=Project,
)
async def add_project_stakeholder(
    id: str,
    stakeholder_in: StakeholderCreate,
    current_user: Dict[str, Any] = Depends(deps.get_current_user),
):
    existing = await db.projects.find_one({"id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Projekt nije pronađen")

    stakeholder = ProjectStakeholder(**stakeholder_in.model_dump())
    sh_data = prepare_for_mongo(stakeholder.model_dump())

    await db.projects.update_one(
        {"id": id},
        {"$push": {"stakeholders": sh_data}, "$set": {"updated_at": datetime.utcnow()}},
    )

    updated = await db.projects.find_one({"id": id})
    return parse_from_mongo(updated)
