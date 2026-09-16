"""Bot Framework JWT verification, shared by Teams and Skype inbound webhooks.

Azure Bot Service signs every inbound Activity request with a JWT in the
``Authorization`` header, issued by ``https://api.botframework.com`` and
signed by RS256 keys published at Bot Framework's JWKS endpoint. Verifying
that signature — rather than accepting any POST that matches the Activity
JSON shape — is the only way to confirm an inbound message actually came from
Azure Bot Service and not a forged request.
"""

from __future__ import annotations

from typing import Optional

import jwt
from jwt import PyJWKClient

BOT_FRAMEWORK_ISSUER = "https://api.botframework.com"
BOT_FRAMEWORK_JWKS_URL = "https://login.botframework.com/v1/.well-known/keys"

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(BOT_FRAMEWORK_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwks_client


def verify_bot_framework_token(authorization_header: str, expected_audience: str | None = None) -> bool:
    """Verify a Bot Framework ``Authorization: Bearer <jwt>`` header.

    Checks signature (against Microsoft's published JWKS), issuer, expiry,
    and — when the bot's app id is configured — audience. Returns False on
    any failure (missing header, expired/invalid signature, wrong issuer,
    JWKS fetch failure) rather than raising, so callers can treat it as a
    simple accept/reject gate.
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        return False
    token = authorization_header.split(" ", 1)[1].strip()
    if not token:
        return False
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=BOT_FRAMEWORK_ISSUER,
            audience=expected_audience or None,
            options={"verify_aud": bool(expected_audience)},
        )
        return True
    except Exception:
        return False
