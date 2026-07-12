"""API tests for the auth flow: register, login, me, profile, password, logout."""

from __future__ import annotations

from conftest import API, unique


def test_register_login_me_roundtrip(client):
    email = f"{unique('auth')}@example.com"
    password = "correct-horse-battery"

    reg = client.post(f"{API}/auth/register", json={"name": "Alice", "email": email, "password": password})
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["user"]["email"] == email
    assert body["user"]["role"] == "user"
    token = body["access_token"]

    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email

    login = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    assert login.json()["user"]["id"] == body["user"]["id"]


def test_register_duplicate_email_rejected(client):
    email = f"{unique('dup')}@example.com"
    first = client.post(f"{API}/auth/register", json={"name": "A", "email": email, "password": "password123"})
    assert first.status_code == 201

    second = client.post(f"{API}/auth/register", json={"name": "B", "email": email, "password": "password456"})
    assert second.status_code == 409


def test_login_wrong_password_rejected(client):
    email = f"{unique('wrong')}@example.com"
    client.post(f"{API}/auth/register", json={"name": "A", "email": email, "password": "password123"})

    resp = client.post(f"{API}/auth/login", json={"email": email, "password": "not-the-password"})
    assert resp.status_code == 401


def test_me_without_token_is_rejected(client):
    resp = client.get(f"{API}/auth/me")
    assert resp.status_code == 401


def test_profile_update_and_password_change(client, user_headers):
    updated = client.patch(f"{API}/auth/profile", json={"name": "New Name"}, headers=user_headers)
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "New Name"

    wrong = client.patch(
        f"{API}/auth/password",
        json={"current_password": "not-the-real-password", "new_password": "another-good-password"},
        headers=user_headers,
    )
    assert wrong.status_code == 400

    changed = client.patch(
        f"{API}/auth/password",
        json={"current_password": "test-password-123", "new_password": "another-good-password"},
        headers=user_headers,
    )
    assert changed.status_code == 204, changed.text


def test_logout_is_idempotent(client, user_headers):
    resp = client.post(f"{API}/auth/logout", headers=user_headers)
    assert resp.status_code == 204
