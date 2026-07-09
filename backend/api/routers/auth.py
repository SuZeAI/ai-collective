from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import HTMLResponse, RedirectResponse

from backend.api.settings import settings
from backend.api.security import create_access_token
from backend.api.schemas.skill import (
    GoogleSheetOAuthStartRequest,
    GoogleSheetOAuthStartResponse,
    GoogleSheetOAuthStatusResponse,
)
from backend.api.schemas.auth_user import (
    RegisterRequest,
    LoginRequest,
    UserSchema,
    TokenResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    GoogleLoginUrlResponse,
)
from backend.application.service.google_login_service import GoogleLoginService
from backend.api.deps import get_user_service, current_user_dep, current_owner_id_dep
from backend.application.service.user_service import UserService
from backend.domain.errors import ValidationError, NotFoundError
from backend.domain.models import User

_GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/calendar",
]
_GOOGLE_TOOL_NAMES = {"sheet", "drive", "docs", "slides", "calendar"}
_OAUTH_STATE_TTL_SECONDS = 600
_OAUTH_PENDING_STATES: dict[str, dict[str, str]] = {}
_DEFAULT_GOOGLE_REDIRECT_URI = "http://127.0.0.1:8000/api/v1/auth/oauth/callback"


def _cleanup_expired_oauth_states() -> None:
    """Remove expired OAuth states from pending registry."""
    now = datetime.now(timezone.utc)
    expired = []
    for state, payload in _OAUTH_PENDING_STATES.items():
        created_at_raw = payload.get("created_at", "")
        try:
            created_at = datetime.fromisoformat(created_at_raw)
        except ValueError:
            expired.append(state)
            continue
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if now - created_at > timedelta(seconds=_OAUTH_STATE_TTL_SECONDS):
            expired.append(state)
    for state in expired:
        _OAUTH_PENDING_STATES.pop(state, None)


def _normalize_google_tool_name(tool_name: str | None) -> str:
    normalized = (tool_name or "").strip().lower()
    if normalized not in _GOOGLE_TOOL_NAMES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported Google tool_name. "
                "Expected one of: sheet, drive, docs, slides, calendar."
            ),
        )
    return normalized


def _get_token_path_for_email(email: str, tool_name: str) -> str:
    """Generate token file path for given email."""
    storage_dir = Path("secrets") / "google" / tool_name
    storage_dir.mkdir(parents=True, exist_ok=True)
    safe_email = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower()) or "default"
    return str(storage_dir / f"token_{safe_email}.json")


def _resolve_client_secret_path() -> str:
    """Get Google OAuth credentials file path from settings or default."""
    return (
        settings.auth.google_oauth_client_secret_path
        or settings.auth.credentials_path
        or "credentials.json"
    )


def _normalize_redirect_uri(uri: str) -> str:
    """Normalize redirect URI to avoid accidental whitespace/trailing slash mismatches."""
    normalized = (uri or "").strip()
    if normalized.endswith("/"):
        normalized = normalized[:-1]
    return normalized


def _resolve_redirect_uri() -> str:
    """Resolve effective OAuth redirect URI from env/settings with safe fallback."""
    configured = _normalize_redirect_uri(settings.google_oauth_redirect_uri or "")
    return configured or _DEFAULT_GOOGLE_REDIRECT_URI


def _create_google_oauth_flow():
    """Create Google OAuth flow with validated configuration."""
    try:
        from google_auth_oauthlib.flow import Flow
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Missing dependency google-auth-oauthlib. Install Google auth dependencies first.",
        ) from exc

    client_secret_path = _resolve_client_secret_path()
    if not os.path.exists(client_secret_path):
        raise HTTPException(
            status_code=400,
            detail=(
                "Google OAuth client credentials file not found. "
                f"Set GOOGLE_OAUTH_CLIENT_SECRET_PATH or CREDENTIALS_PATH (current: {client_secret_path})."
            ),
        )

    flow = Flow.from_client_secrets_file(client_secret_path, scopes=_GOOGLE_SCOPES)
    flow.redirect_uri = _resolve_redirect_uri()
    return flow


