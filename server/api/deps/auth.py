from __future__ import annotations

from server.api.deps.users import get_user_service
from server.app.service.user_service import UserService

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

# Real implementation — defined here so the import is available.
# Usage in routers:
#   from server.api.deps import current_user_dep
#   @router.get("") def endpoint(user = Depends(current_user_dep)): ...
def _make_current_user_dep():
    from fastapi import Depends, Header, HTTPException, status

    def dep(
        authorization: str | None = Header(default=None, alias="Authorization"),
        user_service: UserService = Depends(get_user_service),
    ):
        import jwt as _jwt
        from server.api.security import decode_access_token
        from server.domain.errors import NotFoundError

        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = authorization.split(" ", 1)[1]
        try:
            payload = decode_access_token(token)
            user_id: str = payload.get("sub", "")
        except _jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except _jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            return user_service.find_by_id(user_id)
        except NotFoundError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return dep


current_user_dep = _make_current_user_dep()


# Optional-auth owner resolution: identifies which "owner scope" a request
# belongs to. Valid Bearer token → that user's id; no token (guest mode in the
# frontend sends none) → the shared GUEST_OWNER_ID scope. Users with the
# "admin" (or legacy "system") role act in the shared DEFAULT_OWNER_ID scope:
# everything they create is shared with everyone and they may delete shared
# items. A token that is present but expired/invalid is rejected so stale
# sessions don't silently read another scope's data.
def _make_current_owner_id_dep():
    from fastapi import Depends, Header, HTTPException, status

    def dep(
        authorization: str | None = Header(default=None, alias="Authorization"),
        user_service: UserService = Depends(get_user_service),
    ) -> str:
        import jwt as _jwt
        from server.api.security import decode_access_token
        from server.domain.models import DEFAULT_OWNER_ID, GUEST_OWNER_ID

        if not authorization or not authorization.startswith("Bearer "):
            return GUEST_OWNER_ID
        token = authorization.split(" ", 1)[1]
        try:
            payload = decode_access_token(token)
        except _jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except _jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = str(payload.get("sub", ""))
        if not user_id:
            return GUEST_OWNER_ID
        try:
            user = user_service.find_by_id(user_id)
        except Exception:
            return user_id
        if getattr(user, "role", "") in ("admin", "system"):
            return DEFAULT_OWNER_ID
        return user_id

    return dep


current_owner_id_dep = _make_current_owner_id_dep()
