import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")


@dataclass(frozen=True)
class DatabaseSettings:
    """Settings required to build the SQLAlchemy engine."""

    url: Optional[str] = None
    engine: str = "mariadb+asyncmy"
    host: str = "localhost"
    port: int = 3307
    user: str = "mkproptech"
    password: str = "mkproptech"
    name: str = "mkproptech"
    echo: bool = False
    pool_size: int = 5
    max_overflow: int = 10

    def sqlalchemy_url(self) -> str:
        if self.url:
            return self.url
        return (
            f"{self.engine}://{self.user}:{self.password}@"
            f"{self.host}:{self.port}/{self.name}"
        )


class Settings:
    PROJECT_NAME: str = "MK Proptech API"
    API_V1_STR: str = "/api"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        x.strip()
        for x in os.environ.get("BACKEND_CORS_ORIGINS", "*").split(",")
        if x.strip()
    ]

    # Auth
    AUTH_SECRET: str = os.environ.get("AUTH_SECRET", "dev-secret-key-change-in-prod")
    AUTH_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Database
    DB_SETTINGS: DatabaseSettings = DatabaseSettings(
        url=os.getenv("DATABASE_URL"),
        engine=os.getenv("DB_ENGINE", "mariadb+asyncmy"),
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3307")),
        user=os.getenv("DB_USER", "mkproptech"),
        password=os.getenv("DB_PASSWORD", "mkproptech"),
        name=os.getenv("DB_NAME", "mkproptech"),
        echo=os.getenv("DB_ECHO", "false").lower() == "true",
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
    )

    USE_IN_MEMORY_DB: bool = (
        os.environ.get("USE_IN_MEMORY_DB", "false").lower() == "true"
    )
    AUTO_RUN_MIGRATIONS: bool = (
        os.environ.get("AUTO_RUN_MIGRATIONS", "true").lower() == "true"
    )
    SEED_ADMIN_ON_STARTUP: bool = (
        os.environ.get("SEED_ADMIN_ON_STARTUP", "false").lower() == "true"
    )

    # Initial Admin
    INITIAL_ADMIN_EMAIL: Optional[str] = os.environ.get("INITIAL_ADMIN_EMAIL")
    INITIAL_ADMIN_PASSWORD: Optional[str] = os.environ.get("INITIAL_ADMIN_PASSWORD")
    INITIAL_ADMIN_FULL_NAME: str = os.environ.get(
        "INITIAL_ADMIN_FULL_NAME", "Portfolio Admin"
    )
    INITIAL_ADMIN_ROLE: str = os.environ.get("INITIAL_ADMIN_ROLE", "owner")

    # Paths
    UPLOAD_DIR: Path = ROOT_DIR / "uploads"
    DOCUMENT_REQUIREMENTS_PATH: Optional[str] = os.environ.get(
        "DOCUMENT_REQUIREMENTS_PATH"
    )

    # Defaults
    DEFAULT_TENANT_ID: str = os.environ.get("DEFAULT_TENANT_ID", "tenant-default")
    DEFAULT_TENANT_NAME: str = os.environ.get("DEFAULT_TENANT_NAME", "Glavna portfelj")
    OPENAI_API_KEY: Optional[str] = os.environ.get("OPENAI_API_KEY")


@lru_cache
def get_settings() -> Settings:
    return Settings()
