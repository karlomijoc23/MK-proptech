import logging
import time
import uuid
from contextlib import asynccontextmanager

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.roles import DEFAULT_ROLE, resolve_role_scopes
from app.core.security import hash_password
from app.db.instance import db
from app.db.session import dispose_engine
from app.db.utils import prepare_for_mongo
from app.models.domain import ActivityLog, User
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    if "sqlite" in settings.DB_SETTINGS.sqlalchemy_url():
        from app.db.base import Base
        from app.db.session import get_engine

        engine = get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Seed admin if needed
    if (
        settings.SEED_ADMIN_ON_STARTUP
        and settings.INITIAL_ADMIN_EMAIL
        and settings.INITIAL_ADMIN_PASSWORD
    ):
        email = settings.INITIAL_ADMIN_EMAIL.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            role = settings.INITIAL_ADMIN_ROLE
            user = User(
                email=email,
                full_name=settings.INITIAL_ADMIN_FULL_NAME,
                role=role,
                scopes=resolve_role_scopes(role, ["*"] if role == "owner" else []),
                password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
            )
            user_data = prepare_for_mongo(user.model_dump())
            await db.users.insert_one(user_data)
            logger.info(f"Seeded initial admin: {email}")

    yield

    # Shutdown logic
    await dispose_engine()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


@app.get("/")
async def root():
    return {"message": "Welcome to MK Proptech API. Visit /docs for documentation."}


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    headers = response.headers
    headers.setdefault("X-Content-Type-Options", "nosniff")
    if request.url.path.startswith("/uploads/"):
        headers.pop("X-Frame-Options", None)
        headers.pop("Content-Security-Policy", None)
    else:
        headers.setdefault("X-Frame-Options", "DENY")
    headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
    )
    headers.setdefault(
        "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
    )
    if "Content-Security-Policy" not in headers:
        headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; font-src 'self' data:; "
            "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "connect-src 'self'; frame-ancestors 'self'"
        )
    return response


# Activity Logging Middleware
@app.middleware("http")
async def activity_logger(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()

    try:
        response = await call_next(request)
        status_code = response.status_code
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        principal = getattr(request.state, "current_user", None) or {
            "id": "guest",
            "name": "guest",
            "role": DEFAULT_ROLE,
            "scopes": resolve_role_scopes(DEFAULT_ROLE),
        }

        try:
            log = ActivityLog(
                user=principal.get("name", "anonymous"),
                role=principal.get("role", DEFAULT_ROLE),
                actor_id=principal.get("id"),
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                scopes=principal.get("scopes", []),
                request_id=request_id,
                duration_ms=duration_ms,
            )
            await db.activity_logs.insert_one(prepare_for_mongo(log.model_dump()))
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")

        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        try:
            principal = getattr(request.state, "current_user", None) or {
                "id": "guest",
                "name": "guest",
                "role": DEFAULT_ROLE,
                "scopes": resolve_role_scopes(DEFAULT_ROLE),
            }
            log = ActivityLog(
                user=principal.get("name", "anonymous"),
                role=principal.get("role", DEFAULT_ROLE),
                actor_id=principal.get("id"),
                method=request.method,
                path=request.url.path,
                status_code=500,
                scopes=principal.get("scopes", []),
                request_id=request_id,
                duration_ms=duration_ms,
                message=str(exc),
            )
            await db.activity_logs.insert_one(prepare_for_mongo(log.model_dump()))
        except Exception:
            pass
        raise


app.include_router(api_router, prefix=settings.API_V1_STR)
