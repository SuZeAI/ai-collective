from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse

from backend.api.settings import settings
from backend.api.schemas.skill import (
    GoogleSheetOAuthStartRequest,
    GoogleSheetOAuthStartResponse,
    GoogleSheetOAuthStatusResponse,
)

_GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/calendar",
]
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


def _get_token_path_for_email(email: str) -> str:
    """Generate token file path for given email."""
    storage_dir = Path("secrets") / "google"
    storage_dir.mkdir(parents=True, exist_ok=True)
    safe_email = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower()) or "default"
    return str(storage_dir / f"token_{safe_email}.json")


def _resolve_client_secret_path() -> str:
    """Get Google OAuth credentials file path from env or default."""
    return (
        os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET_PATH")
        or os.environ.get("CREDENTIALS_PATH")
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
        token_path = payload.get("token_path") or _get_token_path_for_email(email or "default")
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
) -> GoogleSheetOAuthStartResponse:
    """Start generic OAuth flow (for Google Sheets and other services)."""
    _cleanup_expired_oauth_states()

    flow = _create_google_oauth_flow()
    login_hint = (payload.email_hint or "").strip()

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
        "email": login_hint,
        "token_path": _get_token_path_for_email(login_hint or "default"),
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
def get_oauth_status(state: str = Query(..., min_length=8)) -> GoogleSheetOAuthStatusResponse:
    """Check OAuth authorization status."""
    _cleanup_expired_oauth_states()

    payload = _OAUTH_PENDING_STATES.get(state)
    if payload is None:
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
