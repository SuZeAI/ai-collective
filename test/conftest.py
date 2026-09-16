"""Shared pytest fixtures for backend API tests.

IMPORTANT: the config override below must be written and pointed to via
CONFIG_OVERRIDE_FILE here, at import time, before any ``server.api.*`` module
is imported anywhere in the test session. Settings (``server/api/settings.py``)
and the DI wiring (``server/api/deps.py``) read config exactly once, at
module-import time, into process-wide singletons (``settings = Settings()``,
``@lru_cache`` service getters) -- setting it later has no effect. Pytest
imports this conftest.py before collecting any test_*.py in this directory, so
this is the one safe place to do it.

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

import yaml

_TEST_STORAGE_DIR = tempfile.mkdtemp(prefix="ai_collective_test_storage_")
_ADMIN_EMAIL = "test-admin@example.com"
_ADMIN_PASSWORD = "test-admin-password-123"

# config.yml is the single source of app config; this deep-merges a handful of
# ops knobs on top of it (via CONFIG_OVERRIDE_FILE, see config_loader.load_config)
# instead of the real mongo/rabbitmq/redis/admin values, without duplicating
# the whole file.
_override = {
    "app": {"environment": "development"},
    "logging": {"log_file": False},  # avoid writing to the repo's shared logs/ dir
    "storage": {"backend": "json", "dir": _TEST_STORAGE_DIR, "file_backend": "local"},
    "task_queue": {"backend": "memory"},
    "lock": {"backend": "threading"},
    "sandbox": {"mode": "local"},
    "graph": {"backend": "auto", "neo4j_uri": ""},
    "seed": {"default_data": False},
    "mcp": {"auto_seed": False},
    "admin": {
        "auto_seed": True,
        "email": _ADMIN_EMAIL,
        "password": _ADMIN_PASSWORD,
        "name": "Test Admin",
    },
    "auth": {"jwt_secret_key": "test-secret-not-for-production"},
}
_override_path = os.path.join(_TEST_STORAGE_DIR, "_test_config_override.yml")
with open(_override_path, "w", encoding="utf-8") as _f:
    yaml.safe_dump(_override, _f)
os.environ["CONFIG_OVERRIDE_FILE"] = _override_path

# Force every LLM provider "unconfigured" so LLM-backed endpoints always take
# the graceful "not configured" path (503) instead of depending on network
# access or a real API key. config.yml's `models:` entries reference these as
# ${VAR}, so blanking them here still reaches ModelConfig.api_key via
# load_config()'s env expansion. See test_api_llm_unconfigured.py.
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
    from server.api.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(client: TestClient) -> dict[str, str]:
    """Bearer token for the bootstrap admin account (shared 'default' scope)."""
    resp = client.post(
        f"{API}/auth/login",
        json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD},
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


@pytest.fixture
def second_user_headers(client: TestClient) -> dict[str, str]:
    """Bearer token for a second, distinct regular user, unique per test.

    Pairs with ``user_headers`` for tests that need two accounts (ownership
    scoping, cross-user access checks) without hand-rolling a registration.
    """
    email = f"{unique('user2')}@example.com"
    resp = client.post(
        f"{API}/auth/register",
        json={"name": "Test User 2", "email": email, "password": "test-password-123"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_staff(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str | None = None,
    role: str = "Tester",
    description: str = "",
    skill_ids: list[str] | None = None,
    **overrides,
) -> dict:
    """Create a staff via the API and return the response body."""
    payload = {
        "name": name or unique("staff"),
        "role": role,
        "description": description,
        "skill_ids": skill_ids or [],
    }
    payload.update(overrides)
    resp = client.post(f"{API}/staff", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def make_department(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str | None = None,
    staff: list[str] | None = None,
    mode: str = "sequential",
    max_steps: int = 6,
    **overrides,
) -> dict:
    """Create a department via the API and return the response body."""
    payload = {
        "name": name or unique("dept"),
        "description": "",
        "staff": staff or [],
        "mode": mode,
        "maxSteps": max_steps,
    }
    payload.update(overrides)
    resp = client.post(f"{API}/departments", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def make_task(
    client: TestClient,
    headers: dict[str, str],
    *,
    department_id: str,
    title: str | None = None,
    **overrides,
) -> dict:
    """Create a task via the API and return the response body."""
    payload = {"title": title or unique("task"), "departmentId": department_id}
    payload.update(overrides)
    resp = client.post(f"{API}/tasks", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()
