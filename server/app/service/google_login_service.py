"""Google OAuth2 social login service.

Implements the Authorization Code flow for user sign-in with Google.
This is separate from the Google Sheets OAuth (which grants tool access)
and only requests identity scopes (openid, email, profile).

Environment variables required:
  GOOGLE_LOGIN_CLIENT_ID      — OAuth 2.0 client ID
  GOOGLE_LOGIN_CLIENT_SECRET  — OAuth 2.0 client secret
  GOOGLE_LOGIN_REDIRECT_URI   — must match the URI registered in Google Cloud Console
  FRONTEND_URL                — where to redirect after login (e.g. http://localhost:5173)
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from fastapi import HTTPException


_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

_STATE_TTL_SECONDS = 600
_PENDING_STATES: dict[str, "_StatePayload"] = {}


class _StatePayload(TypedDict):
    created_at: str


def _cleanup_expired() -> None:
    now = datetime.now(timezone.utc)
    cutoff = timedelta(seconds=_STATE_TTL_SECONDS)
    expired = [
        s for s, p in _PENDING_STATES.items()
        if now - datetime.fromisoformat(p["created_at"]) > cutoff
    ]
    for s in expired:
        _PENDING_STATES.pop(s, None)


def _require_flow(client_id: str | None, client_secret: str | None, redirect_uri: str):
    """Build a google-auth-oauthlib Flow from explicit credentials (no file needed)."""
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "Google Login is not configured. "
                "Set GOOGLE_LOGIN_CLIENT_ID and GOOGLE_LOGIN_CLIENT_SECRET in your .env file."
            ),
        )
    try:
        from google_auth_oauthlib.flow import Flow
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Missing dependency: google-auth-oauthlib. Run `pip install google-auth-oauthlib`.",
        ) from exc

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=_SCOPES)
    flow.redirect_uri = redirect_uri
    return flow


class GoogleLoginService:
    """Orchestrates Google OAuth2 login: URL generation and callback handling."""

    def __init__(
        self,
        client_id: str | None,
        client_secret: str | None,
        redirect_uri: str,
        frontend_url: str,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri
        self._frontend_url = frontend_url.rstrip("/")

    # ------------------------------------------------------------------
    # Step 1 — Generate authorization URL
    # ------------------------------------------------------------------

    def build_authorization_url(self) -> tuple[str, str]:
        """Return (authorize_url, state).  Stores state for later validation."""
        _cleanup_expired()
        flow = _require_flow(self._client_id, self._client_secret, self._redirect_uri)
        state = secrets.token_urlsafe(32)
        authorize_url, _ = flow.authorization_url(
            state=state,
            access_type="offline",
            include_granted_scopes="true",
            prompt="select_account",
        )
        _PENDING_STATES[state] = {"created_at": datetime.now(timezone.utc).isoformat()}
        return authorize_url, state

    # ------------------------------------------------------------------
    # Step 2 — Exchange code for tokens and fetch user info
    # ------------------------------------------------------------------

    def exchange_code(self, *, code: str, state: str, authorization_response: str) -> dict:
        """Exchange the authorization code for an access token and return userinfo dict.

        Returns a dict with keys: sub, email, name, picture.
        Raises HTTPException on any error.
        """
        _cleanup_expired()

        if state not in _PENDING_STATES:
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
        _PENDING_STATES.pop(state, None)

        flow = _require_flow(self._client_id, self._client_secret, self._redirect_uri)

        # Google may return a superset of requested scopes (e.g. if the user previously
        # granted calendar/drive via the Sheets OAuth).  Relax oauthlib's strict scope
        # check so it logs a warning instead of raising an exception.
        import os
        os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

        flow.fetch_token(authorization_response=authorization_response, state=state)

        credentials = flow.credentials
        userinfo = self._fetch_userinfo(credentials.token)
        return userinfo

    @staticmethod
    def _fetch_userinfo(access_token: str) -> dict:
        """Call Google's userinfo endpoint with the access token."""
        try:
            import urllib.request
            import json

            req = urllib.request.Request(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch Google user info: {exc}",
            ) from exc

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def frontend_callback_url(self, token: str) -> str:
        """Build the frontend URL that carries the JWT after successful login."""
        return f"{self._frontend_url}/auth/callback?token={token}"

    def frontend_error_url(self, message: str) -> str:
        """Build the frontend URL for login errors."""
        from urllib.parse import quote
        return f"{self._frontend_url}/login?error={quote(message)}"
