"""Shared login helper for manual smoke scripts.

Logging in as the real seeded admin puts every created Company/Staff/Skill
into the shared DEFAULT_OWNER_ID scope (see server/api/deps/auth.py -- any
"admin"/"system" user acts there), which every real user also sees by
default. None of the smoke scripts call admin-only endpoints, so they use a
dedicated, private smoke-test account instead, keeping their throwaway data
out of everyone else's default view.

Usage: from _smoke_auth import BASE, get_session
"""
import os

import requests

BASE = os.environ.get("BASE_URL", "http://localhost:2026/api/v1")
SMOKE_EMAIL = os.environ.get("SMOKE_EMAIL", "smoketest@aicollective.com")
SMOKE_PASSWORD = os.environ.get("SMOKE_PASSWORD", "SmokeTest@12345")
SMOKE_NAME = "Smoke Test Runner"


def get_session() -> tuple[requests.Session, dict]:
    """Register (or log into, if already registered) the dedicated smoke-test
    user and return (session, auth_headers)."""
    s = requests.Session()
    r = s.post(
        f"{BASE}/auth/register",
        json={"name": SMOKE_NAME, "email": SMOKE_EMAIL, "password": SMOKE_PASSWORD},
    )
    if r.status_code == 409:
        r = s.post(f"{BASE}/auth/login", json={"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD})
    r.raise_for_status()
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return s, headers
