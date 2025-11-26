from typing import Any, Dict, Optional

from app.core.config import get_settings
from app.core.roles import DEFAULT_ROLE, resolve_role_scopes, scope_matches
from app.db.instance import db
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt

settings = get_settings()

# Open endpoints that don't require auth
OPEN_ENDPOINTS = {
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/auth/login",
    "/api/auth/register",
    "/health",
}


async def get_current_user(request: Request) -> Dict[str, Any]:

    # Check if endpoint is open
    # Note: This check is usually done in middleware or before dependency injection
    # But since we are using this as a dependency for the router, it will be called.
    # However, for open endpoints, we might not want to enforce auth.
    # In the original code, it returned a guest user for open endpoints.
    # Here, we will rely on the router to apply this dependency only where needed,
    # OR we can keep the logic if we apply it globally.
    # Given the plan to use APIRouter dependencies, we should probably be strict here
    # and not apply this dependency to auth endpoints.
    # BUT, the original code had a global middleware-like approach.
    # Let's stick to standard FastAPI: apply dependency to protected routes.
    # So I will remove the OPEN_ENDPOINTS check from here and assume this is only called
    # for protected routes.

    auth_header = request.headers.get("Authorization", "")
    token_value: Optional[str] = None
    if auth_header.startswith("Bearer "):
        token_value = auth_header.split(" ", 1)[1].strip()
    elif auth_header:
        token_value = auth_header.strip()

    if not token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # API Tokens check (omitted for now as it relies on a global dict in server.py,
    # we should move it to config or DB if needed, but for now let's focus on JWT)

    try:
        payload = jwt.decode(
            token_value, settings.AUTH_SECRET, algorithms=[settings.AUTH_ALGORITHM]
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # We need to fetch the user from DB
    # Since db.users.find_one returns a dict, we use it.
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Neautorizirano",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # We can convert to User model but for performance we might keep it as dict
    # or convert it. The original code converted it.
    # Let's convert it to keep typing happy.
    # But wait, the User model expects datetime objects, and mongo stores strings.
    # We need the parse_from_mongo helper.
    # I should move parse_from_mongo to db/query_utils or similar.

    # For now, I will implement a simple parser here or move the helper.
    # Let's move the helper to app/db/utils.py (renamed from query_utils or added to it)
    # Actually, I'll add it to this file for now or use a local helper.

    # Let's assume user_doc has ISO strings.
    # I'll just pass it as is to the principal dict for now,
    # as the original code did `User(**parse_from_mongo(user_doc))` then converted back to dict for principal.

    role = user_doc.get("role", DEFAULT_ROLE)
    token_scopes = payload.get("scopes", [])
    user_scopes = user_doc.get("scopes", [])
    scopes = resolve_role_scopes(role, token_scopes or user_scopes)

    principal = {
        "id": user_doc.get("id"),
        "name": user_doc.get("full_name") or user_doc.get("email"),
        "role": role,
        "scopes": scopes,
        "token_based": False,
        "tenant_id": user_doc.get("tenant_id"),  # Add tenant_id if present
    }

    # Set context var for tenant
    # We need to import CURRENT_TENANT_ID from app.db.tenant
    from app.db.tenant import CURRENT_TENANT_ID

    # Check header for tenant override if allowed (e.g. for superadmins)
    # The original code had:
    # tenant_id = os.environ.get("BACKEND_TENANT_ID") or payload.get("user", {}).get("tenant_id")
    # if tenant_id and "X-Tenant-Id" not in self.headers: ...
    # In server.py:
    # tenant_id_header = request.headers.get("X-Tenant-Id")
    # ... logic to determine tenant ...
    # I will implement basic tenant extraction from header or user
    tenant_id = request.headers.get("X-Tenant-Id")
    if not tenant_id:
        # Fallback to user's tenant
        # We need to check membership.
        # For now, let's assume the user has a default tenant or we find one.
        # The original code had complex logic for this.
        pass

    # For now, let's just set it if found in user or header
    if tenant_id:
        # Verify membership
        # Skip check for superadmins (admin/owner)
        if role not in ["admin", "owner"]:
            # Check if user is member of this tenant
            membership = await db.tenant_memberships.find_one(
                {"user_id": user_doc["id"], "tenant_id": tenant_id, "status": "active"}
            )
            if not membership:
                # If not a member, check if it's the user's own "personal" tenant?
                # Or just forbid.
                # For now, forbid.
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Nemate pristup ovom tenantu",
                )

        CURRENT_TENANT_ID.set(tenant_id)

    request.state.current_user = principal
    return principal


def require_scopes(*scopes: str):
    async def _dependency(
        request: Request, current_user: Dict[str, Any] = Depends(get_current_user)
    ):
        granted = list(current_user.get("scopes", []))
        # Add tenant scopes if any (logic from original code)
        tenant_scopes = getattr(request.state, "tenant_scopes", [])
        if tenant_scopes:
            for scope in tenant_scopes:
                if scope not in granted:
                    granted.append(scope)

        missing = [scope for scope in scopes if not scope_matches(granted, scope)]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Nedostaju ovlasti: {', '.join(missing)}",
            )
        return True

    return _dependency