def _google_sheet_oauth_callback_impl(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    """Handle Google OAuth callback: exchange code for credentials and store token."""
    _cleanup_expired_oauth_states()

    if not state:
        raise HTTPException(status_code=400, detail="Missing OAuth state.")

    payload = _OAUTH_PENDING_STATES.get(state)
    if payload is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")

    if error:
        payload["status"] = "error"
        payload["error"] = error
        return HTMLResponse(
            "<html><body><h3>Google authorization failed.</h3><p>You can close this window.</p>"
            "<script>window.close();</script></body></html>",
            status_code=400,
        )

    if not code:
        payload["status"] = "error"
        payload["error"] = "Missing authorization code"
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    flow = _create_google_oauth_flow()

    try:
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        email = payload.get("email", "")
        tool_name = payload.get("tool_name", "sheet")
        token_path = payload.get("token_path") or _get_token_path_for_email(email or "default", tool_name)
        Path(token_path).write_text(credentials.to_json(), encoding="utf-8")
        payload["status"] = "authorized"
        payload["token_path"] = token_path
        payload["error"] = ""
    except Exception as exc:
        payload["status"] = "error"
        payload["error"] = str(exc)
        return HTMLResponse(
            "<html><body><h3>Google authorization failed.</h3><p>You can close this window and try again.</p>"
            "<script>window.close();</script></body></html>",
            status_code=400,
        )

    return HTMLResponse(
        "<html><body><h3>Google Sheet authorization successful.</h3><p>You can close this window now.</p>"
        "<script>window.close();</script></body></html>"
    )


# ============================================================================
# FastAPI Router & Endpoints
# ============================================================================

# Generic OAuth router for any service (will be included with /api/v1/auth prefix)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/oauth/start", response_model=GoogleSheetOAuthStartResponse)
def start_oauth(
    payload: GoogleSheetOAuthStartRequest,
    owner_id: str = Depends(current_owner_id_dep),
) -> GoogleSheetOAuthStartResponse:
    """Start generic OAuth flow (for Google Sheets and other services)."""
    _cleanup_expired_oauth_states()

    flow = _create_google_oauth_flow()
    login_hint = (payload.email_hint or "").strip()
    tool_name = _normalize_google_tool_name(payload.tool_name or "sheet")

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        login_hint=login_hint or None,
    )

    query = parse_qs(urlparse(authorization_url).query)
    effective_redirect_uri = (query.get("redirect_uri", [""])[0] or "").strip()

    _OAUTH_PENDING_STATES[state] = {
        "status": "pending",
        "owner_id": owner_id,
        "email": login_hint,
        "tool_name": tool_name,
        "token_path": _get_token_path_for_email(login_hint or "default", tool_name),
        "redirect_uri": effective_redirect_uri or _resolve_redirect_uri(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "error": "",
    }

    return GoogleSheetOAuthStartResponse(
        authorize_url=authorization_url,
        state=state,
        expires_in_seconds=_OAUTH_STATE_TTL_SECONDS,
        redirect_uri=effective_redirect_uri or _resolve_redirect_uri(),
    )


@router.get("/oauth/status", response_model=GoogleSheetOAuthStatusResponse)
def get_oauth_status(
    state: str = Query(..., min_length=8),
    owner_id: str = Depends(current_owner_id_dep),
) -> GoogleSheetOAuthStatusResponse:
    """Check OAuth authorization status."""
    _cleanup_expired_oauth_states()

    payload = _OAUTH_PENDING_STATES.get(state)
    # Same 404 whether the state is unknown/expired or simply belongs to a
    # different owner — avoids confirming a guessed state exists at all.
    if payload is None or payload.get("owner_id") != owner_id:
        raise HTTPException(status_code=404, detail="OAuth state not found or expired.")

    status = payload.get("status", "pending")
    return GoogleSheetOAuthStatusResponse(
        state=state,
        status=status if status in {"pending", "authorized", "error"} else "pending",
        authorized=status == "authorized",
        email=payload.get("email", ""),
        token_path=payload.get("token_path", ""),
        error=payload.get("error", ""),
    )


@router.get("/oauth/callback", response_class=HTMLResponse)
def oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    """OAuth callback handler from Google (use this URL in Google Cloud Console)."""
    return _google_sheet_oauth_callback_impl(request=request, code=code, state=state, error=error)


# ============================================================================
# Google Social Login
# ============================================================================

def _google_login_service() -> GoogleLoginService:
    return GoogleLoginService(
        client_id=settings.google_login_client_id,
        client_secret=settings.google_login_client_secret,
        redirect_uri=settings.google_login_redirect_uri,
        frontend_url=settings.frontend_url,
    )


@router.get("/google/login", response_model=GoogleLoginUrlResponse)
def google_login(
    svc: GoogleLoginService = Depends(_google_login_service),
) -> GoogleLoginUrlResponse:
    """Return the Google OAuth2 authorization URL for social sign-in.

    The frontend should redirect the user to `authorize_url`.
    """
    authorize_url, state = svc.build_authorization_url()
    return GoogleLoginUrlResponse(authorize_url=authorize_url, state=state)


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    svc: GoogleLoginService = Depends(_google_login_service),
    user_service: UserService = Depends(get_user_service),
) -> RedirectResponse:
    """Handle Google OAuth2 callback.

    Google redirects here with `code` and `state`.  We exchange the code for
    tokens, fetch the user's profile, create/find the local account, issue a
    JWT, then redirect the browser to `{FRONTEND_URL}/auth/callback?token=...`.
    """
    if error:
        return RedirectResponse(svc.frontend_error_url(error), status_code=302)

    if not code or not state:
        return RedirectResponse(svc.frontend_error_url("Missing code or state"), status_code=302)

    try:
        userinfo = svc.exchange_code(
            code=code,
            state=state,
            authorization_response=str(request.url),
        )
    except HTTPException as exc:
        return RedirectResponse(svc.frontend_error_url(exc.detail), status_code=302)

    google_sub: str = userinfo.get("sub", "")
    email: str = userinfo.get("email", "")
    name: str = userinfo.get("name", "")
    picture: str = userinfo.get("picture", "")

    if not email or not google_sub:
        return RedirectResponse(svc.frontend_error_url("Google did not return an email"), status_code=302)

    user = user_service.find_or_create_by_oauth(
        provider="google",
        provider_id=google_sub,
        email=email,
        name=name,
        avatar=picture,
    )

    token = create_access_token(subject=user.id)
    return RedirectResponse(svc.frontend_callback_url(token), status_code=302)


