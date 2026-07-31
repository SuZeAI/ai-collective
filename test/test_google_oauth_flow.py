"""Tests for the per-user Google OAuth token path derivation in
backend.api.routers.auth: the storage key must be anchored on the
server-verified owner_id (never a client-supplied, possibly-blank email
hint alone), and the callback must prefer the email Google itself just
verified over that hint."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import googleapiclient.discovery

from backend.api.routers import auth as auth_module


# ── _get_token_path ──────────────────────────────────────────────────────────

def test_token_path_is_scoped_by_owner_id(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    path = auth_module._get_token_path("owner-1", "user@example.com", "calendar")
    assert path == str(Path("secrets") / "google" / "owner-1" / "calendar" / "token_user_example.com.json")


def test_token_path_differs_per_owner_for_same_email(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    path_a = auth_module._get_token_path("owner-a", "shared@example.com", "calendar")
    path_b = auth_module._get_token_path("owner-b", "shared@example.com", "calendar")
    assert path_a != path_b
    assert "owner-a" in path_a and "owner-b" not in path_a
    assert "owner-b" in path_b and "owner-a" not in path_b


def test_token_path_blank_email_still_separates_owners(monkeypatch, tmp_path):
    # No email hint at all (the common case) must not collapse different
    # owners onto one shared "default" file.
    monkeypatch.chdir(tmp_path)
    path_a = auth_module._get_token_path("owner-a", "", "calendar")
    path_b = auth_module._get_token_path("owner-b", "", "calendar")
    assert path_a != path_b
    assert path_a.endswith("token_default.json")
    assert path_b.endswith("token_default.json")


def test_token_path_differs_per_tool_for_same_owner(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    calendar_path = auth_module._get_token_path("owner-1", "user@example.com", "calendar")
    docs_path = auth_module._get_token_path("owner-1", "user@example.com", "docs")
    assert calendar_path != docs_path


def test_token_path_sanitizes_unsafe_characters(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    path = auth_module._get_token_path("owner/../1", "weird user!@example.com", "calendar")
    # "/" (the only char that could turn "owner/../1" into a real ".." path
    # segment) must be stripped, so the result stays a single directory name
    # confined under secrets/google/ rather than escaping it.
    root = (tmp_path / "secrets" / "google").resolve()
    resolved = Path(path).resolve()
    assert resolved == root or str(resolved).startswith(str(root) + "/")
    assert "!" not in path


# ── _google_sheet_oauth_callback_impl ────────────────────────────────────────

class _FakeCredentials:
    def to_json(self) -> str:
        return '{"token": "fake-access-token"}'


class _FakeFlow:
    def __init__(self):
        self.credentials = _FakeCredentials()

    def fetch_token(self, authorization_response: str) -> None:
        pass


def _pending_state(**overrides) -> dict:
    payload = {
        "status": "pending",
        "owner_id": "owner-1",
        "email": "hint@example.com",
        "tool_name": "calendar",
        "token_path": "unused-placeholder",
        "redirect_uri": "http://127.0.0.1:8000/api/v1/auth/oauth/callback",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "error": "",
    }
    payload.update(overrides)
    return payload


def _fake_request() -> SimpleNamespace:
    return SimpleNamespace(url="http://127.0.0.1:8000/api/v1/auth/oauth/callback?code=abc&state=xyz")


def test_callback_prefers_verified_email_over_hint(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(auth_module, "_create_google_oauth_flow", lambda: _FakeFlow())
    monkeypatch.setattr(auth_module, "save_token", lambda *_a, **_k: None)

    def _fake_build(service_name, version, credentials=None):
        assert service_name == "oauth2"
        return SimpleNamespace(
            userinfo=lambda: SimpleNamespace(
                get=lambda: SimpleNamespace(execute=lambda: {"email": "REAL@Example.com"})
            )
        )

    monkeypatch.setattr(googleapiclient.discovery, "build", _fake_build)

    state = "state-verified-email"
    auth_module._OAUTH_PENDING_STATES[state] = _pending_state()

    resp = auth_module._google_sheet_oauth_callback_impl(request=_fake_request(), code="abc", state=state)

    assert resp.status_code == 200
    payload = auth_module._OAUTH_PENDING_STATES[state]
    assert payload["status"] == "authorized"
    assert payload["email"] == "real@example.com"  # verified email wins over "hint@example.com", lowercased
    assert "owner-1" in payload["token_path"]
    assert "real_example.com" in payload["token_path"]


def test_callback_falls_back_to_hint_when_userinfo_fails(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(auth_module, "_create_google_oauth_flow", lambda: _FakeFlow())
    monkeypatch.setattr(auth_module, "save_token", lambda *_a, **_k: None)

    def _broken_build(*_a, **_k):
        raise RuntimeError("userinfo endpoint unreachable")

    monkeypatch.setattr(googleapiclient.discovery, "build", _broken_build)

    state = "state-userinfo-fails"
    auth_module._OAUTH_PENDING_STATES[state] = _pending_state(email="hint@example.com")

    resp = auth_module._google_sheet_oauth_callback_impl(request=_fake_request(), code="abc", state=state)

    assert resp.status_code == 200
    payload = auth_module._OAUTH_PENDING_STATES[state]
    assert payload["status"] == "authorized"
    assert payload["email"] == "hint@example.com"


def test_callback_persists_token_via_save_token(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(auth_module, "_create_google_oauth_flow", lambda: _FakeFlow())

    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(auth_module, "save_token", lambda path, token_json: calls.append((path, token_json)))
    monkeypatch.setattr(googleapiclient.discovery, "build", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError()))

    state = "state-save-token"
    auth_module._OAUTH_PENDING_STATES[state] = _pending_state(owner_id="owner-42", email="", tool_name="drive")

    auth_module._google_sheet_oauth_callback_impl(request=_fake_request(), code="abc", state=state)

    assert len(calls) == 1
    path, token_json = calls[0]
    assert "owner-42" in path
    assert "drive" in path
    assert token_json == '{"token": "fake-access-token"}'


def test_callback_missing_state_errors(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        auth_module._google_sheet_oauth_callback_impl(request=_fake_request(), code="abc", state=None)
    assert exc_info.value.status_code == 400


def test_callback_unknown_state_errors(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        auth_module._google_sheet_oauth_callback_impl(
            request=_fake_request(), code="abc", state="never-seen-state"
        )
    assert exc_info.value.status_code == 400
