from __future__ import annotations

import asyncio
import calendar
import copy
import inspect
import json
import logging
import os
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from openai import BadRequestError, OpenAI
from openai import __version__ as openai_version
from packaging import version as pkg_version
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError
from PyPDF2 import PdfReader
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def _get_openai_api_key() -> Optional[str]:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    key = key.strip()
    if (key.startswith('"') and key.endswith('"')) or (
        key.startswith("'") and key.endswith("'")
    ):
        key = key[1:-1].strip()
    return key or None


def _get_openai_document_model() -> str:
    model = os.environ.get("OPENAI_DOCUMENT_MODEL", "gpt-4o-mini")
    model = (model or "gpt-4o-mini").strip()
    return model or "gpt-4o-mini"


try:
    _OPENAI_SDK_VERSION = pkg_version.parse(openai_version)
except Exception:
    _OPENAI_SDK_VERSION = None

OPENAI_INPUT_CONTENT_TYPE = (
    "input_text"
    if _OPENAI_SDK_VERSION and _OPENAI_SDK_VERSION >= pkg_version.parse("2.0.0")
    else "text"
)


DEFAULT_ANEKS_TEMPLATE_PATH = ROOT_DIR.parent / "brand" / "aneks-template.html"
ANEKS_TEMPLATE_ENV_PATH = os.environ.get("ANEKS_TEMPLATE_PATH")
ANEKS_TEMPLATE_PATH = (
    Path(ANEKS_TEMPLATE_ENV_PATH)
    if ANEKS_TEMPLATE_ENV_PATH
    else DEFAULT_ANEKS_TEMPLATE_PATH
)

DEFAULT_UGOVOR_TEMPLATE_PATH = ROOT_DIR.parent / "brand" / "ugovor-template.html"
UGOVOR_TEMPLATE_ENV_PATH = os.environ.get("UGOVOR_TEMPLATE_PATH")
UGOVOR_TEMPLATE_PATH = (
    Path(UGOVOR_TEMPLATE_ENV_PATH)
    if UGOVOR_TEMPLATE_ENV_PATH
    else DEFAULT_UGOVOR_TEMPLATE_PATH
)

DEFAULT_ANEKS_TEMPLATE_HTML = """<!DOCTYPE html>\n<html lang=\"hr\">\n<head>\n<meta charset=\"utf-8\"/>\n<style>\n  body { font-family: 'Helvetica', Arial, sans-serif; color: #202124; margin: 40px; line-height: 1.6; }\n  h1 { font-size: 20px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }\n  h2 { font-size: 13px; margin-top: 24px; text-transform: uppercase; }\n  p { margin: 0 0 8px 0; }\n  .meta { font-size: 11px; color: #5f6368; margin-bottom: 24px; }\n  .section { margin-top: 16px; }\n  .signature-block { margin-top: 48px; display: flex; gap: 60px; }\n  .signature { flex: 1; }\n  .signature-line { margin-top: 40px; border-top: 1px solid #202124; padding-top: 8px; font-size: 11px; text-align: center; }\n  footer { margin-top: 60px; font-size: 10px; color: #5f6368; }\n</style>\n</head>\n<body>\n  <h1>{{TITLE}}</h1>\n  <div class=\"meta\">{{META}}</div>\n  <div class=\"section\">\n    {{BODY}}\n  </div>\n  <div class=\"signature-block\">\n    <div class=\"signature\">\n      <div class=\"signature-line\">{{LANDLORD_LABEL}}</div>\n    </div>\n    <div class=\"signature\">\n      <div class=\"signature-line\">{{TENANT_LABEL}}</div>\n    </div>\n  </div>\n  <footer>{{FOOTER}}</footer>\n</body>\n</html>\n"""

DEFAULT_UGOVOR_TEMPLATE_HTML = """<!DOCTYPE html>\n<html lang=\"hr\">\n<head>\n<meta charset=\"utf-8\"/>\n<title>Ugovor o zakupu</title>\n<style>\n  body { font-family: 'Helvetica', Arial, sans-serif; color: #202124; margin: 48px 56px 60px; line-height: 1.6; background: #ffffff; }\n  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1d3557; padding-bottom: 14px; margin-bottom: 32px; }\n  .brand { display: flex; flex-direction: column; gap: 4px; }\n  .brand-title { font-weight: 700; font-size: 20px; letter-spacing: 0.06em; text-transform: uppercase; color: #1d3557; }\n  .brand-subtitle { font-size: 11px; color: #6c757d; letter-spacing: 0.08em; text-transform: uppercase; }\n  .meta { text-align: right; font-size: 11px; color: #6c757d; }\n  h1 { font-size: 26px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 10px; color: #1d3557; }\n  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 28px 0 12px; color: #457b9d; }\n  p { margin: 0 0 10px 0; }\n  ul { margin: 0 0 12px 24px; }\n  .section { margin-top: 20px; }\n  .signature-block { display: flex; justify-content: space-between; gap: 56px; margin-top: 60px; }\n  .signature { flex: 1; text-align: center; font-size: 12px; }\n  .signature::before { content: ''; display: block; height: 56px; border-bottom: 1px solid #dfe6ed; margin-bottom: 10px; }\n  footer { margin-top: 64px; font-size: 10px; color: #6c757d; border-top: 1px solid #dfe6ed; padding-top: 12px; }\n  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; border: 1px solid #457b9d; color: #457b9d; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }\n</style>\n</head>\n<body>\n  <header>\n    <div class=\"brand\">\n      <div class=\"brand-title\">{{BRAND_NAME}}</div>\n      <div class=\"brand-subtitle\">{{BRAND_SUBTITLE}}</div>\n    </div>\n    <div class=\"meta\">\n      <div class=\"badge\">Ugovor o zakupu</div>\n      <div>Referenca: {{CONTRACT_REFERENCE}}</div>\n      <div>Generirano: {{GENERATED_AT}}</div>\n    </div>\n  </header>\n  <main>\n    <h1>{{TITLE}}</h1>\n    <p>{{INTRO}}</p>\n    <section class=\"section\">\n      <h2>Strane</h2>\n      <div>{{PARTIES}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Nekretnina</h2>\n      <div>{{PROPERTY_SUMMARY}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Uvjeti zakupa</h2>\n      <div>{{TERM_SUMMARY}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Financijski uvjeti</h2>\n      <div>{{FINANCIAL_SUMMARY}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Obveze i odgovornosti</h2>\n      <div>{{OBLIGATIONS}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Posebne odredbe</h2>\n      <div>{{SPECIAL_PROVISIONS}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Detaljni ugovor</h2>\n      <div>{{BODY}}</div>\n    </section>\n    <section class=\"section\">\n      <h2>Potvrda i potpisi</h2>\n      <p>{{CONFIRMATION}}</p>\n    </section>\n    <div class=\"signature-block\">\n      <div class=\"signature\">{{LANDLORD_LABEL}}</div>\n      <div class=\"signature\">{{TENANT_LABEL}}</div>\n    </div>\n  </main>\n  <footer>{{FOOTER}}</footer>\n</body>\n</html>\n"""


def _parse_api_tokens() -> Dict[str, Dict[str, Any]]:
    tokens_raw = os.environ.get("API_TOKENS")
    if tokens_raw:
        mapping = {}
        for pair in tokens_raw.split(","):
            if not pair.strip():
                continue
            token_part = pair.strip()
            role = "admin"
            scopes: List[str] = []
            if ":" in token_part:
                token, rest = token_part.split(":", 1)
                if "|" in rest:
                    role_part, scopes_part = rest.split("|", 1)
                    role = role_part.strip() or "admin"
                    scopes = [
                        scope.strip()
                        for scope in scopes_part.split(";")
                        if scope.strip()
                    ]
                else:
                    token = token.strip()
                    role = rest.strip() or "admin"
                mapping[token.strip()] = {"role": role, "scopes": scopes}
            else:
                mapping[token_part] = {"role": "admin", "scopes": []}
        return mapping
    single = os.environ.get("API_TOKEN")
    if single:
        return {single: {"role": os.environ.get("DEFAULT_ROLE", "admin"), "scopes": []}}
    return {}


API_TOKENS = _parse_api_tokens()
DEFAULT_ROLE = os.environ.get("DEFAULT_ROLE", "admin")
AUTH_SECRET = os.environ.get("AUTH_SECRET", "change-me")
AUTH_ALGORITHM = os.environ.get("AUTH_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
OPEN_ENDPOINTS = {
    "/api/auth/login",
    "/api/auth/register",
}
ALLOWED_MAINTENANCE_ASSIGN_ROLES = {"property_manager", "owner_exec"}

ROLE_SCOPE_MAP: Dict[str, List[str]] = {
    "admin": ["*"],
    "system": ["*"],
    "owner_exec": [
        "kpi:read",
        "properties:read",
        "leases:read",
        "tenants:read",
        "financials:read",
        "reports:read",
        "users:assign",
        "users:read",
    ],
    "property_manager": [
        "properties:*",
        "tenants:*",
        "leases:*",
        "maintenance:*",
        "documents:*",
        "vendors:read",
        "financials:read",
        "reports:read",
        "users:assign",
        "users:read",
        "kpi:read",
    ],
    "leasing_agent": [
        "tenants:*",
        "leases:read",
        "leases:create",
        "leases:update",
        "documents:read",
        "documents:create",
        "maintenance:read",
    ],
    "maintenance_coordinator": [
        "maintenance:*",
        "properties:read",
        "tenants:read",
        "documents:read",
        "vendors:read",
        "users:assign",
        "users:read",
    ],
    "accountant": [
        "financials:*",
        "leases:read",
        "tenants:read",
        "properties:read",
        "vendors:*",
        "documents:read",
        "reports:*",
        "kpi:read",
    ],
    "vendor": ["maintenance:assigned", "documents:create", "documents:read"],
    "tenant": ["self:read", "self:maintenance", "self:documents"],
}


def _resolve_role_scopes(
    role: str, explicit_scopes: Optional[List[str]] = None
) -> List[str]:
    base_scopes = ROLE_SCOPE_MAP.get(role, [])
    if explicit_scopes:
        combined = list(dict.fromkeys(base_scopes + explicit_scopes))
    else:
        combined = list(dict.fromkeys(base_scopes))
    if not combined:
        return ["*"] if role == DEFAULT_ROLE else []
    return combined


def _scope_matches(granted: List[str], required: str) -> bool:
    if "*" in granted:
        return True
    if required in granted:
        return True
    if ":" not in required:
        return False
    resource, action = required.split(":", 1)
    wildcard = f"{resource}:*"
    if wildcard in granted:
        return True
    # allow hierarchical permission where write implies read
    if action == "read":
        for perm in granted:
            if perm.startswith(f"{resource}:") and perm != required:
                return True
    return False


def require_scopes(*scopes: str):
    async def _dependency(request: Request):
        principal = getattr(request.state, "current_user", None)
        if not principal:
            raise HTTPException(status_code=401, detail="Neautorizirano")
        granted = principal.get("scopes", [])
        missing = [scope for scope in scopes if not _scope_matches(granted, scope)]
        if missing:
            raise HTTPException(
                status_code=403, detail=f"Nedostaju ovlasti: {', '.join(missing)}"
            )
        return True

    return _dependency


def set_audit_context(
    request: Request,
    *,
    entity_type: str,
    entity_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
) -> None:
    context: Dict[str, Any] = {"entity_type": entity_type}
    if entity_id:
        context["entity_id"] = entity_id
    if parent_id:
        context["parent_id"] = parent_id
    if changes:
        context["changes"] = changes
    request.state.audit_context = context


def diff_dict(
    before: Dict[str, Any],
    after: Dict[str, Any],
    *,
    ignore: Optional[Set[str]] = None,
) -> Dict[str, Dict[str, Any]]:
    ignore = ignore or set()
    changes: Dict[str, Dict[str, Any]] = {}
    keys = set(before.keys()) | set(after.keys())
    for key in keys:
        if key in ignore:
            continue
        before_value = before.get(key)
        after_value = after.get(key)
        if before_value != after_value:
            changes[key] = {"before": before_value, "after": after_value}
    return changes


# In-memory fallback implementations -------------------------------------------------


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password must not be empty")
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return pwd_context.verify(plain_password, password_hash)
    except ValueError:
        return False


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, AUTH_SECRET, algorithm=AUTH_ALGORITHM)


async def _get_user_by_email(email: str) -> Optional[User]:
    if not email:
        return None
    doc = await db.users.find_one({"email": email.lower()})
    if not doc:
        return None
    return User(**parse_from_mongo(doc))


async def _get_user_or_404(user_id: str) -> User:
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    return User(**parse_from_mongo(user_doc))


def _user_to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        scopes=user.scopes,
        active=user.active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _deepcopy(data: Dict[str, Any]) -> Dict[str, Any]:
    return copy.deepcopy(data)


def _value_matches(doc_value, condition_value, options: Dict[str, Any]) -> bool:
    if isinstance(condition_value, dict):
        if "$regex" in condition_value:
            pattern = condition_value["$regex"]
            flags = re.IGNORECASE if "i" in condition_value.get("$options", "") else 0
            return re.search(pattern, str(doc_value or ""), flags) is not None
        if "$lte" in condition_value:
            return doc_value is not None and doc_value <= condition_value["$lte"]
        if "$gte" in condition_value:
            return doc_value is not None and doc_value >= condition_value["$gte"]
        if "$gt" in condition_value:
            return doc_value is not None and doc_value > condition_value["$gt"]
        if "$lt" in condition_value:
            return doc_value is not None and doc_value < condition_value["$lt"]
        if "$ne" in condition_value:
            return doc_value != condition_value["$ne"]
        if "$in" in condition_value:
            candidates = condition_value["$in"]
            if isinstance(candidates, list):
                return doc_value in candidates
            return False
        # default fallback equality for other operators if present
        return doc_value == condition_value
    return doc_value == condition_value


def _document_matches(
    document: Dict[str, Any], query: Optional[Dict[str, Any]]
) -> bool:
    if not query:
        return True
    for key, value in query.items():
        if key == "$or":
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
        return SimpleNamespace(inserted_id=document.get("id"))

    def find(self, query: Optional[Dict[str, Any]] = None) -> InMemoryCursor:
        filtered = [doc for doc in self._documents if _document_matches(doc, query)]
        return InMemoryCursor(filtered)

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for doc in self._documents:
            if _document_matches(doc, query):
                return _deepcopy(doc)
        return None

    async def update_one(
        self, query: Dict[str, Any], update: Dict[str, Any]
    ) -> SimpleNamespace:
        matched = 0
        modified = 0
        for index, doc in enumerate(self._documents):
            if _document_matches(doc, query):
                matched += 1
                if "$set" in update:
                    for key, value in update["$set"].items():
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
            if "$match" in stage:
                results = [
                    doc for doc in results if _document_matches(doc, stage["$match"])
                ]
            elif "$group" in stage:
                group_spec = stage["$group"]
                sum_key = None
                sum_field = None
                for key, value in group_spec.items():
                    if key == "_id":
                        continue
                    if isinstance(value, dict) and "$sum" in value:
                        sum_key = key
                        sum_field = value["$sum"].lstrip("$")
                total = 0
                if sum_field:
                    for doc in results:
                        total += float(doc.get(sum_field, 0) or 0)
                results = (
                    [{"_id": group_spec.get("_id"), sum_key: total}]
                    if sum_key
                    else results
                )
        return InMemoryCursor(results)


class InMemoryDatabase:
    def __init__(self):
        self.nekretnine = InMemoryCollection()
        self.property_units = InMemoryCollection()
        self.zakupnici = InMemoryCollection()
        self.ugovori = InMemoryCollection()
        self.dokumenti = InMemoryCollection()
        self.podsjetnici = InMemoryCollection()
        self.racuni = InMemoryCollection()
        self.activity_logs = InMemoryCollection()
        self.maintenance_tasks = InMemoryCollection()
        self.users = InMemoryCollection()


# MongoDB connection with optional in-memory fallback
USE_IN_MEMORY_DB = os.environ.get("USE_IN_MEMORY_DB", "false").lower() == "true"
client = None

if USE_IN_MEMORY_DB:
    db = InMemoryDatabase()
else:
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ["DB_NAME"]]


async def log_activity(
    principal: Dict[str, Any],
    method: str,
    path: str,
    status: int,
    *,
    query_params: Optional[Dict[str, Any]] = None,
    request_payload: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    request_id: Optional[str] = None,
    message: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_parent_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[float] = None,
):
    try:
        log = ActivityLog(
            user=principal.get("name", "anonymous"),
            role=principal.get("role", DEFAULT_ROLE),
            actor_id=principal.get("id"),
            method=method,
            path=path,
            status_code=status,
            scopes=principal.get("scopes", []),
            query_params=query_params or {},
            request_payload=request_payload,
            ip_address=ip_address,
            request_id=request_id or str(uuid.uuid4()),
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_parent_id=entity_parent_id,
            changes=changes or None,
            duration_ms=duration_ms,
        )
        await db.activity_logs.insert_one(prepare_for_mongo(log.model_dump()))
    except Exception as exc:
        logger.error("Failed to log activity: %s", exc)


