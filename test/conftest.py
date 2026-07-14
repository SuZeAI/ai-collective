"""Shared pytest fixtures for backend API tests.

IMPORTANT: the env vars below must be set here, at import time, before any
``backend.api.*`` module is imported anywhere in the test session. Settings
(``backend/api/settings.py``) and the DI wiring (``backend/api/deps.py``) read
``os.environ`` exactly once, at module-import time, into process-wide
singletons (``settings = Settings()``, ``STORAGE_DIR = ...``, ``@lru_cache``
service getters) -- setting env vars later has no effect. Pytest imports this
conftest.py before collecting any test_*.py in this directory, so this is the
one safe place to do it.

Tests run against an isolated, throwaway JSON storage directory (never the
real ``storage/`` used by local dev) and with every LLM provider key forced
empty, so the suite never depends on network access, a real .env, or the
developer's local data -- it is deterministic in CI and on any machine.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import uuid

_TEST_STORAGE_DIR = tempfile.mkdtemp(prefix="ai_collective_test_storage_")

os.environ["STORAGE_BACKEND"] = "json"
os.environ["STORAGE_DIR"] = _TEST_STORAGE_DIR
os.environ["TASK_QUEUE_BACKEND"] = "memory"
os.environ["LOCK_BACKEND"] = "threading"
os.environ["SANDBOX_MODE"] = "local"
os.environ["FILE_STORAGE_BACKEND"] = "local"
os.environ["MINIO_ENABLED"] = "false"
os.environ["GRAPH_DB_BACKEND"] = "auto"
os.environ["NEO4J_URI"] = ""
os.environ["SEED_DEFAULT_DATA"] = "false"
os.environ["MCP_AUTO_SEED"] = "false"
os.environ["ADMIN_AUTO_SEED"] = "true"
os.environ["ADMIN_EMAIL"] = "test-admin@example.com"
os.environ["ADMIN_PASSWORD"] = "test-admin-password-123"
os.environ["ADMIN_NAME"] = "Test Admin"
os.environ["JWT_SECRET_KEY"] = "test-secret-not-for-production"
os.environ["ENVIRONMENT"] = "development"

# Force every LLM provider "unconfigured" so LLM-backed endpoints always take
# the graceful "not configured" path (503) instead of depending on network
# access or a real API key. See test_api_llm_unconfigured.py.
for _key in (
    "GOOGLE_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY",
    "KIMI_API_KEY", "GLM_API_KEY", "OPENROUTER_API_KEY",
):
    os.environ[_key] = ""

import pytest
from fastapi.testclient import TestClient

API = "/api/v1"


def unique(prefix: str = "t") -> str:
    """A short, collision-free suffix for names/emails created by a test."""
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_storage_dir():
    yield
    shutil.rmtree(_TEST_STORAGE_DIR, ignore_errors=True)


@pytest.fixture(scope="session")
def client():
    """One shared TestClient for the whole session (startup/shutdown fire once).

    Tests must use unique() names/emails so they don't collide with each other
    on the shared JSON store, and should delete anything they create.
    """
    from backend.api.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(client: TestClient) -> dict[str, str]:
    """Bearer token for the bootstrap admin account (shared 'default' scope)."""
    resp = client.post(
        f"{API}/auth/login",
        json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user_headers(client: TestClient) -> dict[str, str]:
    """Bearer token for a fresh, regular (non-admin) user, unique per test."""
    email = f"{unique('user')}@example.com"
    resp = client.post(
        f"{API}/auth/register",
        json={"name": "Test User", "email": email, "password": "test-password-123"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
