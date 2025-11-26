from app.core.config import get_settings
from app.db.document_store import MariaDBDatabase
from app.db.session import get_async_session_factory
from app.db.tenant import TenantAwareDatabase

settings = get_settings()

# Initialize the database instance
session_factory = get_async_session_factory()
_mariadb = MariaDBDatabase(session_factory)
db = TenantAwareDatabase(_mariadb)