async def get_current_user(request: Request) -> Dict[str, Any]:
    path = request.url.path

    auth_header = request.headers.get("Authorization", "")
    token_value: Optional[str] = None
    if auth_header.startswith("Bearer "):
        token_value = auth_header.split(" ", 1)[1].strip()
    elif auth_header:
        token_value = auth_header.strip()

    if path in OPEN_ENDPOINTS and not token_value:
        principal = {
            "id": "guest",
            "name": "guest",
            "role": DEFAULT_ROLE,
            "scopes": _resolve_role_scopes(DEFAULT_ROLE),
        }
        request.state.current_user = principal
        return principal

    if not token_value:
        if API_TOKENS:
            raise HTTPException(
                status_code=401,
                detail="Neautorizirano",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # fallback if legacy mode without tokens and explicit auth disabled
        raise HTTPException(
            status_code=401,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        )

    api_token_entry = API_TOKENS.get(token_value)
    if api_token_entry:
        role = api_token_entry.get("role", DEFAULT_ROLE)
        explicit_scopes = api_token_entry.get("scopes", [])
        scopes = _resolve_role_scopes(role, explicit_scopes)
        principal = {
            "id": token_value,
            "name": api_token_entry.get("name", token_value),
            "role": role,
            "scopes": scopes,
        }
        request.state.current_user = principal
        return principal

    try:
        payload = jwt.decode(token_value, AUTH_SECRET, algorithms=[AUTH_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=401,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(
            status_code=401,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = User(**parse_from_mongo(user_doc))
    if not user.active:
        raise HTTPException(status_code=403, detail="Korisnički račun je deaktiviran")

    token_scopes = payload.get("scopes", [])
    scopes = _resolve_role_scopes(user.role, token_scopes or user.scopes)
    principal = {
        "id": user.id,
        "name": user.full_name or user.email,
        "role": user.role,
        "scopes": scopes,
    }
    request.state.current_user = principal
    return principal


async def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    try:
        return await get_current_user(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            request.state.current_user = None
            return None
        raise


# Create the main app without a prefix
app = FastAPI()


# Activity logging middleware
@app.middleware("http")
async def activity_logger(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request_payload: Optional[Dict[str, Any]] = None
    body_bytes: bytes = b""
    start_time = time.perf_counter()

    setattr(request.state, "audit_context", {})

    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        try:
            body_bytes = await request.body()
        except Exception:
            body_bytes = b""
        if body_bytes:
            if len(body_bytes) > 8192:
                request_payload = {"truncated": True}
            else:
                try:
                    parsed = json.loads(body_bytes.decode("utf-8"))
                    if isinstance(parsed, dict):
                        request_payload = parsed
                    elif isinstance(parsed, list):
                        request_payload = {"items": parsed[:25]}
                    else:
                        request_payload = {"value": parsed}
                except (ValueError, UnicodeDecodeError):
                    request_payload = None

    query_params = dict(request.query_params.multi_items())
    client_ip = request.client.host if request.client else None

    if request_payload and request.url.path in {
        "/api/auth/login",
        "/api/auth/register",
    }:
        if isinstance(request_payload, dict):
            for key in ("password", "password_confirm"):
                if key in request_payload:
                    request_payload[key] = "***"

    try:
        response = await call_next(request)
        status_code = response.status_code
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        principal = getattr(request.state, "current_user", None) or {
            "id": "guest",
            "name": "guest",
            "role": DEFAULT_ROLE,
            "scopes": _resolve_role_scopes(DEFAULT_ROLE),
        }
        audit_context = getattr(request.state, "audit_context", {})
        await log_activity(
            principal,
            request.method,
            request.url.path,
            status_code,
            query_params=query_params,
            request_payload=request_payload,
            ip_address=client_ip,
            request_id=request_id,
            entity_type=audit_context.get("entity_type"),
            entity_id=audit_context.get("entity_id"),
            entity_parent_id=audit_context.get("parent_id"),
            changes=audit_context.get("changes"),
            duration_ms=duration_ms,
        )
        return response
    except Exception as exc:
        status_code = getattr(exc, "status_code", 500)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        principal = getattr(request.state, "current_user", None) or {
            "id": "guest",
            "name": "guest",
            "role": DEFAULT_ROLE,
            "scopes": _resolve_role_scopes(DEFAULT_ROLE),
        }
        audit_context = getattr(request.state, "audit_context", {})
        await log_activity(
            principal,
            request.method,
            request.url.path,
            status_code,
            query_params=query_params,
            request_payload=request_payload,
            ip_address=client_ip,
            request_id=request_id,
            message=str(exc),
            entity_type=audit_context.get("entity_type"),
            entity_id=audit_context.get("entity_id"),
            entity_parent_id=audit_context.get("parent_id"),
            changes=audit_context.get("changes"),
            duration_ms=duration_ms,
        )
        raise


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


class ZakupnikStatus(str, Enum):
    AKTIVAN = "aktivan"
    ARHIVIRAN = "arhiviran"


class ZakupnikTip(str, Enum):
    ZAKUPNIK = "zakupnik"
    PARTNER = "partner"


class KontaktOsoba(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ime: str
    uloga: Optional[str] = None
    email: Optional[EmailStr] = None
    telefon: Optional[str] = None
    napomena: Optional[str] = None
    preferirani_kanal: Optional[str] = None
    hitnost_odziva_sati: Optional[int] = None


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


# Helper functions
def prepare_for_mongo(data):
    """Convert date/datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, Enum):
                data[key] = value.value
            elif isinstance(value, list):
                normalised_list = []
                for item in value:
                    if isinstance(item, dict):
                        normalised_list.append(prepare_for_mongo(item))
                    elif isinstance(item, Enum):
                        normalised_list.append(item.value)
                    else:
                        normalised_list.append(item)
                data[key] = normalised_list
    return data


def parse_from_mongo(item):
    """Parse date/datetime strings back to Python objects"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and "datum" in key.lower():
                try:
                    if "T" in value:
                        item[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    else:
                        item[key] = datetime.fromisoformat(value).date()
                except (ValueError, TypeError):
                    pass
    return item


def _coerce_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        if value.strip() == "":
            return default
        return value
    return str(value)


def _coerce_optional_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed if trimmed else None
    return str(value)


def _coerce_string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        result: List[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                result.append(text)
        return result
    if isinstance(value, str):
        parts = re.split(r"[,;]\s*", value)
        return [part.strip() for part in parts if part.strip()]
    return [str(value).strip()]


def _coerce_enum(value: Any, enum_cls: type[Enum], default: Enum) -> Enum:
    if isinstance(value, enum_cls):
        return value
    if value is None or value == "":
        return default
    try:
        return enum_cls(value)
    except ValueError:
        return default


def _coerce_date(value: Any, fallback: date) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            if "T" in value:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
            return date.fromisoformat(value)
        except (ValueError, TypeError):
            return fallback
    return fallback


def _coerce_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        normalised = re.sub(r"[^0-9,.-]", "", value).replace(",", ".")
        try:
            return float(normalised)
        except ValueError:
            return default
    return default


def _coerce_optional_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        normalised = re.sub(r"[^0-9,.-]", "", value).replace(",", ".")
        if not normalised:
            return None
        try:
            return float(normalised)
        except ValueError:
            return None
    return None


def _coerce_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            return default
    return default


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            return None
    return None


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalised = value.strip().lower()
        if normalised in {"1", "true", "yes", "da", "y"}:
            return True
        if normalised in {"0", "false", "no", "ne", "n", ""}:
            return False
    return default


def _normalise_kontakt_osobe(
    raw_value: Any, fallback_contact: Dict[str, Optional[str]]
) -> List[Dict[str, Any]]:
    contacts: List[Dict[str, Any]] = []

    if isinstance(raw_value, list):
        for item in raw_value:
            if not isinstance(item, dict):
                continue
            name = _coerce_optional_string(item.get("ime"))
            if not name:
                name = fallback_contact.get("ime") or "Kontakt"
            contact_payload: Dict[str, Any] = {
                "id": item.get("id") or str(uuid.uuid4()),
                "ime": name,
                "uloga": _coerce_optional_string(item.get("uloga")),
                "email": _coerce_optional_string(item.get("email")),
                "telefon": _coerce_optional_string(item.get("telefon")),
                "napomena": _coerce_optional_string(item.get("napomena")),
                "preferirani_kanal": _coerce_optional_string(
                    item.get("preferirani_kanal")
                ),
                "hitnost_odziva_sati": _coerce_optional_int(
                    item.get("hitnost_odziva_sati")
                ),
            }
            has_payload = any(
                contact_payload.get(key)
                for key in ("ime", "email", "telefon", "napomena")
            )
            if has_payload:
                contacts.append(contact_payload)

    if not contacts:
        fallback_name = _coerce_optional_string(fallback_contact.get("ime"))
        fallback_email = _coerce_optional_string(fallback_contact.get("email"))
        fallback_phone = _coerce_optional_string(fallback_contact.get("telefon"))
        if fallback_name or fallback_email or fallback_phone:
            contacts.append(
                {
                    "id": str(uuid.uuid4()),
                    "ime": fallback_name or "Primarni kontakt",
                    "email": fallback_email,
                    "telefon": fallback_phone,
                    "uloga": None,
                    "napomena": None,
                    "preferirani_kanal": None,
                    "hitnost_odziva_sati": None,
                }
            )

    return contacts


def _build_zakupnik_model(raw_doc: Dict[str, Any]) -> Zakupnik:
    data = parse_from_mongo(copy.deepcopy(raw_doc))
    data["oib"] = _coerce_string(data.get("oib"))
    data["naziv_firme"] = _coerce_optional_string(data.get("naziv_firme"))
    data["ime_prezime"] = _coerce_optional_string(data.get("ime_prezime"))
    data["sjediste"] = _coerce_string(data.get("sjediste"))
    data["kontakt_ime"] = _coerce_string(data.get("kontakt_ime"))
    data["kontakt_email"] = _coerce_string(data.get("kontakt_email"))
    data["kontakt_telefon"] = _coerce_string(data.get("kontakt_telefon"))
    data["iban"] = _coerce_optional_string(data.get("iban"))
    data["status"] = _coerce_enum(
        data.get("status"), ZakupnikStatus, ZakupnikStatus.AKTIVAN
    )
    data["tip"] = _coerce_enum(data.get("tip"), ZakupnikTip, ZakupnikTip.ZAKUPNIK)
    data["oznake"] = _coerce_string_list(data.get("oznake"))
    data["opis_usluge"] = _coerce_optional_string(data.get("opis_usluge"))
    data["radno_vrijeme"] = _coerce_optional_string(data.get("radno_vrijeme"))
    data["biljeske"] = _coerce_optional_string(data.get("biljeske"))
    data["hitnost_odziva_sati"] = _coerce_optional_int(data.get("hitnost_odziva_sati"))
    data["adresa_ulica"] = _coerce_optional_string(data.get("adresa_ulica"))
    data["adresa_kucni_broj"] = _coerce_optional_string(data.get("adresa_kucni_broj"))
    data["adresa_postanski_broj"] = _coerce_optional_string(
        data.get("adresa_postanski_broj")
    )
    data["adresa_grad"] = _coerce_optional_string(data.get("adresa_grad"))
    data["adresa_drzava"] = _coerce_optional_string(data.get("adresa_drzava"))
    data["pdv_obveznik"] = _coerce_bool(data.get("pdv_obveznik"), False)
    data["pdv_id"] = _coerce_optional_string(data.get("pdv_id"))
    data["maticni_broj"] = _coerce_optional_string(data.get("maticni_broj"))
    data["registracijski_broj"] = _coerce_optional_string(
        data.get("registracijski_broj")
    )
    data["eracun_dostava_kanal"] = _coerce_optional_string(
        data.get("eracun_dostava_kanal")
    )
    data["eracun_identifikator"] = _coerce_optional_string(
        data.get("eracun_identifikator")
    )
    data["eracun_email"] = _coerce_optional_string(data.get("eracun_email"))
    data["eracun_posrednik"] = _coerce_optional_string(data.get("eracun_posrednik"))
    data["fiskalizacija_napomena"] = _coerce_optional_string(
        data.get("fiskalizacija_napomena")
    )
    data["odgovorna_osoba"] = _coerce_optional_string(data.get("odgovorna_osoba"))
    data["kontakt_osobe"] = _normalise_kontakt_osobe(
        data.get("kontakt_osobe"),
        {
            "ime": data.get("kontakt_ime"),
            "email": data.get("kontakt_email"),
            "telefon": data.get("kontakt_telefon"),
        },
    )
    if data["kontakt_osobe"]:
        primary = data["kontakt_osobe"][0]
        data["kontakt_ime"] = primary.get("ime") or data["kontakt_ime"]
        data["kontakt_email"] = primary.get("email") or data["kontakt_email"]
        data["kontakt_telefon"] = primary.get("telefon") or data["kontakt_telefon"]
    try:
        return Zakupnik(**data)
    except ValidationError as exc:
        logger.warning(
            "Zakupnik dokument %s nije prošao validaciju i bit će preskočen: %s",
            raw_doc.get("id"),
            exc,
        )
        raise


def _build_zakupnici_list(raw_docs: List[Dict[str, Any]]) -> List[Zakupnik]:
    rezultat: List[Zakupnik] = []
    skipped = 0
    for raw in raw_docs:
        if not raw:
            continue
        try:
            rezultat.append(_build_zakupnik_model(raw))
        except ValidationError:
            skipped += 1
    if skipped:
        logger.warning(
            "Preskočeno %s zakupnika u agregiranom odgovoru zbog neispravnih podataka",
            skipped,
        )
    return rezultat


def _build_ugovor_model(raw_doc: Dict[str, Any]) -> Ugovor:
    data = parse_from_mongo(copy.deepcopy(raw_doc))
    today = date.today()
    data["interna_oznaka"] = _coerce_string(data.get("interna_oznaka"))
    data["nekretnina_id"] = _coerce_string(data.get("nekretnina_id"))
    data["zakupnik_id"] = _coerce_string(data.get("zakupnik_id"))
    data["property_unit_id"] = _coerce_optional_string(data.get("property_unit_id"))

    data["datum_potpisivanja"] = _coerce_date(data.get("datum_potpisivanja"), today)
    data["datum_pocetka"] = _coerce_date(data.get("datum_pocetka"), today)
    data["datum_zavrsetka"] = _coerce_date(data.get("datum_zavrsetka"), today)

    data["trajanje_mjeseci"] = _coerce_int(data.get("trajanje_mjeseci"), 0)
    data["rok_otkaza_dani"] = _coerce_int(data.get("rok_otkaza_dani"), 30)

    data["osnovna_zakupnina"] = _coerce_float(data.get("osnovna_zakupnina"), 0.0)
    for optional_key in (
        "zakupnina_po_m2",
        "cam_troskovi",
        "polog_depozit",
        "garancija",
    ):
        data[optional_key] = _coerce_optional_float(data.get(optional_key))

    data["indeksacija"] = bool(data.get("indeksacija"))
    data["indeks"] = _coerce_optional_string(data.get("indeks"))
    data["formula_indeksacije"] = _coerce_optional_string(
        data.get("formula_indeksacije")
    )
    data["obveze_odrzavanja"] = _coerce_optional_string(data.get("obveze_odrzavanja"))
    data["namjena_prostora"] = _coerce_optional_string(data.get("namjena_prostora"))
    data["rezije_brojila"] = _coerce_optional_string(data.get("rezije_brojila"))

    data["status"] = _coerce_enum(
        data.get("status"), StatusUgovora, StatusUgovora.AKTIVNO
    )

    try:
        return Ugovor(**data)
    except ValidationError as exc:
        logger.warning(
            "Ugovor dokument %s nije prošao validaciju i bit će preskočen: %s",
            raw_doc.get("id"),
            exc,
        )
        raise


def _build_ugovori_list(raw_docs: List[Dict[str, Any]]) -> List[Ugovor]:
    rezultat: List[Ugovor] = []
    skipped = 0
    for raw in raw_docs:
        if not raw:
            continue
        try:
            rezultat.append(_build_ugovor_model(raw))
        except ValidationError:
            skipped += 1
    if skipped:
        logger.warning(
            "Preskočeno %s ugovora u agregiranom odgovoru zbog neispravnih podataka",
            skipped,
        )
    return rezultat


def _normalise_ai_string(value: Optional[str]) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        value = str(value)
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip().lower()


def _strings_close(a: Optional[str], b: Optional[str]) -> bool:
    if not a or not b:
        return False
    norm_a = _normalise_ai_string(a)
    norm_b = _normalise_ai_string(b)
    if not norm_a or not norm_b:
        return False
    return norm_a == norm_b or norm_a in norm_b or norm_b in norm_a


def _try_parse_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip().replace(",", ".")
        if not text:
            return None
        return float(text)
    except (ValueError, TypeError):
        return None


def _normalise_labels(labels: Optional[List[str]]) -> List[str]:
    if not labels:
        return []
    cleaned: List[str] = []
    seen = set()
    for label in labels:
        if not isinstance(label, str):
            continue
        trimmed = label.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(trimmed)
    return cleaned


def _normalise_ai_unit_payload(unit_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(unit_data, dict):
        return {}

    def _clean(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        stripped = value.strip()
        return stripped or None

    payload: Dict[str, Any] = {}
    payload["oznaka"] = _clean(unit_data.get("oznaka"))
    payload["naziv"] = _clean(unit_data.get("naziv"))
    payload["kat"] = _clean(unit_data.get("kat"))
    payload["layout_ref"] = _clean(unit_data.get("layout_ref"))
    payload["napomena"] = _clean(unit_data.get("napomena"))
    payload["status"] = _clean(unit_data.get("status"))
    payload["osnovna_zakupnina"] = _try_parse_float(unit_data.get("osnovna_zakupnina"))
    payload["povrsina_m2"] = _try_parse_float(unit_data.get("povrsina_m2"))
    payload["metadata"] = (
        unit_data.get("metadata")
        if isinstance(unit_data.get("metadata"), dict)
        else None
    )
    return payload


async def _find_property_match_from_ai(
    nekretnina_data: Optional[Dict[str, Any]]
) -> Optional["Nekretnina"]:
    if not isinstance(nekretnina_data, dict):
        return None

    naziv = nekretnina_data.get("naziv")
    adresa = nekretnina_data.get("adresa")
    kat_opcina = nekretnina_data.get("katastarska_opcina")
    kat_cestica = nekretnina_data.get("broj_kat_cestice")

    if not any([naziv, adresa, kat_opcina, kat_cestica]):
        return None

    try:
        properties_cursor = db.nekretnine.find()
        properties_docs = (
            await properties_cursor.to_list(1000)
            if hasattr(properties_cursor, "to_list")
            else list(properties_cursor)
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("AI property match fetch failed: %s", exc)
        return None

    best_match: Optional[Nekretnina] = None
    best_score = 0

    for doc in properties_docs:
        try:
            property_obj = Nekretnina(**parse_from_mongo(doc))
        except ValidationError as exc:  # pragma: no cover - safety
            logger.warning(
                "Skipping nekretnina during AI match due to validation error: %s", exc
            )
            continue

        score = 0
        if naziv and _strings_close(naziv, property_obj.naziv):
            score += 3
        if adresa and _strings_close(adresa, property_obj.adresa):
            score += 4
        if kat_opcina and _strings_close(kat_opcina, property_obj.katastarska_opcina):
            score += 2
        if kat_cestica and _strings_close(kat_cestica, property_obj.broj_kat_cestice):
            score += 1

        if score > best_score and score >= 3:
            best_match = property_obj
            best_score = score

    return best_match


async def _find_unit_match_from_ai(
    nekretnina_id: str, unit_payload: Dict[str, Any]
) -> Optional["PropertyUnit"]:
    if not nekretnina_id:
        return None

    oznaka = unit_payload.get("oznaka")
    naziv = unit_payload.get("naziv")
    if not oznaka and not naziv:
        return None

    try:
        cursor = db.property_units.find({"nekretnina_id": nekretnina_id})
        docs = await cursor.to_list(500) if hasattr(cursor, "to_list") else list(cursor)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("AI podprostor fetch failed: %s", exc)
        return None

    for doc in docs:
        try:
            unit_obj = PropertyUnit(**parse_from_mongo(doc))
        except ValidationError as exc:  # pragma: no cover - safety
            logger.warning(
                "Skipping podprostor during AI match due to validation error: %s", exc
            )
            continue

        if oznaka and unit_obj.oznaka and _strings_close(oznaka, unit_obj.oznaka):
            return unit_obj
        if naziv and unit_obj.naziv and _strings_close(naziv, unit_obj.naziv):
            return unit_obj

    return None


async def _create_property_unit_from_ai(
    nekretnina_id: str, unit_payload: Dict[str, Any]
) -> Optional["PropertyUnit"]:
    oznaka = unit_payload.get("oznaka")
    if not oznaka:
        return None

    status_value = unit_payload.get("status") or PropertyUnitStatus.DOSTUPNO.value
    try:
        status_enum = (
            status_value
            if isinstance(status_value, PropertyUnitStatus)
            else PropertyUnitStatus(status_value)
        )
    except (ValueError, TypeError):
        status_enum = PropertyUnitStatus.DOSTUPNO

    base_note = "Automatski kreirano iz AI analize PDF ugovora."
    existing_note = unit_payload.get("napomena")
    combined_note = f"{existing_note}\n{base_note}" if existing_note else base_note

    metadata = unit_payload.get("metadata") or {}
    if isinstance(metadata, dict):
        metadata = {**metadata, "source": "ai_parse_pdf_contract"}
    else:
        metadata = {"source": "ai_parse_pdf_contract"}

    unit = PropertyUnit(
        nekretnina_id=nekretnina_id,
        oznaka=oznaka,
        naziv=unit_payload.get("naziv"),
        kat=unit_payload.get("kat"),
        povrsina_m2=unit_payload.get("povrsina_m2"),
        status=status_enum,
        osnovna_zakupnina=unit_payload.get("osnovna_zakupnina"),
        layout_ref=unit_payload.get("layout_ref"),
        napomena=combined_note,
        metadata=metadata,
    )

    await db.property_units.insert_one(prepare_for_mongo(unit.model_dump()))
    logger.info(
        "AI kreirao novi podprostor %s za nekretninu %s", unit.oznaka, nekretnina_id
    )
    return unit


async def resolve_property_unit_from_ai(
    parsed_data: Dict[str, Any]
) -> Dict[str, Optional[Any]]:
    document_type = (parsed_data.get("document_type") or "").lower()
    unit_suggestion_raw = parsed_data.get("property_unit")
    unit_suggestion = _normalise_ai_unit_payload(unit_suggestion_raw)
    parsed_data["property_unit"] = unit_suggestion if unit_suggestion else None

    if document_type not in {"ugovor", "aneks"}:
        return {
            "property": None,
            "matched_unit": None,
            "created_unit": None,
        }

    if not unit_suggestion or not unit_suggestion.get("oznaka"):
        return {
            "property": None,
            "matched_unit": None,
            "created_unit": None,
        }

    property_match = await _find_property_match_from_ai(parsed_data.get("nekretnina"))
    if not property_match:
        return {
            "property": None,
            "matched_unit": None,
            "created_unit": None,
        }

    matched_unit = await _find_unit_match_from_ai(property_match.id, unit_suggestion)
    created_unit: Optional[PropertyUnit] = None

    if not matched_unit:
        created_unit = await _create_property_unit_from_ai(
            property_match.id, unit_suggestion
        )
        matched_unit = created_unit

    return {
        "property": property_match,
        "matched_unit": matched_unit,
        "created_unit": created_unit,
    }


async def build_ai_parse_response(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    resolution = {"property": None, "matched_unit": None, "created_unit": None}
    try:
        resolution = await resolve_property_unit_from_ai(parsed_data)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("AI property unit resolution failed: %s", exc, exc_info=True)

    matched_property = resolution.get("property")
    matched_unit = resolution.get("matched_unit")
    created_unit = resolution.get("created_unit")

    return {
        "success": True,
        "data": parsed_data,
        "message": "PDF je uspješno analiziran i podaci su izvučeni",
        "matched_property": (
            matched_property.model_dump(mode="json") if matched_property else None
        ),
        "matched_property_unit": (
            matched_unit.model_dump(mode="json") if matched_unit else None
        ),
        "created_property_unit": (
            created_unit.model_dump(mode="json") if created_unit else None
        ),
    }


async def _get_property_or_404(nekretnina_id: str) -> "Nekretnina":
    dokument = await db.nekretnine.find_one({"id": nekretnina_id})
    if not dokument:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")
    return Nekretnina(**parse_from_mongo(dokument))


async def _get_property_unit_or_404(property_unit_id: str) -> "PropertyUnit":
    dokument = await db.property_units.find_one({"id": property_unit_id})
    if not dokument:
        raise HTTPException(status_code=404, detail="Podprostor nije pronađen")
    return PropertyUnit(**parse_from_mongo(dokument))


async def _get_task_or_404(task_id: str) -> MaintenanceTask:
    dokument = await db.maintenance_tasks.find_one({"id": task_id})
    if not dokument:
        raise HTTPException(status_code=404, detail="Radni nalog nije pronađen")
    return MaintenanceTask(**parse_from_mongo(dokument))


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
    proslogodisnji_neto_prihod: Optional[float] = None  # €

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
    proslogodisnji_neto_prihod: Optional[float] = None
    zadnja_obnova: Optional[date] = None
    potrebna_ulaganja: Optional[str] = None
    troskovi_odrzavanja: Optional[float] = None
    osiguranje: Optional[str] = None
    sudski_sporovi: Optional[str] = None
    hipoteke: Optional[str] = None
    napomene: Optional[str] = None


class PropertyUnit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nekretnina_id: str
    oznaka: str
    naziv: Optional[str] = None
    opis: Optional[str] = None
    kat: Optional[str] = None
    povrsina_m2: Optional[float] = None
    status: PropertyUnitStatus = PropertyUnitStatus.DOSTUPNO
    osnovna_zakupnina: Optional[float] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    raspolozivo_od: Optional[date] = None
    layout_ref: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    napomena: Optional[str] = None
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    azuriran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PropertyUnitCreate(BaseModel):
    oznaka: str
    naziv: Optional[str] = None
    opis: Optional[str] = None
    kat: Optional[str] = None
    povrsina_m2: Optional[float] = None
    status: PropertyUnitStatus = PropertyUnitStatus.DOSTUPNO
    osnovna_zakupnina: Optional[float] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    raspolozivo_od: Optional[date] = None
    layout_ref: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    napomena: Optional[str] = None


class PropertyUnitUpdate(BaseModel):
    oznaka: Optional[str] = None
    naziv: Optional[str] = None
    opis: Optional[str] = None
    kat: Optional[str] = None
    povrsina_m2: Optional[float] = None
    status: Optional[PropertyUnitStatus] = None
    osnovna_zakupnina: Optional[float] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    raspolozivo_od: Optional[date] = None
    layout_ref: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    napomena: Optional[str] = None


class PropertyUnitBulkUpdate(BaseModel):
    unit_ids: List[str]
    updates: PropertyUnitUpdate


class Zakupnik(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv_firme: Optional[str] = None
    ime_prezime: Optional[str] = None
    oib: str  # OIB ili VAT ID
    sjediste: str
    adresa_ulica: Optional[str] = None
    adresa_kucni_broj: Optional[str] = None
    adresa_postanski_broj: Optional[str] = None
    adresa_grad: Optional[str] = None
    adresa_drzava: Optional[str] = None
    kontakt_ime: str
    kontakt_email: str
    kontakt_telefon: str
    iban: Optional[str] = None
    pdv_obveznik: bool = False
    pdv_id: Optional[str] = None
    maticni_broj: Optional[str] = None
    registracijski_broj: Optional[str] = None
    eracun_dostava_kanal: Optional[str] = None
    eracun_identifikator: Optional[str] = None
    eracun_email: Optional[str] = None
    eracun_posrednik: Optional[str] = None
    fiskalizacija_napomena: Optional[str] = None
    odgovorna_osoba: Optional[str] = None
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: ZakupnikStatus = ZakupnikStatus.AKTIVAN
    tip: ZakupnikTip = ZakupnikTip.ZAKUPNIK
    oznake: List[str] = Field(default_factory=list)
    opis_usluge: Optional[str] = None
    radno_vrijeme: Optional[str] = None
    biljeske: Optional[str] = None
    hitnost_odziva_sati: Optional[int] = None
    kontakt_osobe: List[KontaktOsoba] = Field(default_factory=list)


class ZakupnikCreate(BaseModel):
    naziv_firme: Optional[str] = None
    ime_prezime: Optional[str] = None
    oib: str
    sjediste: str
    adresa_ulica: Optional[str] = None
    adresa_kucni_broj: Optional[str] = None
    adresa_postanski_broj: Optional[str] = None
    adresa_grad: Optional[str] = None
    adresa_drzava: Optional[str] = None
    kontakt_ime: str
    kontakt_email: str
    kontakt_telefon: str
    iban: Optional[str] = None
    pdv_obveznik: bool = False
    pdv_id: Optional[str] = None
    maticni_broj: Optional[str] = None
    registracijski_broj: Optional[str] = None
    eracun_dostava_kanal: Optional[str] = None
    eracun_identifikator: Optional[str] = None
    eracun_email: Optional[str] = None
    eracun_posrednik: Optional[str] = None
    fiskalizacija_napomena: Optional[str] = None
    odgovorna_osoba: Optional[str] = None
    status: ZakupnikStatus = ZakupnikStatus.AKTIVAN
    tip: ZakupnikTip = ZakupnikTip.ZAKUPNIK
    oznake: List[str] = Field(default_factory=list)
    opis_usluge: Optional[str] = None
    radno_vrijeme: Optional[str] = None
    biljeske: Optional[str] = None
    hitnost_odziva_sati: Optional[int] = None
    kontakt_osobe: List[KontaktOsoba] = Field(default_factory=list)


class Ugovor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interna_oznaka: str
    status: StatusUgovora = StatusUgovora.AKTIVNO
    nekretnina_id: str
    zakupnik_id: str
    property_unit_id: Optional[str] = None

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
    property_unit_id: Optional[str] = None
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


class UgovorUpdate(UgovorCreate):
    pass


class AneksRequest(BaseModel):
    ugovor_id: str
    nova_zakupnina: Optional[float] = None
    novi_datum_zavrsetka: Optional[date] = None
    dodatne_promjene: Optional[str] = None


class ContractCloneRequest(BaseModel):
    ugovor_id: str
    nova_interna_oznaka: str
    novo_trajanje_mjeseci: int
    nova_zakupnina: float
    novi_datum_pocetka: Optional[date] = None
    novi_datum_zavrsetka: Optional[date] = None
    dodatne_odredbe: Optional[str] = None


def _build_annex_fallback(
    ugovor: Ugovor,
    promjene_text: str,
    property_summary: str,
    tenant_summary: str,
) -> str:
    lines = [
        "ANEKS UGOVORA",
        "",
        f"Aneks se odnosi na ugovor interne oznake {ugovor.interna_oznaka} sklopljen {ugovor.datum_potpisivanja.isoformat()} između zakupodavca i zakupnika navedenih u originalnom ugovoru.",
        "",
        "1. PREDMET UGOVORA",
        property_summary,
        tenant_summary,
        "",
        "2. IZMJENE I DOPUNE",
        promjene_text or "Nema dodatnih promjena specificiranih od korisnika.",
        "",
        "3. OSTALI UVJETI",
        "Sve ostale odredbe izvornog ugovora ostaju nepromijenjene i u potpunosti na snazi.",
        "",
        "4. STUPANJE NA SNAGU",
        "Ovaj aneks stupa na snagu danom potpisa obiju ugovornih strana.",
        "",
        "Potpis zakupodavca: ____________________",
        "Potpis zakupnika:   ____________________",
    ]
    return "\n".join(lines)


def _add_months(base_date: date, months: int) -> date:
    total_months = base_date.month - 1 + months
    year = base_date.year + total_months // 12
    month = total_months % 12 + 1
    day = min(base_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _build_contract_clone_fallback(
    original: Ugovor,
    novi_pocetak: date,
    novi_zavrsetak: date,
    nova_zakupnina: float,
    nova_oznaka: str,
    novo_trajanje_mjeseci: int,
    property_summary: str,
    tenant_summary: str,
) -> str:
    lines = [
        f"UGOVOR O ZAKUPU – {nova_oznaka}",
        "",
        "UVOD",
        (
            f"Ovaj ugovor predstavlja produženje i rekalkulaciju uvjeta ranije sklopljenog ugovora"
            f" interne oznake {original.interna_oznaka}. Strane potvrđuju da ovaj dokument"
            " u cijelosti zamjenjuje ranije dogovorene komercijalne uvjete te stupa na snagu"
            " danom potpisa."  # keep one string
        ),
        "",
        "STRANE",
        tenant_summary,
        property_summary,
        "",
        "TRAJANJE I PREDMET ZAKUPA",
        f"Trajanje ugovora: {original.trajanje_mjeseci} mjeseci (ranije) / {novo_trajanje_mjeseci} mjeseci (novo)",
        f"Razdoblje zakupa: {novi_pocetak.isoformat()} - {novi_zavrsetak.isoformat()}",
        "Predmet zakupa ostaje identičan ranijem ugovoru.",
        "",
        "FINANCIJSKI UVJETI",
        f"Nova ugovorena zakupnina: {nova_zakupnina:.2f} EUR mjesečno.",
        f"Originalna zakupnina: {original.osnovna_zakupnina:.2f} EUR mjesečno.",
        "Svi ostali financijski elementi ostaju nepromijenjeni osim ako nije drugačije navedeno u prilozima.",
        "",
        "OBVEZE STRANA",
        original.obveze_odrzavanja
        or "Obveze održavanja ostaju usklađene s izvornim ugovorom.",
        "",
        "ZAVRŠNE ODREDBE",
        "Potpisom ovog ugovora strane potvrđuju da su pročitali i razumjeli sve odredbe te da prihvaćaju njihove učinke.",
        "Sve ostale odredbe izvornog ugovora primjenjuju se na odgovarajući način ako nisu u suprotnosti s ovim dokumentom.",
        "",
        "Potpis zakupodavca: ____________________",
        "Potpis zakupnika:   ____________________",
    ]
    return "\n".join(lines)


class Dokument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str
    tip: TipDokumenta
    opis: Optional[str] = None

    # Povezanosti
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    property_unit_id: Optional[str] = None

    putanja_datoteke: str
    velicina_datoteke: int
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DokumentCreate(BaseModel):
    naziv: str
    tip: TipDokumenta
    opis: Optional[str] = None
    nekretnina_id: Optional[str] = None
    zakupnik_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    property_unit_id: Optional[str] = None


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
    property_unit_id: Optional[str] = None
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
    property_unit_id: Optional[str] = None
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
    property_unit_id: Optional[str] = None
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


class MaintenanceActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tip: str
    opis: Optional[str] = None
    autor: Optional[str] = None
    status: Optional[MaintenanceStatus] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MaintenanceTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str
    opis: Optional[str] = None
    status: MaintenanceStatus = MaintenanceStatus.NOVI
    prioritet: MaintenancePriority = MaintenancePriority.SREDNJE
    nekretnina_id: Optional[str] = None
    property_unit_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    prijavio: Optional[str] = None
    dodijeljeno: Optional[str] = None
    dodijeljeno_user_id: Optional[str] = None
    rok: Optional[date] = None
    oznake: List[str] = Field(default_factory=list)
    napomena: Optional[str] = None
    kreiran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    azuriran: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    aktivnosti: List[MaintenanceActivity] = Field(default_factory=list)
    procijenjeni_trosak: Optional[float] = None
    stvarni_trosak: Optional[float] = None
    zavrseno_na: Optional[datetime] = None


class MaintenanceTaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    naziv: str
    opis: Optional[str] = None
    status: MaintenanceStatus = MaintenanceStatus.NOVI
    prioritet: MaintenancePriority = MaintenancePriority.SREDNJE
    nekretnina_id: Optional[str] = None
    property_unit_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    prijavio: Optional[str] = None
    dodijeljeno: Optional[str] = None
    dodijeljeno_user_id: Optional[str] = None
    rok: Optional[date] = None
    oznake: List[str] = Field(default_factory=list)
    napomena: Optional[str] = None
    procijenjeni_trosak: Optional[float] = None
    stvarni_trosak: Optional[float] = None


class MaintenanceTaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    naziv: Optional[str] = None
    opis: Optional[str] = None
    status: Optional[MaintenanceStatus] = None
    prioritet: Optional[MaintenancePriority] = None
    nekretnina_id: Optional[str] = None
    property_unit_id: Optional[str] = None
    ugovor_id: Optional[str] = None
    prijavio: Optional[str] = None
    dodijeljeno: Optional[str] = None
    dodijeljeno_user_id: Optional[str] = None
    rok: Optional[date] = None
    oznake: Optional[List[str]] = None
    napomena: Optional[str] = None
    procijenjeni_trosak: Optional[float] = None
    stvarni_trosak: Optional[float] = None


class MaintenanceCommentCreate(BaseModel):
    poruka: str
    autor: Optional[str] = None


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: Optional[str] = None
    role: str = DEFAULT_ROLE
    scopes: List[str] = Field(default_factory=list)
    password_hash: str
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    scopes: List[str]
    active: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: str = "tenant"
    scopes: Optional[List[str]] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    scopes: Optional[List[str]] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user: str
    role: str
    actor_id: Optional[str] = None
    method: str
    path: str
    status_code: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: Optional[str] = None
    scopes: List[str] = Field(default_factory=list)
    query_params: Dict[str, Any] = Field(default_factory=dict)
    request_payload: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    entity_parent_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None


# Authentication routes -----------------------------------------------------------------


@api_router.post("/auth/register", response_model=UserPublic)
async def register_user(
    payload: UserCreate,
    request: Request,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    existing_count = await db.users.count_documents({})
    if existing_count > 0:
        if not current_user or current_user.get("id") == "guest":
            raise HTTPException(
                status_code=403, detail="Nedostaju ovlasti za registraciju"
            )
        if (
            not _scope_matches(current_user.get("scopes", []), "users:create")
            and not _scope_matches(current_user.get("scopes", []), "users:*")
            and "*" not in current_user.get("scopes", [])
        ):
            raise HTTPException(
                status_code=403, detail="Nedostaju ovlasti za registraciju"
            )

    existing_user = await _get_user_by_email(payload.email.lower())
    if existing_user:
        raise HTTPException(
            status_code=409, detail="Korisnik s navedenim emailom već postoji"
        )

    role = payload.role or DEFAULT_ROLE
    explicit_scopes = payload.scopes or []
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        role=role,
        scopes=explicit_scopes,
        password_hash=hash_password(payload.password),
    )
    await db.users.insert_one(prepare_for_mongo(user.model_dump()))
    request.state.audit_context = {"entity_type": "user", "entity_id": user.id}
    return _user_to_public(user)


@api_router.post("/auth/login", response_model=TokenResponse)
async def login_user(payload: LoginRequest, request: Request):
    user = await _get_user_by_email(payload.email.lower())
    if (
        not user
        or not user.active
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Pogrešan email ili lozinka")

    scopes = _resolve_role_scopes(user.role, user.scopes)
    access_token = create_access_token(
        {"sub": user.id, "role": user.role, "scopes": scopes}
    )
    request.state.audit_context = {"entity_type": "user", "entity_id": user.id}
    return TokenResponse(access_token=access_token, user=_user_to_public(user))


@api_router.get("/auth/me", response_model=UserPublic)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        user = await _get_user_or_404(current_user.get("id"))
        return _user_to_public(user)
    except HTTPException:
        # fallback for API token based principals
        return UserPublic(
            id=current_user.get("id", "unknown"),
            email=current_user.get("name", "unknown"),
            full_name=current_user.get("name"),
            role=current_user.get("role", DEFAULT_ROLE),
            scopes=current_user.get("scopes", []),
            active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )


@api_router.get(
    "/users",
    response_model=List[UserPublic],
    dependencies=[Depends(require_scopes("users:read"))],
)
async def list_users():
    raw_users = await db.users.find().to_list(1000)
    rezultat: List[UserPublic] = []
    for raw in raw_users:
        try:
            rezultat.append(_user_to_public(User(**parse_from_mongo(raw))))
        except ValidationError:
            continue
    return rezultat


@api_router.get(
    "/users/assignees",
    response_model=List[UserPublic],
    dependencies=[Depends(require_scopes("users:assign"))],
)
async def list_assignable_users():
    raw_users = await db.users.find(
        {"role": {"$in": list(ALLOWED_MAINTENANCE_ASSIGN_ROLES)}}
    ).to_list(500)
    rezultat: List[UserPublic] = []
    for raw in raw_users:
        try:
            rezultat.append(_user_to_public(User(**parse_from_mongo(raw))))
        except ValidationError:
            continue
    return rezultat


# Routes


# Root route
@api_router.get("/")
async def root():
    return {"message": "Sustav za upravljanje nekretninama", "status": "aktivan"}


# Nekretnine
@api_router.post(
    "/nekretnine",
    response_model=Nekretnina,
    status_code=201,
    dependencies=[Depends(require_scopes("properties:create"))],
)
async def create_nekretnina(nekretnina: NekretninarCreate, request: Request):
    nekretnina_dict = prepare_for_mongo(nekretnina.model_dump())
    nekretnina_obj = Nekretnina(**nekretnina_dict)
    await db.nekretnine.insert_one(prepare_for_mongo(nekretnina_obj.model_dump()))
    request.state.audit_context = {
        "entity_type": "property",
        "entity_id": nekretnina_obj.id,
    }
    return nekretnina_obj


@api_router.get(
    "/nekretnine",
    response_model=List[Nekretnina],
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def get_nekretnine():
    nekretnine = await db.nekretnine.find().to_list(1000)
    return [Nekretnina(**parse_from_mongo(n)) for n in nekretnine]


@api_router.get(
    "/nekretnine/{nekretnina_id}",
    response_model=Nekretnina,
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def get_nekretnina(nekretnina_id: str):
    nekretnina = await db.nekretnine.find_one({"id": nekretnina_id})
    if not nekretnina:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")
    return Nekretnina(**parse_from_mongo(nekretnina))


@api_router.put(
    "/nekretnine/{nekretnina_id}",
    response_model=Nekretnina,
    dependencies=[Depends(require_scopes("properties:update"))],
)
async def update_nekretnina(
    nekretnina_id: str, nekretnina: NekretninarCreate, request: Request
):
    nekretnina_dict = prepare_for_mongo(nekretnina.model_dump())
    result = await db.nekretnine.update_one(
        {"id": nekretnina_id}, {"$set": nekretnina_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")

    updated_nekretnina = await db.nekretnine.find_one({"id": nekretnina_id})
    request.state.audit_context = {
        "entity_type": "property",
        "entity_id": nekretnina_id,
    }
    return Nekretnina(**parse_from_mongo(updated_nekretnina))


@api_router.delete(
    "/nekretnine/{nekretnina_id}",
    dependencies=[Depends(require_scopes("properties:delete"))],
)
async def delete_nekretnina(nekretnina_id: str, request: Request):
    result = await db.nekretnine.delete_one({"id": nekretnina_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nekretnina nije pronađena")

    # Remove all units linked to the property as part of the cascade delete
    povezane_jedinice = await db.property_units.find(
        {"nekretnina_id": nekretnina_id}
    ).to_list(1000)
    for jedinica in povezane_jedinice:
        await db.property_units.delete_one({"id": jedinica.get("id")})
    request.state.audit_context = {
        "entity_type": "property",
        "entity_id": nekretnina_id,
    }
    return {"poruka": "Nekretnina je uspješno obrisana"}


# Property units
@api_router.get(
    "/nekretnine/{nekretnina_id}/units",
    response_model=List[PropertyUnit],
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def list_property_units(nekretnina_id: str):
    await _get_property_or_404(nekretnina_id)
    jedinice = await db.property_units.find({"nekretnina_id": nekretnina_id}).to_list(
        1000
    )
    rezultat = [PropertyUnit(**parse_from_mongo(j)) for j in jedinice]
    rezultat.sort(key=lambda item: ((item.kat or ""), item.oznaka))
    return rezultat


@api_router.post(
    "/nekretnine/{nekretnina_id}/units",
    response_model=PropertyUnit,
    status_code=201,
    dependencies=[Depends(require_scopes("properties:update"))],
)
async def create_property_unit(
    nekretnina_id: str, jedinica: PropertyUnitCreate, request: Request
):
    await _get_property_or_404(nekretnina_id)

    jedinica_payload = jedinica.model_dump(mode="json")
    ugovor_id_value = jedinica_payload.get("ugovor_id")
    if ugovor_id_value:
        ugovor_doc = await db.ugovori.find_one({"id": ugovor_id_value})
        if not ugovor_doc:
            raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
        try:
            ugovor_obj = _build_ugovor_model(ugovor_doc)
        except ValidationError as exc:
            logger.error(
                "Ugovor %s nije moguće validirati tijekom kreiranja podprostora: %s",
                ugovor_id_value,
                exc,
            )
            raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")
        if ugovor_obj.nekretnina_id != nekretnina_id:
            raise HTTPException(
                status_code=400, detail="Ugovor je vezan uz drugu nekretninu"
            )
        jedinica_payload.setdefault("zakupnik_id", ugovor_obj.zakupnik_id)
        jedinica_payload.setdefault("status", PropertyUnitStatus.IZNAJMLJENO.value)
    elif jedinica_payload.get("zakupnik_id") and not jedinica_payload.get("status"):
        jedinica_payload["status"] = PropertyUnitStatus.IZNAJMLJENO.value

    jedinica_obj = PropertyUnit(nekretnina_id=nekretnina_id, **jedinica_payload)
    jedinica_obj.azuriran = datetime.now(timezone.utc)

    await db.property_units.insert_one(prepare_for_mongo(jedinica_obj.model_dump()))
    request.state.audit_context = {
        "entity_type": "unit",
        "entity_id": jedinica_obj.id,
        "parent_id": nekretnina_id,
    }
    return jedinica_obj


@api_router.get(
    "/units",
    response_model=List[PropertyUnit],
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def list_all_units(
    nekretnina_id: Optional[str] = None, status: Optional[PropertyUnitStatus] = None
):
    query: Dict[str, Any] = {}
    if nekretnina_id:
        query["nekretnina_id"] = nekretnina_id
    if status:
        query["status"] = (
            status.value if isinstance(status, PropertyUnitStatus) else status
        )

    cursor = db.property_units.find(query if query else None)
    jedinice = await cursor.to_list(1000)
    rezultat = [PropertyUnit(**parse_from_mongo(j)) for j in jedinice]
    rezultat.sort(key=lambda item: ((item.kat or ""), item.oznaka))
    return rezultat


@api_router.get(
    "/units/{property_unit_id}",
    response_model=PropertyUnit,
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def get_property_unit(property_unit_id: str):
    return await _get_property_unit_or_404(property_unit_id)


@api_router.put(
    "/units/{property_unit_id}",
    response_model=PropertyUnit,
    dependencies=[Depends(require_scopes("properties:update"))],
)
async def update_property_unit(
    property_unit_id: str, jedinica: PropertyUnitUpdate, request: Request
):
    existing = await db.property_units.find_one({"id": property_unit_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Podprostor nije pronađen")

    update_payload = jedinica.model_dump(exclude_unset=True, mode="json")

    if not update_payload:
        return PropertyUnit(**parse_from_mongo(existing))

    existing_unit = PropertyUnit(**parse_from_mongo(existing))

    if "ugovor_id" in update_payload:
        ugovor_id_value = update_payload.get("ugovor_id")
        if ugovor_id_value:
            ugovor_doc = await db.ugovori.find_one({"id": ugovor_id_value})
            if not ugovor_doc:
                raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
            try:
                ugovor_obj = _build_ugovor_model(ugovor_doc)
            except ValidationError as exc:
                logger.error(
                    "Ugovor %s nije moguće validirati tijekom ažuriranja podprostora: %s",
                    ugovor_id_value,
                    exc,
                )
                raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")
            if ugovor_obj.nekretnina_id != existing_unit.nekretnina_id:
                raise HTTPException(
                    status_code=400, detail="Ugovor je vezan uz drugu nekretninu"
                )
            update_payload.setdefault("zakupnik_id", ugovor_obj.zakupnik_id)
            update_payload.setdefault("status", PropertyUnitStatus.IZNAJMLJENO.value)
        else:
            update_payload["ugovor_id"] = None
            update_payload.setdefault("zakupnik_id", None)
            update_payload.setdefault("status", PropertyUnitStatus.DOSTUPNO.value)

    status_value = update_payload.get("status")
    status_enum: Optional[PropertyUnitStatus] = None
    if status_value is not None:
        try:
            status_enum = (
                status_value
                if isinstance(status_value, PropertyUnitStatus)
                else PropertyUnitStatus(status_value)
            )
        except (TypeError, ValueError):
            status_enum = None

    if status_enum and status_enum != PropertyUnitStatus.IZNAJMLJENO:
        update_payload.setdefault("ugovor_id", None)
        if status_enum == PropertyUnitStatus.DOSTUPNO:
            update_payload.setdefault("zakupnik_id", None)

    if status_enum:
        update_payload["status"] = status_enum.value

    update_payload["azuriran"] = datetime.now(timezone.utc)

    await db.property_units.update_one(
        {"id": property_unit_id}, {"$set": prepare_for_mongo(update_payload)}
    )

    updated = await db.property_units.find_one({"id": property_unit_id})
    if not updated:
        raise HTTPException(
            status_code=500, detail="Ažuriranje podprostora nije uspjelo"
        )
    request.state.audit_context = {"entity_type": "unit", "entity_id": property_unit_id}
    return PropertyUnit(**parse_from_mongo(updated))


@api_router.delete(
    "/units/{property_unit_id}",
    dependencies=[Depends(require_scopes("properties:delete"))],
)
async def delete_property_unit(property_unit_id: str, request: Request):
    existing = await db.property_units.find_one({"id": property_unit_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Podprostor nije pronađen")

    if existing.get("ugovor_id"):
        raise HTTPException(
            status_code=400,
            detail="Podprostor je povezan s ugovorom i ne može se obrisati",
        )

    await db.property_units.delete_one({"id": property_unit_id})
    request.state.audit_context = {"entity_type": "unit", "entity_id": property_unit_id}
    return {"poruka": "Podprostor je uspješno obrisan"}


@api_router.post(
    "/units/bulk-update",
    dependencies=[Depends(require_scopes("properties:update"))],
)
async def bulk_update_property_units(payload: PropertyUnitBulkUpdate, request: Request):
    if not payload.unit_ids:
        raise HTTPException(
            status_code=400, detail="Odaberite barem jedan podprostor za ažuriranje"
        )

    updated_units: List[PropertyUnit] = []
    errors: Dict[str, Any] = {}

    for unit_id in payload.unit_ids:
        try:
            updated = await update_property_unit(unit_id, payload.updates)
            updated_units.append(updated)
        except HTTPException as exc:
            errors[unit_id] = exc.detail
        except Exception as exc:  # pragma: no cover - defensive fallback
            errors[unit_id] = str(exc)

    request.state.audit_context = {
        "entity_type": "unit_bulk",
        "entity_id": ",".join(payload.unit_ids),
    }

    return {
        "updated_count": len(updated_units),
        "errors": errors,
        "units": [unit.model_dump(mode="json") for unit in updated_units],
    }


# Zakupnici
@api_router.post(
    "/zakupnici",
    response_model=Zakupnik,
    status_code=201,
    dependencies=[Depends(require_scopes("tenants:create"))],
)
async def create_zakupnik(zakupnik: ZakupnikCreate, request: Request):
    zakupnik_dict = zakupnik.model_dump()
    if zakupnik_dict.get("kontakt_osobe"):
        primary = zakupnik_dict["kontakt_osobe"][0]
        zakupnik_dict["kontakt_ime"] = (
            zakupnik_dict.get("kontakt_ime") or primary.get("ime") or "Primarni kontakt"
        )
        zakupnik_dict["kontakt_email"] = (
            zakupnik_dict.get("kontakt_email") or primary.get("email") or ""
        )
        zakupnik_dict["kontakt_telefon"] = (
            zakupnik_dict.get("kontakt_telefon") or primary.get("telefon") or ""
        )

    zakupnik_dict = prepare_for_mongo(zakupnik_dict)
    zakupnik_obj = Zakupnik(**zakupnik_dict)
    await db.zakupnici.insert_one(prepare_for_mongo(zakupnik_obj.model_dump()))
    request.state.audit_context = {
        "entity_type": "tenant",
        "entity_id": zakupnik_obj.id,
    }
    return zakupnik_obj


@api_router.get(
    "/zakupnici",
    response_model=List[Zakupnik],
    dependencies=[Depends(require_scopes("tenants:read"))],
)
async def get_zakupnici(
    search: Optional[str] = None,
    status: Optional[ZakupnikStatus] = None,
    tip: Optional[ZakupnikTip] = None,
):
    filters: List[Dict[str, Any]] = []

    if status:
        filters.append({"status": status})

    if tip:
        filters.append({"tip": tip})

    if search:
        trimmed = search.strip()
        if trimmed:
            pattern = {"$regex": re.escape(trimmed), "$options": "i"}
            filters.append(
                {
                    "$or": [
                        {"naziv_firme": pattern},
                        {"ime_prezime": pattern},
                        {"oib": pattern},
                        {"kontakt_ime": pattern},
                        {"kontakt_email": pattern},
                        {"kontakt_telefon": pattern},
                    ]
                }
            )

    if filters:
        if len(filters) == 1:
            query = filters[0]
        else:
            query = {"$and": filters}
    else:
        query = None

    zakupnici_cursor = db.zakupnici.find(query) if query else db.zakupnici.find()
    raw_zakupnici = await zakupnici_cursor.to_list(1000)

    rezultat: List[Zakupnik] = []
    skipped = 0
    for raw in raw_zakupnici:
        try:
            rezultat.append(_build_zakupnik_model(raw))
        except ValidationError:
            skipped += 1
            continue

    if skipped:
        logger.warning("Preskočeno %s zakupnika zbog neispravnih podataka", skipped)

    return rezultat


@api_router.get(
    "/zakupnici/{zakupnik_id}",
    response_model=Zakupnik,
    dependencies=[Depends(require_scopes("tenants:read"))],
)
async def get_zakupnik(zakupnik_id: str):
    zakupnik = await db.zakupnici.find_one({"id": zakupnik_id})
    if not zakupnik:
        raise HTTPException(status_code=404, detail="Zakupnik nije pronađen")
    try:
        return _build_zakupnik_model(zakupnik)
    except ValidationError as exc:
        logger.error("Zakupnik %s se ne može učitati: %s", zakupnik_id, exc)
        raise HTTPException(status_code=500, detail="Neispravni podaci zakupnika")


@api_router.put(
    "/zakupnici/{zakupnik_id}",
    response_model=Zakupnik,
    dependencies=[Depends(require_scopes("tenants:update"))],
)
async def update_zakupnik(zakupnik_id: str, zakupnik: ZakupnikCreate, request: Request):
    existing = await db.zakupnici.find_one({"id": zakupnik_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zakupnik nije pronađen")

    update_dict = zakupnik.model_dump()
    if update_dict.get("kontakt_osobe"):
        primary = update_dict["kontakt_osobe"][0]
        update_dict["kontakt_ime"] = (
            update_dict.get("kontakt_ime") or primary.get("ime") or "Primarni kontakt"
        )
        update_dict["kontakt_email"] = (
            update_dict.get("kontakt_email") or primary.get("email") or ""
        )
        update_dict["kontakt_telefon"] = (
            update_dict.get("kontakt_telefon") or primary.get("telefon") or ""
        )

    update_payload = prepare_for_mongo(update_dict)
    await db.zakupnici.update_one({"id": zakupnik_id}, {"$set": update_payload})

    updated = await db.zakupnici.find_one({"id": zakupnik_id})
    if not updated:
        raise HTTPException(status_code=500, detail="Ažuriranje zakupnika nije uspjelo")
    try:
        request.state.audit_context = {
            "entity_type": "tenant",
            "entity_id": zakupnik_id,
        }
        return _build_zakupnik_model(updated)
    except ValidationError as exc:
        logger.error(
            "Zakupnik %s se ne može učitati nakon ažuriranja: %s", zakupnik_id, exc
        )
        raise HTTPException(status_code=500, detail="Neispravni podaci zakupnika")


# Ugovori
@api_router.post(
    "/ugovori",
    response_model=Ugovor,
    status_code=201,
    dependencies=[Depends(require_scopes("leases:create"))],
)
async def create_ugovor(ugovor: UgovorCreate, request: Request):
    if not ugovor.property_unit_id:
        raise HTTPException(
            status_code=400, detail="Ugovor mora biti povezan s podprostorom"
        )

    jedinica = await _get_property_unit_or_404(ugovor.property_unit_id)
    if jedinica.nekretnina_id != ugovor.nekretnina_id:
        raise HTTPException(
            status_code=400, detail="Podprostor ne pripada odabranoj nekretnini"
        )
    if jedinica.ugovor_id:
        existing_contract_doc = await db.ugovori.find_one({"id": jedinica.ugovor_id})
        existing_status = None
        if existing_contract_doc:
            raw_status = existing_contract_doc.get("status")
            if isinstance(raw_status, StatusUgovora):
                existing_status = raw_status
            else:
                try:
                    existing_status = StatusUgovora(raw_status)
                except (TypeError, ValueError):
                    existing_status = None

        if existing_status in {StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU}:
            raise HTTPException(
                status_code=409,
                detail="Podprostor je već povezan s aktivnim ugovorom",
            )

    ugovor_dict = prepare_for_mongo(ugovor.model_dump())
    ugovor_obj = Ugovor(**ugovor_dict)

    # Kreiraj automatske podsjetnike
    await create_podsjetnici_za_ugovor(ugovor_obj)

    await db.ugovori.insert_one(prepare_for_mongo(ugovor_obj.model_dump()))

    unit_update: Dict[str, Any] = {
        "azuriran": datetime.now(timezone.utc),
    }

    if ugovor_obj.status in {StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU}:
        unit_update.update(
            {
                "status": PropertyUnitStatus.IZNAJMLJENO,
                "zakupnik_id": ugovor_obj.zakupnik_id,
                "ugovor_id": ugovor_obj.id,
            }
        )
    else:
        unit_update.update(
            {
                "status": PropertyUnitStatus.DOSTUPNO,
                "zakupnik_id": None,
                "ugovor_id": None,
            }
        )

    await db.property_units.update_one(
        {"id": jedinica.id}, {"$set": prepare_for_mongo(unit_update)}
    )

    request.state.audit_context = {"entity_type": "lease", "entity_id": ugovor_obj.id}
    return ugovor_obj


@api_router.get(
    "/ugovori",
    response_model=List[Ugovor],
    dependencies=[Depends(require_scopes("leases:read"))],
)
async def get_ugovori():
    ugovori = await db.ugovori.find().to_list(1000)
    rezultat: List[Ugovor] = []
    skipped = 0
    for raw in ugovori:
        try:
            rezultat.append(_build_ugovor_model(raw))
        except ValidationError:
            skipped += 1
    if skipped:
        logger.warning("Preskočeno %s ugovora zbog neispravnih podataka", skipped)
    return rezultat


@api_router.get(
    "/ugovori/{ugovor_id}",
    response_model=Ugovor,
    dependencies=[Depends(require_scopes("leases:read"))],
)
async def get_ugovor(ugovor_id: str):
    ugovor = await db.ugovori.find_one({"id": ugovor_id})
    if not ugovor:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
    try:
        return _build_ugovor_model(ugovor)
    except ValidationError as exc:
        logger.error("Ugovor %s se ne može učitati: %s", ugovor_id, exc)
        raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")


@api_router.put(
    "/ugovori/{ugovor_id}",
    response_model=Ugovor,
    dependencies=[Depends(require_scopes("leases:update"))],
)
async def update_ugovor(ugovor_id: str, ugovor_update: UgovorUpdate, request: Request):
    existing_doc = await db.ugovori.find_one({"id": ugovor_id})
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    if not ugovor_update.property_unit_id:
        raise HTTPException(
            status_code=400, detail="Ugovor mora biti povezan s podprostorom"
        )

    try:
        existing = _build_ugovor_model(existing_doc)
    except ValidationError as exc:
        logger.error("Postojeći ugovor %s nije valjan: %s", ugovor_id, exc)
        raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")

    previous_unit_id = existing.property_unit_id
    new_unit_id = ugovor_update.property_unit_id

    request.state.audit_context = {"entity_type": "lease", "entity_id": ugovor_id}

    new_unit: Optional[PropertyUnit] = None
    if new_unit_id:
        new_unit = await _get_property_unit_or_404(new_unit_id)
        if new_unit.nekretnina_id != ugovor_update.nekretnina_id:
            raise HTTPException(
                status_code=400, detail="Podprostor ne pripada odabranoj nekretnini"
            )
        if new_unit.ugovor_id and new_unit.ugovor_id != existing.id:
            existing_contract_doc = await db.ugovori.find_one(
                {"id": new_unit.ugovor_id}
            )
            existing_status = None
            if existing_contract_doc:
                raw_status = existing_contract_doc.get("status")
                if isinstance(raw_status, StatusUgovora):
                    existing_status = raw_status
                else:
                    try:
                        existing_status = StatusUgovora(raw_status)
                    except (TypeError, ValueError):
                        existing_status = None

            if existing_status in {StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU}:
                raise HTTPException(
                    status_code=409,
                    detail="Podprostor je već povezan s aktivnim ugovorom",
                )

    update_payload = ugovor_update.model_dump()
    update_payload["status"] = existing.status
    update_payload["kreiran"] = existing.kreiran

    await db.ugovori.update_one(
        {"id": ugovor_id}, {"$set": prepare_for_mongo(update_payload)}
    )

    if previous_unit_id and previous_unit_id != new_unit_id:
        await db.property_units.update_one(
            {"id": previous_unit_id},
            {
                "$set": prepare_for_mongo(
                    {
                        "status": PropertyUnitStatus.DOSTUPNO,
                        "zakupnik_id": None,
                        "ugovor_id": None,
                        "azuriran": datetime.now(timezone.utc),
                    }
                )
            },
        )

    if new_unit_id:
        target_status = existing.status
        unit_update: Dict[str, Any] = {
            "azuriran": datetime.now(timezone.utc),
        }
        if target_status in {StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU}:
            unit_update.update(
                {
                    "status": PropertyUnitStatus.IZNAJMLJENO,
                    "zakupnik_id": ugovor_update.zakupnik_id,
                    "ugovor_id": ugovor_id,
                }
            )
        else:
            unit_update.update(
                {
                    "status": PropertyUnitStatus.DOSTUPNO,
                    "zakupnik_id": None,
                    "ugovor_id": None,
                }
            )

        await db.property_units.update_one(
            {"id": new_unit_id},
            {"$set": prepare_for_mongo(unit_update)},
        )

    updated_doc = await db.ugovori.find_one({"id": ugovor_id})
    if not updated_doc:
        raise HTTPException(status_code=500, detail="Ažuriranje ugovora nije uspjelo")

    try:
        updated = _build_ugovor_model(updated_doc)
    except ValidationError as exc:
        logger.error(
            "Ugovor %s se ne može učitati nakon ažuriranja: %s", ugovor_id, exc
        )
        raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")

    await db.podsjetnici.delete_many({"ugovor_id": ugovor_id})
    await create_podsjetnici_za_ugovor(updated)

    return updated


class StatusUpdate(BaseModel):
    novi_status: StatusUgovora


@api_router.put(
    "/ugovori/{ugovor_id}/status",
    dependencies=[Depends(require_scopes("leases:update"))],
)
async def update_status_ugovora(
    ugovor_id: str, status_data: StatusUpdate, request: Request
):
    ugovor_doc = await db.ugovori.find_one({"id": ugovor_id})
    if not ugovor_doc:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    request.state.audit_context = {"entity_type": "lease", "entity_id": ugovor_id}

    await db.ugovori.update_one(
        {"id": ugovor_id}, {"$set": {"status": status_data.novi_status}}
    )

    property_unit_id = ugovor_doc.get("property_unit_id")
    if property_unit_id:
        await _get_property_unit_or_404(property_unit_id)
        nova_polja: Dict[str, Any] = {"azuriran": datetime.now(timezone.utc)}

        if status_data.novi_status in {StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU}:
            nova_polja.update(
                {
                    "status": PropertyUnitStatus.IZNAJMLJENO,
                    "zakupnik_id": ugovor_doc.get("zakupnik_id"),
                    "ugovor_id": ugovor_doc.get("id"),
                }
            )
        else:
            nova_polja.update(
                {
                    "status": PropertyUnitStatus.DOSTUPNO,
                    "zakupnik_id": None,
                    "ugovor_id": None,
                }
            )

        await db.property_units.update_one(
            {"id": property_unit_id}, {"$set": prepare_for_mongo(nova_polja)}
        )

    return {"poruka": f"Status ugovora ažuriran na {status_data.novi_status}"}


# Dokumenti
@api_router.post(
    "/dokumenti",
    response_model=Dokument,
    status_code=201,
    dependencies=[Depends(require_scopes("documents:create"))],
)
async def create_dokument(request: Request):
    content_type = request.headers.get("content-type", "")
    upload_file: Optional[UploadFile] = None

    try:
        if "application/json" in content_type:
            payload = await request.json()
            dokument_input = DokumentCreate(**payload)
        else:
            form = await request.form()
            upload_file = form.get("file")
            field_values = {
                "naziv": form.get("naziv"),
                "tip": form.get("tip"),
                "opis": form.get("opis") or None,
                "nekretnina_id": form.get("nekretnina_id"),
                "zakupnik_id": form.get("zakupnik_id"),
                "ugovor_id": form.get("ugovor_id"),
                "property_unit_id": form.get("property_unit_id"),
            }

            for key in (
                "nekretnina_id",
                "zakupnik_id",
                "ugovor_id",
                "property_unit_id",
            ):
                if not field_values[key] or field_values[key] == "none":
                    field_values[key] = None

            if not field_values["naziv"] or not field_values["tip"]:
                raise HTTPException(
                    status_code=400, detail="Naziv i tip dokumenta su obavezni"
                )

            dokument_input = DokumentCreate(**field_values)

    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    file_path = ""
    file_size = 0

    if upload_file and getattr(upload_file, "filename", ""):
        filename = Path(upload_file.filename).name
        if not filename.lower().endswith(".pdf") or (
            upload_file.content_type and "pdf" not in upload_file.content_type
        ):
            raise HTTPException(status_code=400, detail="Datoteka mora biti PDF format")

        file_bytes = await upload_file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="PDF datoteka je prazna")

        safe_name = f"{uuid.uuid4()}_{filename}"
        destination = UPLOAD_DIR / safe_name

        with destination.open("wb") as buffer:
            buffer.write(file_bytes)

        file_path = f"uploads/{safe_name}"
        file_size = len(file_bytes)

    dokument_payload = dokument_input.model_dump()

    if dokument_payload.get("property_unit_id"):
        jedinica = await _get_property_unit_or_404(dokument_payload["property_unit_id"])
        if (
            dokument_payload.get("nekretnina_id")
            and dokument_payload["nekretnina_id"] != jedinica.nekretnina_id
        ):
            raise HTTPException(
                status_code=400, detail="Podprostor ne pripada odabranoj nekretnini"
            )
        dokument_payload["nekretnina_id"] = jedinica.nekretnina_id
        if not dokument_payload.get("zakupnik_id") and jedinica.zakupnik_id:
            dokument_payload["zakupnik_id"] = jedinica.zakupnik_id
        if not dokument_payload.get("ugovor_id") and jedinica.ugovor_id:
            dokument_payload["ugovor_id"] = jedinica.ugovor_id

    dokument_dict = prepare_for_mongo(dokument_payload)
    dokument_obj = Dokument(
        **dokument_dict, putanja_datoteke=file_path, velicina_datoteke=file_size
    )
    await db.dokumenti.insert_one(prepare_for_mongo(dokument_obj.model_dump()))
    request.state.audit_context = {
        "entity_type": "document",
        "entity_id": dokument_obj.id,
    }
    return dokument_obj


@api_router.get(
    "/dokumenti",
    response_model=List[Dokument],
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_dokumenti():
    dokumenti = await db.dokumenti.find().to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]


@api_router.get(
    "/dokumenti/nekretnina/{nekretnina_id}",
    response_model=List[Dokument],
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_dokumenti_nekretnine(nekretnina_id: str):
    await _get_property_or_404(nekretnina_id)
    jedinice = await db.property_units.find({"nekretnina_id": nekretnina_id}).to_list(
        1000
    )
    jedinica_ids = {j.get("id") for j in jedinice if j.get("id")}

    dokumenti_raw = await db.dokumenti.find().to_list(1000)
    rezultat: List[Dokument] = []
    for dokument in dokumenti_raw:
        parsed = Dokument(**parse_from_mongo(dokument))
        if parsed.nekretnina_id == nekretnina_id or (
            parsed.property_unit_id and parsed.property_unit_id in jedinica_ids
        ):
            rezultat.append(parsed)

    return rezultat


@api_router.get(
    "/dokumenti/zakupnik/{zakupnik_id}",
    response_model=List[Dokument],
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_dokumenti_zakupnika(zakupnik_id: str):
    dokumenti = await db.dokumenti.find({"zakupnik_id": zakupnik_id}).to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]


@api_router.get(
    "/dokumenti/ugovor/{ugovor_id}",
    response_model=List[Dokument],
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_dokumenti_ugovora(ugovor_id: str):
    dokumenti = await db.dokumenti.find({"ugovor_id": ugovor_id}).to_list(1000)
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]


@api_router.get(
    "/dokumenti/property-unit/{property_unit_id}",
    response_model=List[Dokument],
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_dokumenti_property_unit(property_unit_id: str):
    await _get_property_unit_or_404(property_unit_id)
    dokumenti = await db.dokumenti.find({"property_unit_id": property_unit_id}).to_list(
        1000
    )
    return [Dokument(**parse_from_mongo(d)) for d in dokumenti]


# Računi (utility bills)


def _enrich_racun_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    if "iznos_za_platiti" in data and data["iznos_za_platiti"] is None:
        data["iznos_za_platiti"] = 0.0
    if "valuta" not in data or not data["valuta"]:
        data["valuta"] = "EUR"
    if "status" not in data or data["status"] is None:
        data["status"] = BillStatus.DUE
    return data


@api_router.post(
    "/racuni",
    response_model=Racun,
    status_code=201,
    dependencies=[Depends(require_scopes("financials:create"))],
)
async def create_racun(racun: RacunCreate, request: Request):
    racun_payload = racun.model_dump()

    if racun_payload.get("property_unit_id"):
        jedinica = await _get_property_unit_or_404(racun_payload["property_unit_id"])
        if (
            racun_payload.get("nekretnina_id")
            and racun_payload["nekretnina_id"] != jedinica.nekretnina_id
        ):
            raise HTTPException(
                status_code=400, detail="Podprostor ne pripada odabranoj nekretnini"
            )
        racun_payload["nekretnina_id"] = jedinica.nekretnina_id
        if not racun_payload.get("ugovor_id") and jedinica.ugovor_id:
            racun_payload["ugovor_id"] = jedinica.ugovor_id

    racun_dict = _enrich_racun_payload(racun_payload)
    racun_obj = Racun(**racun_dict)
    await db.racuni.insert_one(prepare_for_mongo(racun_obj.model_dump()))

    changes = diff_dict({}, racun_obj.model_dump(mode="json"), ignore={"id"})
    set_audit_context(
        request,
        entity_type="invoice",
        entity_id=racun_obj.id,
        parent_id=racun_obj.nekretnina_id,
        changes=changes or {"created": {"before": None, "after": True}},
    )

    return racun_obj


@api_router.get(
    "/racuni",
    response_model=List[Racun],
    dependencies=[Depends(require_scopes("financials:read"))],
)
async def list_racuni(
    nekretnina_id: Optional[str] = None,
    ugovor_id: Optional[str] = None,
    property_unit_id: Optional[str] = None,
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
    if property_unit_id:
        racuni = [r for r in racuni if r.property_unit_id == property_unit_id]
    if status:
        racuni = [r for r in racuni if r.status == status]
    if tip_rezije:
        racuni = [r for r in racuni if r.tip_rezije == tip_rezije]
    if overdue:
        today = datetime.now(timezone.utc).date()
        racuni = [
            r
            for r in racuni
            if r.status in {BillStatus.DUE, BillStatus.DISPUTED, BillStatus.PARTIAL}
            and r.datum_dospijeca
            and r.datum_dospijeca < today
        ]

    return racuni


@api_router.get(
    "/racuni/{racun_id}",
    response_model=Racun,
    dependencies=[Depends(require_scopes("financials:read"))],
)
async def get_racun(racun_id: str):
    racun = await db.racuni.find_one({"id": racun_id})
    if not racun:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")
    return Racun(**parse_from_mongo(racun))


@api_router.put(
    "/racuni/{racun_id}",
    response_model=Racun,
    dependencies=[Depends(require_scopes("financials:update"))],
)
async def update_racun(racun_id: str, racun_update: RacunUpdate, request: Request):
    existing_doc = await db.racuni.find_one({"id": racun_id})
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    postojece = Racun(**parse_from_mongo(existing_doc))

    update_data = {k: v for k, v in racun_update.dict(exclude_unset=True).items()}
    if not update_data:
        return postojece

    if "property_unit_id" in update_data:
        if update_data["property_unit_id"]:
            jedinica = await _get_property_unit_or_404(update_data["property_unit_id"])
            if (
                update_data.get("nekretnina_id")
                and update_data["nekretnina_id"] != jedinica.nekretnina_id
            ):
                raise HTTPException(
                    status_code=400, detail="Podprostor ne pripada odabranoj nekretnini"
                )
            update_data["nekretnina_id"] = jedinica.nekretnina_id
            if "ugovor_id" not in update_data and jedinica.ugovor_id:
                update_data["ugovor_id"] = jedinica.ugovor_id
        else:
            update_data["property_unit_id"] = None

    _enrich_racun_payload(update_data)
    result = await db.racuni.update_one(
        {"id": racun_id}, {"$set": prepare_for_mongo(update_data)}
    )
    if getattr(result, "matched_count", 0) == 0:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    updated = await db.racuni.find_one({"id": racun_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    racun_obj = Racun(**parse_from_mongo(updated))

    changes = diff_dict(
        postojece.model_dump(mode="json"),
        racun_obj.model_dump(mode="json"),
        ignore={"id", "kreiran"},
    )
    if changes:
        set_audit_context(
            request,
            entity_type="invoice",
            entity_id=racun_obj.id,
            parent_id=racun_obj.nekretnina_id,
            changes=changes,
        )

    return racun_obj


@api_router.delete(
    "/racuni/{racun_id}",
    dependencies=[Depends(require_scopes("financials:delete"))],
)
async def delete_racun(racun_id: str, request: Request):
    existing_doc = await db.racuni.find_one({"id": racun_id})
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    result = await db.racuni.delete_one({"id": racun_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Račun nije pronađen")

    postojece = Racun(**parse_from_mongo(existing_doc))
    deleted_changes = diff_dict(postojece.model_dump(mode="json"), {}, ignore={"id"})
    set_audit_context(
        request,
        entity_type="invoice",
        entity_id=racun_id,
        parent_id=postojece.nekretnina_id,
        changes=deleted_changes or {"deleted": {"before": True, "after": None}},
    )

    return {"poruka": "Račun je uspješno obrisan"}


@api_router.get(
    "/activity-logs",
    response_model=List[ActivityLog],
    dependencies=[Depends(require_scopes("reports:read"))],
)
async def get_activity_logs(limit: int = 100):
    raw_logs = await db.activity_logs.find().to_list(limit)
    logs = [ActivityLog(**parse_from_mongo(log)) for log in raw_logs]
    logs.sort(key=lambda item: item.timestamp, reverse=True)
    return logs[:limit]


# Podsjećanja
@api_router.get(
    "/podsjetnici",
    response_model=List[Podsjetnik],
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def get_podsjetnici():
    podsjetnici = await db.podsjetnici.find().to_list(1000)
    return [Podsjetnik(**parse_from_mongo(p)) for p in podsjetnici]


@api_router.get(
    "/podsjetnici/aktivni",
    response_model=List[Podsjetnik],
    dependencies=[Depends(require_scopes("properties:read"))],
)
async def get_aktivni_podsjetnici():
    danas = datetime.now(timezone.utc).date()
    podsjetnici = await db.podsjetnici.find(
        {"datum_podsjetnika": {"$lte": danas.isoformat()}, "poslan": False}
    ).to_list(1000)
    return [Podsjetnik(**parse_from_mongo(p)) for p in podsjetnici]


@api_router.put(
    "/podsjetnici/{podsjetnik_id}/oznaci-poslan",
    dependencies=[Depends(require_scopes("properties:update"))],
)
async def oznaci_podsjetnik_poslan(podsjetnik_id: str):
    result = await db.podsjetnici.update_one(
        {"id": podsjetnik_id}, {"$set": {"poslan": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Podsjetnik nije pronađen")
    return {"poruka": "Podsjetnik je označen kao riješen"}


@api_router.get(
    "/audit/logs",
    response_model=List[ActivityLog],
    dependencies=[Depends(require_scopes("reports:read"))],
)
async def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    path: Optional[str] = None,
    limit: int = 100,
):
    limit = max(1, min(limit, 500))
    query: Dict[str, Any] = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if parent_id:
        query["entity_parent_id"] = parent_id
    if path:
        query["path"] = {"$regex": re.escape(path), "$options": "i"}

    cursor = db.activity_logs.find(query) if query else db.activity_logs.find()

    if hasattr(cursor, "sort"):
        cursor = cursor.sort("timestamp", -1)
    raw_logs = await cursor.to_list(limit)
    raw_logs.sort(key=lambda entry: entry.get("timestamp", ""), reverse=True)

    rezultat: List[ActivityLog] = []
    for raw in raw_logs:
        try:
            rezultat.append(ActivityLog(**parse_from_mongo(raw)))
        except ValidationError:
            continue
    return rezultat


# Maintenance tasks (radni nalozi)
@api_router.get(
    "/maintenance-tasks",
    response_model=List[MaintenanceTask],
    dependencies=[Depends(require_scopes("maintenance:read"))],
)
async def list_maintenance_tasks(
    status: Optional[MaintenanceStatus] = None,
    prioritet: Optional[MaintenancePriority] = None,
    nekretnina_id: Optional[str] = None,
    rok_od: Optional[date] = None,
    rok_do: Optional[date] = None,
    oznaka: Optional[str] = None,
    q: Optional[str] = None,
):
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status.value if isinstance(status, Enum) else status
    if prioritet:
        query["prioritet"] = (
            prioritet.value if isinstance(prioritet, Enum) else prioritet
        )
    if nekretnina_id:
        query["nekretnina_id"] = nekretnina_id

    cursor = db.maintenance_tasks.find(query or None)
    raw_tasks = (
        await cursor.to_list(1000) if hasattr(cursor, "to_list") else list(cursor)
    )
    tasks = [MaintenanceTask(**parse_from_mongo(task)) for task in raw_tasks]

    if rok_od:
        tasks = [task for task in tasks if task.rok and task.rok >= rok_od]
    if rok_do:
        tasks = [task for task in tasks if task.rok and task.rok <= rok_do]
    if oznaka:
        needle = oznaka.strip().lower()
        if needle:
            tasks = [
                task
                for task in tasks
                if any(needle in (label or "").lower() for label in task.oznake)
            ]
    if q:
        needle = q.strip().lower()
        if needle:
            tasks = [
                task
                for task in tasks
                if needle in (task.naziv or "").lower()
                or needle in (task.opis or "").lower()
                or any(needle in (label or "").lower() for label in task.oznake)
            ]

    tasks.sort(key=lambda t: (t.azuriran, t.kreiran), reverse=True)
    return tasks


@api_router.get(
    "/maintenance-tasks/{task_id}",
    response_model=MaintenanceTask,
    dependencies=[Depends(require_scopes("maintenance:read"))],
)
async def get_maintenance_task(task_id: str):
    return await _get_task_or_404(task_id)


@api_router.post(
    "/maintenance-tasks",
    response_model=MaintenanceTask,
    status_code=201,
    dependencies=[Depends(require_scopes("maintenance:create"))],
)
async def create_maintenance_task(payload: MaintenanceTaskCreate, request: Request):
    data = payload.model_dump()
    labels = _normalise_labels(data.pop("oznake", []))

    property_id = data.get("nekretnina_id")
    unit_id = data.get("property_unit_id")
    contract_id = data.get("ugovor_id")

    if property_id:
        await _get_property_or_404(property_id)

    if unit_id:
        unit = await _get_property_unit_or_404(unit_id)
        if property_id and unit.nekretnina_id != property_id:
            raise HTTPException(
                status_code=400, detail="Odabrani podprostor pripada drugoj nekretnini"
            )
        data.setdefault("nekretnina_id", unit.nekretnina_id)

    if contract_id:
        ugovor_doc = await db.ugovori.find_one({"id": contract_id})
        if not ugovor_doc:
            raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
        try:
            ugovor = _build_ugovor_model(ugovor_doc)
        except ValidationError as exc:
            logger.error(
                "Ugovor %s nije moguće validirati tijekom kreiranja naloga za održavanje: %s",
                contract_id,
                exc,
            )
            raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")
        if property_id and ugovor.nekretnina_id != property_id:
            raise HTTPException(
                status_code=400, detail="Ugovor je vezan uz drugu nekretninu"
            )
        if not data.get("nekretnina_id"):
            data["nekretnina_id"] = ugovor.nekretnina_id
        if not data.get("property_unit_id") and ugovor.property_unit_id:
            data["property_unit_id"] = ugovor.property_unit_id

    assignee_id = data.pop("dodijeljeno_user_id", None)
    if assignee_id:
        assignee = await _get_user_or_404(assignee_id)
        if assignee.role not in ALLOWED_MAINTENANCE_ASSIGN_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Voditelj naloga mora biti Property Manager ili Owner Exec",
            )
        data["dodijeljeno_user_id"] = assignee.id
        data["dodijeljeno"] = assignee.full_name or assignee.email
    else:
        assignee_label = (data.get("dodijeljeno") or "").strip()
        if not assignee_label:
            data["dodijeljeno"] = None
        else:
            data["dodijeljeno"] = assignee_label

    data["oznake"] = labels
    task = MaintenanceTask(**data)
    initial_activity = MaintenanceActivity(
        tip="kreiran",
        opis=f"Radni nalog '{task.naziv}' kreiran",
        autor=task.prijavio,
        status=task.status,
        timestamp=task.kreiran,
    )
    task.aktivnosti.append(initial_activity)
    task.azuriran = task.kreiran
    if task.status in {MaintenanceStatus.ZAVRSENO, MaintenanceStatus.ARHIVIRANO}:
        task.zavrseno_na = task.kreiran
    await db.maintenance_tasks.insert_one(prepare_for_mongo(task.model_dump()))
    request.state.audit_context = {"entity_type": "maintenance", "entity_id": task.id}
    return Response(status_code=201)


@api_router.patch(
    "/maintenance-tasks/{task_id}",
    response_model=MaintenanceTask,
    dependencies=[Depends(require_scopes("maintenance:update"))],
)
async def update_maintenance_task(
    task_id: str, payload: MaintenanceTaskUpdate, request: Request
):
    task = await _get_task_or_404(task_id)
    update_data = payload.model_dump(exclude_unset=True)
    request.state.audit_context = {"entity_type": "maintenance", "entity_id": task_id}

    if "oznake" in update_data and update_data["oznake"] is not None:
        update_data["oznake"] = _normalise_labels(update_data["oznake"])

    if "nekretnina_id" in update_data and update_data["nekretnina_id"]:
        await _get_property_or_404(update_data["nekretnina_id"])

    if "property_unit_id" in update_data and update_data["property_unit_id"]:
        unit = await _get_property_unit_or_404(update_data["property_unit_id"])
        target_property_id = update_data.get("nekretnina_id", task.nekretnina_id)
        if target_property_id and unit.nekretnina_id != target_property_id:
            raise HTTPException(
                status_code=400, detail="Odabrani podprostor pripada drugoj nekretnini"
            )
        update_data.setdefault("nekretnina_id", unit.nekretnina_id)

    if "ugovor_id" in update_data and update_data["ugovor_id"]:
        ugovor_doc = await db.ugovori.find_one({"id": update_data["ugovor_id"]})
        if not ugovor_doc:
            raise HTTPException(status_code=404, detail="Ugovor nije pronađen")
        try:
            ugovor = _build_ugovor_model(ugovor_doc)
        except ValidationError as exc:
            logger.error(
                "Ugovor %s nije moguće validirati tijekom ažuriranja naloga za održavanje: %s",
                update_data["ugovor_id"],
                exc,
            )
            raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")
        target_property_id = update_data.get("nekretnina_id", task.nekretnina_id)
        if target_property_id and ugovor.nekretnina_id != target_property_id:
            raise HTTPException(
                status_code=400, detail="Ugovor je vezan uz drugu nekretninu"
            )
        if not update_data.get("nekretnina_id"):
            update_data["nekretnina_id"] = ugovor.nekretnina_id
        if not update_data.get("property_unit_id") and ugovor.property_unit_id:
            update_data["property_unit_id"] = ugovor.property_unit_id

    if "dodijeljeno_user_id" in update_data:
        assignee_id = update_data["dodijeljeno_user_id"]
        if not assignee_id:
            raise HTTPException(status_code=400, detail="Voditelj naloga je obavezan")
        assignee = await _get_user_or_404(assignee_id)
        if assignee.role not in ALLOWED_MAINTENANCE_ASSIGN_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Voditelj naloga mora biti Property Manager ili Owner Exec",
            )
        update_data["dodijeljeno_user_id"] = assignee.id
        update_data["dodijeljeno"] = assignee.full_name or assignee.email

    original_data = task.model_dump()
    merged = copy.deepcopy(original_data)
    merged.update(update_data)

    activities = list(original_data.get("aktivnosti", []))

    changed_fields: List[str] = []
    for key, value in update_data.items():
        if key == "aktivnosti":
            continue
        current_value = original_data.get(key)
        comparable_current = (
            current_value.value if isinstance(current_value, Enum) else current_value
        )
        comparable_new = value.value if isinstance(value, Enum) else value
        if comparable_new != comparable_current:
            changed_fields.append(key)

    status_changed = "status" in changed_fields
    if status_changed:
        changed_fields.remove("status")
        new_status_raw = merged.get("status")
        new_status = (
            new_status_raw
            if isinstance(new_status_raw, MaintenanceStatus)
            else MaintenanceStatus(new_status_raw)
        )
        activities.append(
            MaintenanceActivity(
                tip="promjena_statusa",
                opis=f"Status promijenjen iz {task.status.value} u {new_status.value}",
                status=new_status,
                timestamp=datetime.now(timezone.utc),
            ).model_dump()
        )
        merged["status"] = new_status
        if new_status in {MaintenanceStatus.ZAVRSENO, MaintenanceStatus.ARHIVIRANO}:
            merged["zavrseno_na"] = datetime.now(timezone.utc)
        else:
            merged["zavrseno_na"] = None

    if changed_fields:
        fields_label = ", ".join(field.replace("_", " ") for field in changed_fields)
        activities.append(
            MaintenanceActivity(
                tip="uredjeno",
                opis=f"Ažurirana polja: {fields_label}",
                timestamp=datetime.now(timezone.utc),
            ).model_dump()
        )

    merged["aktivnosti"] = activities
    merged["azuriran"] = datetime.now(timezone.utc)
    updated = MaintenanceTask(**merged)
    await db.maintenance_tasks.update_one(
        {"id": task_id}, {"$set": prepare_for_mongo(updated.model_dump())}
    )
    return updated


@api_router.post(
    "/maintenance-tasks/{task_id}/comments",
    response_model=MaintenanceTask,
    dependencies=[Depends(require_scopes("maintenance:update"))],
)
async def add_maintenance_comment(
    task_id: str, payload: MaintenanceCommentCreate, request: Request
):
    task = await _get_task_or_404(task_id)
    message = (payload.poruka or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Komentar je prazan")
    author = (payload.autor or "").strip() or None

    merged = task.model_dump()
    activities = list(merged.get("aktivnosti", []))
    activities.append(
        MaintenanceActivity(
            tip="komentar",
            opis=message,
            autor=author,
            timestamp=datetime.now(timezone.utc),
        ).model_dump()
    )

    merged["aktivnosti"] = activities
    merged["azuriran"] = datetime.now(timezone.utc)
    updated = MaintenanceTask(**merged)
    await db.maintenance_tasks.update_one(
        {"id": task_id}, {"$set": prepare_for_mongo(updated.model_dump())}
    )
    request.state.audit_context = {"entity_type": "maintenance", "entity_id": task_id}
    return updated


@api_router.delete(
    "/maintenance-tasks/{task_id}",
    dependencies=[Depends(require_scopes("maintenance:delete"))],
)
async def delete_maintenance_task(task_id: str, request: Request):
    task = await _get_task_or_404(task_id)
    await db.maintenance_tasks.delete_one({"id": task.id})
    request.state.audit_context = {"entity_type": "maintenance", "entity_id": task_id}
    return {"poruka": "Radni nalog je obrisan"}


# Dashboard i analitika
@api_router.get("/dashboard", dependencies=[Depends(require_scopes("kpi:read"))])
async def get_dashboard():
    ukupno_nekretnina = await db.nekretnine.count_documents({})
    aktivni_ugovori = await db.ugovori.count_documents(
        {"status": StatusUgovora.AKTIVNO}
    )
    aktivni_podsjetnici = await db.podsjetnici.count_documents({"poslan": False})

    # Preuzmi entitete za detaljniju analitiku
    nekretnine_docs = await db.nekretnine.find({}).to_list(None)
    ugovori_docs = await db.ugovori.find({}).to_list(None)
    racuni_docs = await db.racuni.find({}).to_list(None)
    property_units_docs = await db.property_units.find({}).to_list(None)

    nekretnine = [Nekretnina(**parse_from_mongo(doc)) for doc in nekretnine_docs]
    ugovori = _build_ugovori_list(ugovori_docs)
    today = datetime.now(timezone.utc).date()
    window = today + timedelta(days=90)
    ugovori_na_isteku = sum(
        1
        for ugovor in ugovori
        if ugovor.status == StatusUgovora.AKTIVNO
        and ugovor.datum_zavrsetka
        and today < ugovor.datum_zavrsetka <= window
    )
    racuni = [Racun(**parse_from_mongo(doc)) for doc in racuni_docs]
    property_units = [
        PropertyUnit(**parse_from_mongo(doc)) for doc in property_units_docs
    ]

    property_map = {nekretnina.id: nekretnina for nekretnina in nekretnine}
    units_by_property: Dict[str, List[PropertyUnit]] = {}
    for unit in property_units:
        units_by_property.setdefault(unit.nekretnina_id, []).append(unit)

    # Helper funkcije za rad s mjesecima
    def month_sequence(count: int) -> list[tuple[int, int]]:
        today = datetime.now(timezone.utc)
        year = today.year
        month = today.month
        months: list[tuple[int, int]] = []
        for _ in range(count):
            months.append((year, month))
            month -= 1
            if month == 0:
                month = 12
                year -= 1
        months.reverse()
        return months

    def month_bounds(year: int, month: int) -> tuple[date, date]:
        start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end = date(year, month, last_day)
        return start, end

    months = month_sequence(12)

    monthly_revenue = []
    monthly_expense = []
    revenue_statuses = {StatusUgovora.AKTIVNO, StatusUgovora.NA_ISTEKU}

    for year, month in months:
        start, end = month_bounds(year, month)

        # Prihodi - zbroj aktivnih ugovora u tom mjesecu
        revenue_total = 0.0
        for ugovor in ugovori:
            if ugovor.status not in revenue_statuses:
                continue
            if ugovor.datum_pocetka <= end and ugovor.datum_zavrsetka >= start:
                revenue_total += float(ugovor.osnovna_zakupnina or 0)

        # Rashodi - zbroj računa u tom mjesecu (po datumu dospijeća ili izdavanja)
        expense_total = 0.0
        for racun in racuni:
            racun_date = (
                racun.datum_dospijeca or racun.datum_izdavanja or racun.razdoblje_do
            )
            if racun_date and racun_date.year == year and racun_date.month == month:
                if racun.status != BillStatus.DRAFT:
                    expense_total += float(racun.iznos_za_platiti or 0)

        monthly_revenue.append(
            {
                "month": f"{year}-{month:02d}",
                "value": round(revenue_total, 2),
            }
        )
        monthly_expense.append(
            {
                "month": f"{year}-{month:02d}",
                "value": round(expense_total, 2),
            }
        )

    # Izračunaj trenutni mjesečni prihod iz posljednjeg mjeseca
    mjesecni_prihod = monthly_revenue[-1]["value"] if monthly_revenue else 0

    # Ukupna vrijednost portfelja i godišnji prinos
    ukupna_vrijednost_portfelja = sum(
        float(n.trzisna_vrijednost or 0) for n in nekretnine
    )
    godisnji_prinos = mjesecni_prihod * 12 if mjesecni_prihod else 0
    prinos_postotak = (
        (godisnji_prinos / ukupna_vrijednost_portfelja * 100)
        if ukupna_vrijednost_portfelja
        else 0
    )

    # Raspodjela po vrsti nekretnine
    portfolio_breakdown: dict[str, dict[str, Any]] = {}
    contracts_by_property: dict[str, list[Ugovor]] = {}
    for ugovor in ugovori:
        contracts_by_property.setdefault(ugovor.nekretnina_id, []).append(ugovor)

    for nekretnina in nekretnine:
        key = (
            nekretnina.vrsta.value
            if isinstance(nekretnina.vrsta, Enum)
            else str(nekretnina.vrsta)
        )
        stats = portfolio_breakdown.setdefault(
            key,
            {
                "count": 0,
                "total_area": 0.0,
                "total_value": 0.0,
                "gross_income": 0.0,
                "operating_expense": 0.0,
                "net_income": 0.0,
                "occupancy_samples": [],
            },
        )

        stats["count"] += 1
        stats["total_area"] += float(nekretnina.povrsina or 0)
        stats["total_value"] += float(nekretnina.trzisna_vrijednost or 0)
        stats["gross_income"] += float(nekretnina.prosllogodisnji_prihodi or 0)
        stats["operating_expense"] += float(nekretnina.prosllogodisnji_rashodi or 0)
        stats["net_income"] += float(nekretnina.proslogodisnji_neto_prihod or 0)

        property_contracts = contracts_by_property.get(nekretnina.id, [])
        units_for_property = units_by_property.get(nekretnina.id, [])

        occupancy: Optional[float] = None
        if units_for_property:
            ukupno = len(units_for_property)
            if ukupno:
                zauzeto = sum(
                    1
                    for unit in units_for_property
                    if unit.status == PropertyUnitStatus.IZNAJMLJENO
                )
                occupancy = (zauzeto / ukupno) * 100
        elif property_contracts:
            active = sum(
                1
                for contract in property_contracts
                if contract.status == StatusUgovora.AKTIVNO
            )
            occupancy = (
                (active / len(property_contracts)) * 100 if property_contracts else 0
            )

        if occupancy is not None:
            stats["occupancy_samples"].append(occupancy)

    portfolio_by_type = []
    for vrsta, stats in portfolio_breakdown.items():
        occupancy_avg = (
            sum(stats["occupancy_samples"]) / len(stats["occupancy_samples"])
            if stats["occupancy_samples"]
            else None
        )
        portfolio_by_type.append(
            {
                "type": vrsta,
                "count": stats["count"],
                "total_area": round(stats["total_area"], 2),
                "total_value": round(stats["total_value"], 2),
                "gross_income": round(stats["gross_income"], 2),
                "operating_expense": round(stats["operating_expense"], 2),
                "net_income": round(stats["net_income"], 2),
                "average_occupancy": (
                    round(occupancy_avg, 2) if occupancy_avg is not None else None
                ),
            }
        )

    net_series = []
    for revenue_point, expense_point in zip(monthly_revenue, monthly_expense):
        net_series.append(
            {
                "month": revenue_point["month"],
                "value": round(revenue_point["value"] - expense_point["value"], 2),
            }
        )

    total_units = len(property_units)
    leased_units = sum(
        1 for unit in property_units if unit.status == PropertyUnitStatus.IZNAJMLJENO
    )
    reserved_units = sum(
        1 for unit in property_units if unit.status == PropertyUnitStatus.REZERVIRANO
    )
    available_units = sum(
        1 for unit in property_units if unit.status == PropertyUnitStatus.DOSTUPNO
    )
    maintenance_units = sum(
        1 for unit in property_units if unit.status == PropertyUnitStatus.U_ODRZAVANJU
    )
    occupancy_rate = (leased_units / total_units * 100) if total_units else None

    capacity_by_property = []
    for property_id, units in units_by_property.items():
        total = len(units)
        if total == 0:
            continue
        leased = sum(
            1 for unit in units if unit.status == PropertyUnitStatus.IZNAJMLJENO
        )
        reserved = sum(
            1 for unit in units if unit.status == PropertyUnitStatus.REZERVIRANO
        )
        available = sum(
            1 for unit in units if unit.status == PropertyUnitStatus.DOSTUPNO
        )
        maintenance = sum(
            1 for unit in units if unit.status == PropertyUnitStatus.U_ODRZAVANJU
        )
        occupancy_local = (leased / total * 100) if total else None
        nekretnina = property_map.get(property_id)
        capacity_by_property.append(
            {
                "nekretnina_id": property_id,
                "naziv": getattr(nekretnina, "naziv", None),
                "ukupno": total,
                "iznajmljeno": leased,
                "rezervirano": reserved,
                "dostupno": available,
                "u_odrzavanju": maintenance,
                "popunjenost": (
                    round(occupancy_local, 2) if occupancy_local is not None else None
                ),
            }
        )

    capacity_by_property.sort(key=lambda item: (item["popunjenost"] or 0), reverse=True)

    top_vacant_units = [
        {
            "id": unit.id,
            "oznaka": unit.oznaka,
            "naziv": unit.naziv,
            "povrsina_m2": unit.povrsina_m2,
            "osnovna_zakupnina": unit.osnovna_zakupnina,
            "nekretnina_id": unit.nekretnina_id,
            "nekretnina_naziv": getattr(
                property_map.get(unit.nekretnina_id), "naziv", None
            ),
        }
        for unit in sorted(
            (u for u in property_units if u.status == PropertyUnitStatus.DOSTUPNO),
            key=lambda u: (u.osnovna_zakupnina or 0, u.povrsina_m2 or 0),
            reverse=True,
        )
    ][:5]

    pipeline_units = [
        {
            "id": unit.id,
            "oznaka": unit.oznaka,
            "naziv": unit.naziv,
            "nekretnina_id": unit.nekretnina_id,
            "nekretnina_naziv": getattr(
                property_map.get(unit.nekretnina_id), "naziv", None
            ),
            "osnovna_zakupnina": unit.osnovna_zakupnina,
        }
        for unit in property_units
        if unit.status == PropertyUnitStatus.REZERVIRANO
    ]

    maintenance_docs = await db.maintenance_tasks.find().to_list(1000)
    maintenance_items = [
        MaintenanceTask(**parse_from_mongo(doc)) for doc in maintenance_docs
    ]
    open_maintenance = [
        task
        for task in maintenance_items
        if task.status not in {MaintenanceStatus.ZAVRSENO, MaintenanceStatus.ARHIVIRANO}
    ]
    overdue_maintenance = [
        task
        for task in maintenance_items
        if task.rok
        and task.status
        not in {MaintenanceStatus.ZAVRSENO, MaintenanceStatus.ARHIVIRANO}
        and task.rok < datetime.now(timezone.utc).date()
    ]
    resolution_hours: List[float] = []
    sla_breaches = 0
    for task in maintenance_items:
        if task.status in {MaintenanceStatus.ZAVRSENO, MaintenanceStatus.ARHIVIRANO}:
            finish_time = task.zavrseno_na or task.azuriran
            delta = (finish_time - task.kreiran).total_seconds() / 3600
            if delta >= 0:
                resolution_hours.append(delta)
            if task.rok and finish_time.date() > task.rok:
                sla_breaches += 1
    avg_resolution = (
        round(sum(resolution_hours) / len(resolution_hours), 2)
        if resolution_hours
        else None
    )
    estimated_cost_total = round(
        sum(task.procijenjeni_trosak or 0 for task in maintenance_items), 2
    )
    actual_cost_total = round(
        sum(task.stvarni_trosak or 0 for task in maintenance_items), 2
    )

    najamni_kapacitet = {
        "total_units": total_units,
        "occupied_units": leased_units,
        "reserved_units": reserved_units,
        "available_units": available_units,
        "maintenance_units": maintenance_units,
        "occupancy_rate": (
            round(occupancy_rate, 2) if occupancy_rate is not None else None
        ),
        "by_property": capacity_by_property,
        "top_vacant_units": top_vacant_units,
        "pipeline_units": pipeline_units,
    }

    return {
        "ukupno_nekretnina": ukupno_nekretnina,
        "aktivni_ugovori": aktivni_ugovori,
        "ugovori_na_isteku": ugovori_na_isteku,
        "aktivni_podsjetnici": aktivni_podsjetnici,
        "mjesecni_prihod": mjesecni_prihod,
        "ukupna_vrijednost_portfelja": round(ukupna_vrijednost_portfelja, 2),
        "godisnji_prinos": round(godisnji_prinos, 2),
        "prinos_postotak": round(prinos_postotak, 2),
        "series": {
            "monthly_revenue": monthly_revenue,
            "monthly_expense": monthly_expense,
            "monthly_net": net_series,
        },
        "portfolio_breakdown": portfolio_by_type,
        "najamni_kapacitet": najamni_kapacitet,
        "maintenance_kpi": {
            "open_workorders": len(open_maintenance),
            "overdue_workorders": len(overdue_maintenance),
            "avg_resolution_hours": avg_resolution,
            "sla_breaches": sla_breaches,
            "estimated_cost_total": estimated_cost_total,
            "actual_cost_total": actual_cost_total,
        },
    }


@api_router.get(
    "/pretraga",
    dependencies=[
        Depends(require_scopes("properties:read", "tenants:read", "leases:read"))
    ],
)
async def pretraga(q: str):
    # Pretraži po svim relevantnim poljima
    nekretnine = await db.nekretnine.find(
        {
            "$or": [
                {"naziv": {"$regex": q, "$options": "i"}},
                {"adresa": {"$regex": q, "$options": "i"}},
                {"katastarska_opcina": {"$regex": q, "$options": "i"}},
            ]
        }
    ).to_list(10)

    zakupnici = await db.zakupnici.find(
        {
            "$or": [
                {"naziv_firme": {"$regex": q, "$options": "i"}},
                {"ime_prezime": {"$regex": q, "$options": "i"}},
                {"oib": {"$regex": q, "$options": "i"}},
            ]
        }
    ).to_list(10)

    ugovori = await db.ugovori.find(
        {"$or": [{"interna_oznaka": {"$regex": q, "$options": "i"}}]}
    ).to_list(10)

    return {
        "nekretnine": [Nekretnina(**parse_from_mongo(n)) for n in nekretnine],
        "zakupnici": _build_zakupnici_list(zakupnici),
        "ugovori": _build_ugovori_list(ugovori),
    }


@api_router.post(
    "/ai/generate-contract-annex",
    dependencies=[Depends(require_scopes("leases:update", "documents:create"))],
)
async def generate_contract_annex(payload: AneksRequest):
    openai_key = _get_openai_api_key()

    ugovor_doc = await db.ugovori.find_one({"id": payload.ugovor_id})
    if not ugovor_doc:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    try:
        ugovor = _build_ugovor_model(ugovor_doc)
    except ValidationError as exc:
        logger.error(
            "Ugovor %s nije moguće validirati za AI generiranje aneksa: %s",
            payload.ugovor_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")

    nekretnina_doc = await db.nekretnine.find_one({"id": ugovor.nekretnina_id})
    zakupnik_doc = await db.zakupnici.find_one({"id": ugovor.zakupnik_id})

    nekretnina = (
        Nekretnina(**parse_from_mongo(nekretnina_doc)) if nekretnina_doc else None
    )
    zakupnik = None
    if zakupnik_doc:
        try:
            zakupnik = _build_zakupnik_model(zakupnik_doc)
        except ValidationError:
            zakupnik = None

    promjene = []
    if payload.nova_zakupnina is not None:
        promjene.append(f"Nova zakupnina: {payload.nova_zakupnina:.2f} EUR mjesečno")
    if payload.novi_datum_zavrsetka is not None:
        promjene.append(
            f"Novi datum završetka: {payload.novi_datum_zavrsetka.isoformat()}"
        )
    if payload.dodatne_promjene:
        promjene.append(f"Dodatne napomene: {payload.dodatne_promjene}")

    promjene_text = (
        "\n".join(promjene)
        if promjene
        else "Nema dodatnih promjena specificiranih od korisnika."
    )

    contract_summary = "\n".join(
        [
            f"Interna oznaka: {ugovor.interna_oznaka}",
            f"Status trenutnog ugovora: {ugovor.status}",
            f"Trajanje: {ugovor.trajanje_mjeseci} mjeseci",
            f"Razdoblje: {ugovor.datum_pocetka.isoformat()} - {ugovor.datum_zavrsetka.isoformat()}",
            f"Osnovna zakupnina: {ugovor.osnovna_zakupnina} EUR/mj",
            f"Zakupnina po m²: {ugovor.zakupnina_po_m2 or 'n/a'}",
            f"Depozit/polog: {ugovor.polog_depozit or 'n/a'}",
            f"CAM troškovi: {ugovor.cam_troskovi or 'n/a'}",
            f"Uvjeti produljenja: {ugovor.uvjeti_produljenja or 'n/a'}",
        ]
    )

    property_summary = "\n".join(
        [
            f"Nekretnina: {nekretnina.naziv if nekretnina else 'n/a'}",
            f"Adresa: {nekretnina.adresa if nekretnina else 'n/a'}",
            f"Površina: {nekretnina.povrsina if nekretnina and nekretnina.povrsina else 'n/a'}",
        ]
    )

    tenant_summary = "\n".join(
        [
            f"Zakupnik: {zakupnik.naziv_firme or zakupnik.ime_prezime if zakupnik else 'n/a'}",
            f"OIB: {zakupnik.oib if zakupnik else 'n/a'}",
            f"Sjedište: {zakupnik.sjediste if zakupnik else 'n/a'}",
        ]
    )

    title = (
        f"Aneks ugovora {ugovor.interna_oznaka}"
        if ugovor.interna_oznaka
        else "Aneks ugovora"
    )
    generated_at = datetime.now(timezone.utc)

    context_payload = {
        "contract_summary": contract_summary,
        "property_summary": property_summary,
        "tenant_summary": tenant_summary,
        "promjene": promjene,
        "promjene_text": promjene_text,
        "landlord_label": "Zakupodavac",
        "tenant_label": "Zakupnik",
        "generated_at": generated_at.isoformat(),
    }

    def _response_payload(content: str, source: str) -> Dict[str, Any]:
        return {
            "success": True,
            "title": title,
            "content": content.strip(),
            "context": context_payload,
            "metadata": {
                "nova_zakupnina": payload.nova_zakupnina,
                "novi_datum_zavrsetka": (
                    payload.novi_datum_zavrsetka.isoformat()
                    if payload.novi_datum_zavrsetka
                    else None
                ),
                "generated_at": generated_at.isoformat(),
                "template_path": str(ANEKS_TEMPLATE_PATH),
                "source": source,
            },
        }

    if not openai_key:
        fallback_text = _build_annex_fallback(
            ugovor, promjene_text, property_summary, tenant_summary
        )
        return _response_payload(fallback_text, "fallback")

    client = OpenAI(api_key=openai_key)

    system_prompt = (
        "Ti si pravni savjetnik specijaliziran za poslovne najmove u Hrvatskoj. "
        "Na temelju postojećeg ugovora i zadanih promjena pripremi jasan, profesionalan i pravno utemeljen aneks ugovora."
    )

    user_prompt = (
        "Pripremi aneks ugovora na hrvatskom jeziku. Nadogradnja treba sadržavati:"
        "\n- uvodni dio s referencom na originalni ugovor,"
        "\n- točke koje jasno opisuju promjene (nova cijena, novi rok i sve dodatne napomene),"
        "\n- klauzulu o stupanju na snagu i potvrdu da ostale odredbe ugovora ostaju nepromijenjene,"
        "\n- prostor za potpise obiju strana."
        "\nKoristi strukturirane točke i službeni ton."
        f"\n\nSažetak postojećeg ugovora:\n{contract_summary}\n\nPodaci o nekretnini:\n{property_summary}\n\nPodaci o zakupniku:\n{tenant_summary}\n\nŽeljene promjene:\n{promjene_text}"
    )

    try:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        ai_text = response.choices[0].message.content if response.choices else ""
        if not ai_text or not ai_text.strip():
            raise ValueError("AI response empty")
        return _response_payload(ai_text, "openai")
    except Exception as exc:
        logger.error("Greška pri generiranju AI aneksa (koristi se fallback): %s", exc)
        fallback_text = _build_annex_fallback(
            ugovor, promjene_text, property_summary, tenant_summary
        )
        return _response_payload(fallback_text, "fallback")


@api_router.post(
    "/ai/generate-contract",
    dependencies=[Depends(require_scopes("leases:create", "documents:create"))],
)
async def generate_contract(payload: ContractCloneRequest):
    if payload.novo_trajanje_mjeseci <= 0:
        raise HTTPException(
            status_code=400, detail="Trajanje ugovora mora biti veće od nule."
        )
    if payload.nova_zakupnina <= 0:
        raise HTTPException(
            status_code=400, detail="Nova zakupnina mora biti veća od nule."
        )

    nova_oznaka = payload.nova_interna_oznaka.strip()
    if not nova_oznaka:
        raise HTTPException(status_code=400, detail="Nova interna oznaka je obavezna.")

    openai_key = _get_openai_api_key()

    ugovor_doc = await db.ugovori.find_one({"id": payload.ugovor_id})
    if not ugovor_doc:
        raise HTTPException(status_code=404, detail="Ugovor nije pronađen")

    try:
        ugovor = _build_ugovor_model(ugovor_doc)
    except ValidationError as exc:
        logger.error(
            "Ugovor %s nije moguće validirati za AI generiranje ugovora: %s",
            payload.ugovor_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="Neispravni podaci ugovora")

    nekretnina_doc = await db.nekretnine.find_one({"id": ugovor.nekretnina_id})
    zakupnik_doc = await db.zakupnici.find_one({"id": ugovor.zakupnik_id})

    nekretnina = (
        Nekretnina(**parse_from_mongo(nekretnina_doc)) if nekretnina_doc else None
    )
    zakupnik = None
    if zakupnik_doc:
        try:
            zakupnik = _build_zakupnik_model(zakupnik_doc)
        except ValidationError:
            zakupnik = None

    novi_pocetak = payload.novi_datum_pocetka or ugovor.datum_pocetka
    novi_zavrsetak = payload.novi_datum_zavrsetka or _add_months(
        novi_pocetak, payload.novo_trajanje_mjeseci
    )

    original_contract_summary = "\n".join(
        [
            f"Interna oznaka: {ugovor.interna_oznaka}",
            f"Status: {ugovor.status}",
            f"Razdoblje: {ugovor.datum_pocetka.isoformat()} - {ugovor.datum_zavrsetka.isoformat()}",
            f"Trajanje: {ugovor.trajanje_mjeseci} mjeseci",
            f"Zakupnina: {ugovor.osnovna_zakupnina:.2f} EUR/mj",
        ]
    )

    property_summary = "\n".join(
        [
            f"Nekretnina: {nekretnina.naziv if nekretnina else 'n/a'}",
            f"Adresa: {nekretnina.adresa if nekretnina else 'n/a'}",
            f"Površina: {nekretnina.povrsina if nekretnina and nekretnina.povrsina else 'n/a'} m²",
        ]
    )

    tenant_summary = "\n".join(
        [
            f"Zakupnik: {zakupnik.naziv_firme or zakupnik.ime_prezime if zakupnik else 'n/a'}",
            f"OIB: {zakupnik.oib if zakupnik else 'n/a'}",
            f"Sjedište: {zakupnik.sjediste if zakupnik else 'n/a'}",
        ]
    )

    term_summary = "\n".join(
        [
            f"Novo trajanje: {payload.novo_trajanje_mjeseci} mjeseci",
            f"Razdoblje: {novi_pocetak.isoformat()} - {novi_zavrsetak.isoformat()}",
            f"Rok otkaza: {ugovor.rok_otkaza_dani} dana",
        ]
    )

    financial_summary = "\n".join(
        [
            f"Zakupnina: {payload.nova_zakupnina:.2f} EUR/mj",
            f"Zakupnina po m²: {ugovor.zakupnina_po_m2 or 'n/a'}",
            f"Depozit/polog: {ugovor.polog_depozit or 'n/a'}",
            f"CAM troškovi: {ugovor.cam_troskovi or 'n/a'}",
            f"Indeksacija: {'DA' if ugovor.indeksacija else 'NE'}",
        ]
    )

    obligations_summary = (
        ugovor.obveze_odrzavanja or "Obveze održavanja ostaju prema izvornom ugovoru."
    )
    special_provisions = (
        payload.dodatne_odredbe
        or ugovor.uvjeti_produljenja
        or "Nema dodatnih posebnih odredbi."
    )

    generated_at = datetime.now(timezone.utc)
    title = f"Ugovor o zakupu {nova_oznaka}" if nova_oznaka else "Ugovor o zakupu"

    context_payload = {
        "original_contract_summary": original_contract_summary,
        "property_summary": property_summary,
        "tenant_summary": tenant_summary,
        "term_summary": term_summary,
        "financial_summary": financial_summary,
        "obligations_summary": obligations_summary,
        "special_provisions": special_provisions,
        "nova_interna_oznaka": nova_oznaka,
        "nova_zakupnina": payload.nova_zakupnina,
        "novo_trajanje_mjeseci": payload.novo_trajanje_mjeseci,
        "novi_datum_pocetka": novi_pocetak.isoformat(),
        "novi_datum_zavrsetka": novi_zavrsetak.isoformat(),
        "landlord_label": "Zakupodavac",
        "tenant_label": "Zakupnik",
        "generated_at": generated_at.isoformat(),
    }

    confirmation_text = (
        "Strane potvrđuju da je ovaj ugovor sastavljen na temelju postojećeg poslovnog odnosa"
        " te da sve ranije obveze ostaju na snazi osim ako nisu izričito izmijenjene ovim dokumentom."
    )

    def _response_payload(content: str, source: str) -> Dict[str, Any]:
        return {
            "success": True,
            "title": title,
            "content": content.strip(),
            "context": context_payload,
            "metadata": {
                "nova_interna_oznaka": nova_oznaka,
                "nova_zakupnina": payload.nova_zakupnina,
                "novo_trajanje_mjeseci": payload.novo_trajanje_mjeseci,
                "novi_datum_pocetka": novi_pocetak.isoformat(),
                "novi_datum_zavrsetka": novi_zavrsetak.isoformat(),
                "generated_at": generated_at.isoformat(),
                "confirmation": confirmation_text,
                "template_path": str(UGOVOR_TEMPLATE_PATH),
                "source": source,
            },
        }

    if not openai_key:
        fallback_text = _build_contract_clone_fallback(
            original=ugovor,
            novi_pocetak=novi_pocetak,
            novi_zavrsetak=novi_zavrsetak,
            nova_zakupnina=payload.nova_zakupnina,
            nova_oznaka=nova_oznaka,
            novo_trajanje_mjeseci=payload.novo_trajanje_mjeseci,
            property_summary=property_summary,
            tenant_summary=tenant_summary,
        )
        return _response_payload(fallback_text, "fallback")

    client = OpenAI(api_key=openai_key)

    system_prompt = (
        "Ti si pravni savjetnik specijaliziran za poslovne najmove u Hrvatskoj. "
        "Na temelju postojećeg ugovora pripremi ažuriranu verziju ugovora o zakupu s novim uvjetima."
    )

    user_prompt = (
        "Pripremi ažurirani ugovor o zakupu na hrvatskom jeziku. Dokument treba sadržavati:"
        "\n- uvodni dio s referencom na izvorni ugovor i novu internu oznaku,"
        "\n- opis ugovornih strana i nekretnine,"
        "\n- novi raspored trajanja i rokove,"
        "\n- ažurirane financijske uvjete (naročito novu zakupninu),"
        "\n- obveze i posebne odredbe (uključujući dodatne napomene ako postoje),"
        "\n- završnu potvrdu o prihvaćanju i prostor za potpise."
        f"\n\nSažetak izvornog ugovora:\n{original_contract_summary}"
        f"\n\nPodaci o nekretnini:\n{property_summary}"
        f"\n\nPodaci o zakupniku:\n{tenant_summary}"
        f"\n\nNovi uvjeti trajanja:\n{term_summary}"
        f"\n\nFinancijski uvjeti:\n{financial_summary}"
        f"\n\nNova interna oznaka ugovora: {nova_oznaka}"
        f"\n\nPosebne odredbe:\n{special_provisions}"
        f"\n\nDodatne napomene korisnika:\n{payload.dodatne_odredbe or 'Nema dodatnih napomena.'}"
        "\n\nKoristi strukturirane odlomke i profesionalan ton."
    )

    try:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        ai_text = response.choices[0].message.content if response.choices else ""
        if not ai_text or not ai_text.strip():
            raise ValueError("AI response empty")
        return _response_payload(ai_text, "openai")
    except Exception as exc:
        logger.error("Greška pri generiranju AI ugovora (koristi se fallback): %s", exc)
        fallback_text = _build_contract_clone_fallback(
            original=ugovor,
            novi_pocetak=novi_pocetak,
            novi_zavrsetak=novi_zavrsetak,
            nova_zakupnina=payload.nova_zakupnina,
            nova_oznaka=nova_oznaka,
            novo_trajanje_mjeseci=payload.novo_trajanje_mjeseci,
            property_summary=property_summary,
            tenant_summary=tenant_summary,
        )
        return _response_payload(fallback_text, "fallback")


@api_router.get(
    "/templates/aneks",
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_annex_template():
    template_html = load_annex_template()
    return {
        "template": template_html,
        "path": str(ANEKS_TEMPLATE_PATH),
        "exists_on_disk": ANEKS_TEMPLATE_PATH.exists(),
    }


@api_router.get(
    "/templates/ugovor",
    dependencies=[Depends(require_scopes("documents:read"))],
)
async def get_contract_template():
    template_html = load_contract_template()
    return {
        "template": template_html,
        "path": str(UGOVOR_TEMPLATE_PATH),
        "exists_on_disk": UGOVOR_TEMPLATE_PATH.exists(),
    }


_DOC_TYPE_KEYWORDS = {
    "ugovor": ["ugovor", "aneks", "zakup", "najam"],
    "racun": ["račun", "racun", "invoice", "računa"],
}


def _guess_document_type(text: str) -> str:
    lowered = text.lower()
    for doc_type, keywords in _DOC_TYPE_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return doc_type
    return "ostalo"


def _safe_strip(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _to_iso_date(value: str) -> Optional[str]:
    normalized = value.replace("/", ".").replace("-", ".")
    parts = normalized.split(".")
    if len(parts) < 3:
        return None
    day, month, year = parts[0], parts[1], parts[2]
    if len(year) == 2:
        year = f"20{year}"
    try:
        parsed = datetime(int(year), int(month), int(day))
        return parsed.date().isoformat()
    except ValueError:
        return None


def _find_first(patterns: List[re.Pattern], text: str) -> Optional[str]:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            for group in match.groups():
                if group:
                    return group.strip()
    return None


def _parse_amount(value: str) -> Optional[float]:
    cleaned = value.replace("€", "").replace("EUR", "").replace(" ", "")
    cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _build_empty_extraction(document_type: str = "ostalo") -> Dict[str, Any]:
    return {
        "document_type": document_type,
        "ugovor": {
            "interna_oznaka": None,
            "datum_potpisivanja": None,
            "datum_pocetka": None,
            "datum_zavrsetka": None,
            "trajanje_mjeseci": None,
            "opcija_produljenja": None,
            "uvjeti_produljenja": None,
            "rok_otkaza_dani": None,
        },
        "nekretnina": {
            "naziv": None,
            "adresa": None,
            "katastarska_opcina": None,
            "broj_kat_cestice": None,
            "povrsina": None,
            "vrsta": None,
            "namjena_prostora": None,
        },
        "property_unit": {
            "oznaka": None,
            "naziv": None,
            "kat": None,
            "povrsina_m2": None,
            "status": None,
            "osnovna_zakupnina": None,
            "napomena": None,
            "layout_ref": None,
        },
        "zakupnik": {
            "naziv_firme": None,
            "ime_prezime": None,
            "oib": None,
            "sjediste": None,
            "kontakt_ime": None,
            "kontakt_email": None,
            "kontakt_telefon": None,
        },
        "financije": {
            "osnovna_zakupnina": None,
            "zakupnina_po_m2": None,
            "cam_troskovi": None,
            "polog_depozit": None,
            "garancija": None,
            "indeksacija": None,
            "indeks": None,
            "formula_indeksacije": None,
        },
        "ostalo": {
            "obveze_odrzavanja": None,
            "rezije_brojila": None,
        },
        "racun": {
            "dobavljac": None,
            "broj_racuna": None,
            "tip_rezije": None,
            "razdoblje_od": None,
            "razdoblje_do": None,
            "datum_izdavanja": None,
            "datum_dospijeca": None,
            "iznos_za_platiti": None,
            "iznos_placen": None,
            "valuta": None,
        },
    }


def _heuristic_extract_contract_data(pdf_text: str) -> Dict[str, Any]:
    document_type = _guess_document_type(pdf_text)
    extraction = _build_empty_extraction(document_type=document_type)

    line_break_normalized = pdf_text.replace("\r", "\n")

    contract_patterns = [
        re.compile(
            r"(?:interna\s+oznaka|oznaka|ugovor\s+br\.?|broj\s+ugovora)[:\-\s]+([^\n]+)",
            re.IGNORECASE,
        ),
        re.compile(r"(?:contract|reference)[:\-\s]+([^\n]+)", re.IGNORECASE),
    ]
    contract_value = _find_first(contract_patterns, line_break_normalized)
    extraction["ugovor"]["interna_oznaka"] = _safe_strip(contract_value)

    date_matches = re.findall(
        r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b", line_break_normalized
    )
    unique_dates: List[str] = []
    for item in date_matches:
        if item not in unique_dates:
            unique_dates.append(item)

    if unique_dates:
        extraction["ugovor"]["datum_potpisivanja"] = _to_iso_date(unique_dates[0])
    if len(unique_dates) > 1:
        extraction["ugovor"]["datum_pocetka"] = _to_iso_date(unique_dates[1])
    if len(unique_dates) > 2:
        extraction["ugovor"]["datum_zavrsetka"] = _to_iso_date(unique_dates[2])

    duration_match = _find_first(
        [
            re.compile(r"trajanje\s+(?:ugovora|najma)[:\s]*(\d{1,3})", re.IGNORECASE),
            re.compile(r"na\s+razdoblje\s+od\s+(\d{1,3})\s+mjes", re.IGNORECASE),
        ],
        line_break_normalized,
    )
    extraction["ugovor"]["trajanje_mjeseci"] = (
        int(duration_match) if duration_match and duration_match.isdigit() else None
    )

    extension_match = _find_first(
        [
            re.compile(r"opci[ja]{2}\s+produljenja[:\s]*(da|ne)", re.IGNORECASE),
            re.compile(
                r"produljenje\s+(?:mogu[eć]e|nije)?[:\s]*(da|ne)", re.IGNORECASE
            ),
        ],
        line_break_normalized,
    )
    if extension_match:
        extraction["ugovor"]["opcija_produljenja"] = extension_match.lower() == "da"

    termination_match = _find_first(
        [
            re.compile(r"rok\s+otkaza[:\s]*(\d{1,3})", re.IGNORECASE),
            re.compile(r"otkazni\s+rok[:\s]*(\d{1,3})", re.IGNORECASE),
        ],
        line_break_normalized,
    )
    extraction["ugovor"]["rok_otkaza_dani"] = (
        int(termination_match)
        if termination_match and termination_match.isdigit()
        else None
    )

    amount_patterns = re.findall(
        r"(?:\b|€)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:€|eur|eur[a-z]*)",
        line_break_normalized,
        re.IGNORECASE,
    )
    if amount_patterns:
        extraction["financije"]["osnovna_zakupnina"] = _parse_amount(amount_patterns[0])
        if len(amount_patterns) > 1:
            extraction["financije"]["zakupnina_po_m2"] = _parse_amount(
                amount_patterns[1]
            )

    deposit_match = _find_first(
        [
            re.compile(
                r"polog[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)", re.IGNORECASE
            ),
            re.compile(
                r"depozit[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)", re.IGNORECASE
            ),
        ],
        line_break_normalized,
    )
    if deposit_match:
        extraction["financije"]["polog_depozit"] = _parse_amount(deposit_match)

    email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", pdf_text)
    extraction["zakupnik"]["kontakt_email"] = (
        email_match.group(0) if email_match else None
    )

    phone_match = re.search(
        r"(\+?\d{1,3}[\s/\-]?)?(\d{2,3}[\s/\-]?){2,4}\d{2,4}",
        pdf_text,
    )
    if phone_match:
        extraction["zakupnik"]["kontakt_telefon"] = _safe_strip(phone_match.group(0))

    tenant_patterns = [
        re.compile(r"zakupnik[:\s]+([^\n]+)", re.IGNORECASE),
        re.compile(r"najmoprimac[:\s]+([^\n]+)", re.IGNORECASE),
        re.compile(r"customer[:\s]+([^\n]+)", re.IGNORECASE),
    ]
    tenant_name = _find_first(tenant_patterns, line_break_normalized)
    extraction["zakupnik"]["naziv_firme"] = _safe_strip(tenant_name)

    property_patterns = [
        re.compile(r"nekretnina[:\s]+([^\n]+)", re.IGNORECASE),
        re.compile(r"adresa[:\s]+([^\n]+)", re.IGNORECASE),
        re.compile(r"property[:\s]+([^\n]+)", re.IGNORECASE),
    ]
    property_value = _find_first(property_patterns, line_break_normalized)
    extraction["nekretnina"]["adresa"] = _safe_strip(property_value)

    oib_match = re.search(r"\b\d{11}\b", pdf_text)
    if oib_match:
        extraction["zakupnik"]["oib"] = oib_match.group(0)

    return extraction


def _document_json_schema() -> Dict[str, Any]:
    nullable_string = {"type": ["string", "null"]}
    nullable_number = {"type": ["number", "null"]}
    nullable_boolean = {"type": ["boolean", "null"]}

    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "document_type": {
                "type": "string",
                "enum": ["ugovor", "racun", "ostalo"],
            },
            "ugovor": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "interna_oznaka": nullable_string,
                    "datum_potpisivanja": nullable_string,
                    "datum_pocetka": nullable_string,
                    "datum_zavrsetka": nullable_string,
                    "trajanje_mjeseci": {"type": ["integer", "null"]},
                    "opcija_produljenja": nullable_boolean,
                    "uvjeti_produljenja": nullable_string,
                    "rok_otkaza_dani": {"type": ["integer", "null"]},
                },
                "required": [
                    "interna_oznaka",
                    "datum_potpisivanja",
                    "datum_pocetka",
                    "datum_zavrsetka",
                    "trajanje_mjeseci",
                    "opcija_produljenja",
                    "uvjeti_produljenja",
                    "rok_otkaza_dani",
                ],
            },
            "nekretnina": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "naziv": nullable_string,
                    "adresa": nullable_string,
                    "katastarska_opcina": nullable_string,
                    "broj_kat_cestice": nullable_string,
                    "povrsina": nullable_number,
                    "vrsta": {
                        "type": ["string", "null"],
                        "enum": [
                            "poslovna_zgrada",
                            "stan",
                            "zemljiste",
                            "ostalo",
                            None,
                        ],
                    },
                    "namjena_prostora": nullable_string,
                },
                "required": [
                    "naziv",
                    "adresa",
                    "katastarska_opcina",
                    "broj_kat_cestice",
                    "povrsina",
                    "vrsta",
                    "namjena_prostora",
                ],
            },
            "property_unit": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "oznaka": nullable_string,
                    "naziv": nullable_string,
                    "kat": nullable_string,
                    "povrsina_m2": nullable_number,
                    "status": {
                        "type": ["string", "null"],
                        "enum": [
                            "dostupno",
                            "iznajmljeno",
                            "rezervirano",
                            "u_odrzavanju",
                            None,
                        ],
                    },
                    "osnovna_zakupnina": nullable_number,
                    "napomena": nullable_string,
                    "layout_ref": nullable_string,
                },
                "required": [
                    "oznaka",
                    "naziv",
                    "kat",
                    "povrsina_m2",
                    "status",
                    "osnovna_zakupnina",
                    "napomena",
                    "layout_ref",
                ],
            },
            "zakupnik": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "naziv_firme": nullable_string,
                    "ime_prezime": nullable_string,
                    "oib": nullable_string,
                    "sjediste": nullable_string,
                    "kontakt_ime": nullable_string,
                    "kontakt_email": nullable_string,
                    "kontakt_telefon": nullable_string,
                },
                "required": [
                    "naziv_firme",
                    "ime_prezime",
                    "oib",
                    "sjediste",
                    "kontakt_ime",
                    "kontakt_email",
                    "kontakt_telefon",
                ],
            },
            "financije": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "osnovna_zakupnina": nullable_number,
                    "zakupnina_po_m2": nullable_number,
                    "cam_troskovi": nullable_number,
                    "polog_depozit": nullable_number,
                    "garancija": nullable_number,
                    "indeksacija": nullable_boolean,
                    "indeks": nullable_string,
                    "formula_indeksacije": nullable_string,
                },
                "required": [
                    "osnovna_zakupnina",
                    "zakupnina_po_m2",
                    "cam_troskovi",
                    "polog_depozit",
                    "garancija",
                    "indeksacija",
                    "indeks",
                    "formula_indeksacije",
                ],
            },
            "ostalo": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "obveze_odrzavanja": nullable_string,
                    "rezije_brojila": nullable_string,
                },
                "required": ["obveze_odrzavanja", "rezije_brojila"],
            },
            "racun": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "dobavljac": nullable_string,
                    "broj_racuna": nullable_string,
                    "tip_rezije": {
                        "type": ["string", "null"],
                        "enum": [
                            "struja",
                            "voda",
                            "plin",
                            "komunalije",
                            "internet",
                            "ostalo",
                            None,
                        ],
                    },
                    "razdoblje_od": nullable_string,
                    "razdoblje_do": nullable_string,
                    "datum_izdavanja": nullable_string,
                    "datum_dospijeca": nullable_string,
                    "iznos_za_platiti": nullable_number,
                    "iznos_placen": nullable_number,
                    "valuta": nullable_string,
                },
                "required": [
                    "dobavljac",
                    "broj_racuna",
                    "tip_rezije",
                    "razdoblje_od",
                    "razdoblje_do",
                    "datum_izdavanja",
                    "datum_dospijeca",
                    "iznos_za_platiti",
                    "iznos_placen",
                    "valuta",
                ],
            },
        },
        "required": [
            "document_type",
            "ugovor",
            "nekretnina",
            "property_unit",
            "zakupnik",
            "financije",
            "ostalo",
            "racun",
        ],
    }


def _parse_openai_structured_output(response: Any) -> Dict[str, Any]:
    output_parsed = getattr(response, "output_parsed", None)
    if isinstance(output_parsed, dict):
        return output_parsed

    for output in getattr(response, "output", []) or []:
        for item in getattr(output, "content", []) or []:
            parsed = getattr(item, "parsed", None)
            if isinstance(parsed, dict):
                return parsed

    segments: List[str] = []
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        segments.append(output_text.strip())
    elif isinstance(output_text, list):
        joined = "".join(str(part) for part in output_text if part)
        if joined.strip():
            segments.append(joined.strip())

    if not segments:
        for output in getattr(response, "output", []) or []:
            for item in getattr(output, "content", []) or []:
                text_value = getattr(item, "text", None)
                if isinstance(text_value, str) and text_value.strip():
                    segments.append(text_value.strip())

    if not segments and hasattr(response, "choices"):
        for choice in getattr(response, "choices", []) or []:
            text_value = getattr(choice, "text", None)
            if isinstance(text_value, str) and text_value.strip():
                segments.append(text_value.strip())
            message = getattr(choice, "message", None)
            if isinstance(message, dict):
                content_value = message.get("content")
                if isinstance(content_value, str) and content_value.strip():
                    segments.append(content_value.strip())

    if not segments:
        raise ValueError("AI response empty")

    last_error: Optional[json.JSONDecodeError] = None
    for candidate in segments:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as err:
            last_error = err
            start = candidate.find("{")
            end = candidate.rfind("}")
            if start != -1 and end != -1 and end > start:
                snippet = candidate[start : end + 1]
                try:
                    return json.loads(snippet)
                except json.JSONDecodeError as nested_err:
                    last_error = nested_err

    if last_error:
        raise ValueError(f"AI response nije valjan JSON: {last_error}")
    raise ValueError("AI response nije valjan JSON")


def _extract_with_openai(client: OpenAI, pdf_text: str) -> Dict[str, Any]:
    schema = _document_json_schema()
    schema_json = json.dumps(schema)

    system_prompt = (
        "Ti si digitalni asistent za upravljanje nekretninama. "
        "Analiziraj učitani PDF (ugovor, račun ili drugi dokument) i vrati strukturirane podatke kao JSON."
    )
    user_prompt = (
        "Vrati strogo valjan JSON koji odgovara shemi u nastavku (bez dodatnog teksta)."
        " Ako podatak ne postoji, postavi vrijednost na null. Datume formatiraj YYYY-MM-DD."
        " Brojčane vrijednosti vrati kao brojeve bez valute, osim ako valuta nije jasno navedena."
        "\n\nShema JSON-a:\n"
        f"{schema_json}"
        "\n\nTekst dokumenta:\n"
        f"{pdf_text}"
    )

    schema_name = "document_extraction"
    json_schema_strict = {
        "type": "json_schema",
        "name": schema_name,
        "schema": schema,
        "strict": True,
    }
    json_schema_legacy = {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name,
            "schema": schema,
        },
    }

    response_params = {}
    try:
        response_params = inspect.signature(client.responses.create).parameters  # type: ignore[assignment]
    except (TypeError, ValueError):
        response_params = {}

    candidate_content_types: List[str] = []
    for candidate in (OPENAI_INPUT_CONTENT_TYPE, "input_text", "text"):
        if candidate and candidate not in candidate_content_types:
            candidate_content_types.append(candidate)

    base_kwargs = {
        "model": _get_openai_document_model(),
        "temperature": 0,
    }

    last_exception: Optional[Exception] = None

    for content_type in candidate_content_types:
        messages = [
            {
                "role": "system",
                "content": [{"type": content_type, "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [{"type": content_type, "text": user_prompt}],
            },
        ]

        request_kwargs = {**base_kwargs, "input": messages}

        try:
            if "text" in response_params:
                response = client.responses.create(
                    **request_kwargs,
                    text={"format": json_schema_strict},
                )
            elif "response_format" in response_params:
                response = client.responses.create(
                    **request_kwargs,
                    response_format=json_schema_legacy,
                )
            else:
                raise RuntimeError(
                    "Trenutna verzija OpenAI SDK-a ne podržava strukturirane odgovore."
                )
        except BadRequestError as exc:
            error_text = str(exc)
            if (
                f"Invalid value: '{content_type}'" in error_text
                or f"invalid value: '{content_type}'" in error_text.lower()
            ) and len(candidate_content_types) > 1:
                last_exception = exc
                continue
            raise
        except Exception as exc:  # pragma: no cover - defensive fallback
            last_exception = exc
            break

        try:
            return _parse_openai_structured_output(response)
        except Exception as exc:  # pragma: no cover - parsing fallbacks
            last_exception = exc
            break

    if last_exception:
        raise last_exception
    raise RuntimeError("AI odgovor nije moguće obraditi")


@api_router.post(
    "/ai/parse-pdf-contract",
    dependencies=[Depends(require_scopes("documents:create"))],
)
async def parse_pdf_contract(request: Request, file: UploadFile = File(...)):
    """AI funkcija za čitanje i izvlačenje podataka iz PDF ugovora (OpenAI)"""
    try:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Datoteka mora biti PDF format")

        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="PDF datoteka je prazna")

        try:
            reader = PdfReader(BytesIO(pdf_bytes))
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"PDF se ne može pročitati: {exc}"
            )

        pages_text: List[str] = []
        max_pages = min(len(reader.pages), 20)
        for i in range(max_pages):
            try:
                page = reader.pages[i]
                pages_text.append(page.extract_text() or "")
            except Exception:
                pages_text.append("")
        pdf_text = "\n\n".join(pages_text)

        if len(pdf_text) > 25000:
            pdf_text = pdf_text[:25000]

        openai_key = _get_openai_api_key()
        extraction_strategy = "heuristic_fallback"
        parsed_data: Optional[Dict[str, Any]] = None
        openai_error_message: Optional[str] = None

        if openai_key:
            client = OpenAI(api_key=openai_key)
            try:
                parsed_data = await asyncio.to_thread(
                    _extract_with_openai, client, pdf_text
                )
                extraction_strategy = "openai_structured"
            except Exception as exc:  # pragma: no cover - depends on external API
                openai_error_message = str(exc)
                logger.error(
                    "Greška pri AI analizi PDF-a (OpenAI), koristi se fallback: %s",
                    exc,
                    exc_info=True,
                )

        if parsed_data is None:
            parsed_data = _heuristic_extract_contract_data(pdf_text)

        response_payload = await build_ai_parse_response(parsed_data)
        metadata = response_payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            response_payload["metadata"] = metadata
        metadata.update(
            {
                "extraction_strategy": extraction_strategy,
                "text_length": len(pdf_text),
            }
        )
        if openai_error_message and extraction_strategy != "openai_structured":
            metadata["openai_error"] = openai_error_message
            response_payload["message"] = (
                response_payload.get("message", "PDF je analiziran")
                + " (Primijenjen heuristički fallback.)"
            )
        return JSONResponse(response_payload)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Greška pri analizi PDF-a: {str(e)}", exc_info=True)
        return JSONResponse(
            {
                "success": False,
                "data": None,
                "message": f"Greška pri analizi PDF-a: {str(e)}",
            },
            status_code=500,
        )
    finally:
        try:
            await file.close()
        except Exception:
            pass


# Helper funkcija za kreiranje podsjećanja
async def create_podsjetnici_za_ugovor(ugovor: Ugovor):
    """Kreira automatske podsjetnike za ugovor"""
    datum_zavrsetka = (
        datetime.fromisoformat(ugovor.datum_zavrsetka)
        if isinstance(ugovor.datum_zavrsetka, str)
        else ugovor.datum_zavrsetka
    )

    dani_prije_lista = [180, 120, 90, 60, 30]

    for dani_prije in dani_prije_lista:
        datum_podsjetnika = datum_zavrsetka - timedelta(days=dani_prije)

        podsjetnik = Podsjetnik(
            tip="istek_ugovora",
            ugovor_id=ugovor.id,
            datum_podsjetnika=datum_podsjetnika,
            dani_prije=dani_prije,
        )

        await db.podsjetnici.insert_one(prepare_for_mongo(podsjetnik.model_dump()))


# Include the router in the main app
app.include_router(api_router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_annex_template() -> str:
    """Load annex template HTML from disk or fall back to the bundled default."""
    try:
        return ANEKS_TEMPLATE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.warning(
            "Aneks predložak nije pronađen na %s. Koristi se ugrađena zadana verzija.",
            ANEKS_TEMPLATE_PATH,
        )
    except OSError as exc:
        logger.error(
            "Aneks predložak se ne može pročitati (%s). Koristi se ugrađena zadana verzija.",
            exc,
        )
    return DEFAULT_ANEKS_TEMPLATE_HTML


def load_contract_template() -> str:
    """Load contract template HTML from disk or fall back to the bundled default."""
    try:
        return UGOVOR_TEMPLATE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.warning(
            "Ugovor predložak nije pronađen na %s. Koristi se ugrađena zadana verzija.",
            UGOVOR_TEMPLATE_PATH,
        )
    except OSError as exc:
        logger.error(
            "Ugovor predložak se ne može pročitati (%s). Koristi se ugrađena zadana verzija.",
            exc,
        )
    return DEFAULT_UGOVOR_TEMPLATE_HTML


@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