# ============================================================================
# User Authentication Endpoints
# ============================================================================

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    user_service: UserService = Depends(get_user_service),
) -> TokenResponse:
    """Register a new user account."""
    try:
        user = user_service.register(name=body.name, email=body.email, password=body.password)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token, user=UserSchema.from_domain(user))


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    user_service: UserService = Depends(get_user_service),
) -> TokenResponse:
    """Authenticate with email + password and return a JWT token."""
    try:
        user = user_service.authenticate(email=body.email, password=body.password)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token, user=UserSchema.from_domain(user))


@router.get("/me", response_model=UserSchema)
def get_me(current_user: User = Depends(current_user_dep)) -> UserSchema:
    """Return the currently authenticated user's profile."""
    return UserSchema.from_domain(current_user)


_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_IMAGE_EXTENSION_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
_AVATAR_DIR = Path("static/avatars")
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


@router.patch("/profile", response_model=UserSchema)
def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> UserSchema:
    """Update the current user's name, email, and/or avatar URL."""
    try:
        updated = user_service.update_profile(
            current_user.id,
            name=body.name,
            email=str(body.email) if body.email else None,
            avatar=body.avatar,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return UserSchema.from_domain(updated)


@router.post("/avatar", response_model=UserSchema)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> UserSchema:
    """Upload a new avatar image (JPEG, PNG, GIF, WebP; max 5 MB)."""
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP.")
    content = await file.read()
    if len(content) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 5 MB.")
    # Derive the extension from the already-validated content type rather than
    # trusting the client-supplied filename, so a crafted filename can't pick
    # an arbitrary extension for the file written under _AVATAR_DIR.
    ext = _IMAGE_EXTENSION_BY_CONTENT_TYPE[file.content_type]
    _AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    dest = _AVATAR_DIR / f"{current_user.id}{ext}"
    # Offload blocking disk write so it doesn't stall the event loop.
    await asyncio.to_thread(dest.write_bytes, content)
    avatar_url = str(request.base_url).rstrip("/") + f"/static/avatars/{current_user.id}{ext}"
    updated = user_service.update_profile(current_user.id, avatar=avatar_url)
    return UserSchema.from_domain(updated)


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> None:
    """Change the current user's password."""
    try:
        user_service.change_password(
            current_user.id,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: User = Depends(current_user_dep)) -> None:
    """Sign out — client should discard the JWT token."""
    return None
