"""Independent pre-launch readiness checks.

Written fresh from reading the route/domain code directly (server/api/deps/auth.py,
server/api/routers/{companies,staff,skills,tasks}.py, server/domain/models.py) rather
than from existing test files, to avoid inheriting any blind spots already baked into
test_api_staff_skill_ownership.py / test_api_guest_write_blocked.py / etc.

Each test asserts the behavior a public, multi-tenant deployment requires: anonymous
writes are rejected, one user's private data is invisible to another user, and a
skill's config (which may hold secrets) never crosses an ownership boundary.
"""

from __future__ import annotations

from test.conftest import API, make_department, make_staff, make_task, unique


# ---------------------------------------------------------------------------
# Guest (unauthenticated) access
# ---------------------------------------------------------------------------


def test_guest_get_companies_succeeds(client):
    resp = client.get(f"{API}/companies")
    assert resp.status_code == 200


def test_guest_post_company_rejected(client):
    resp = client.post(f"{API}/companies", json={"name": unique("guest-co"), "type": "general"})
    assert resp.status_code == 401


def test_guest_post_staff_rejected(client):
    resp = client.post(
        f"{API}/staff",
        json={"name": unique("guest-staff"), "role": "x", "description": "", "skill_ids": []},
    )
    assert resp.status_code == 401


def test_guest_delete_task_rejected(client):
    resp = client.delete(f"{API}/tasks/some-nonexistent-id")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Cross-user ownership isolation
# ---------------------------------------------------------------------------


def test_user_cannot_list_another_users_company(client, user_headers, second_user_headers):
    name = unique("private-co")
    resp = client.post(f"{API}/companies", json={"name": name, "type": "general"}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    company_id = resp.json()["id"]

    listed_ids = {c["id"] for c in client.get(f"{API}/companies", headers=second_user_headers).json()}
    assert company_id not in listed_ids


def test_user_cannot_fetch_another_users_staff_by_id(client, user_headers, second_user_headers):
    staff = make_staff(client, user_headers)

    listed_ids = {s["id"] for s in client.get(f"{API}/staff", headers=second_user_headers).json()}
    assert staff["id"] not in listed_ids


def test_user_cannot_delete_another_users_task(client, user_headers, second_user_headers):
    dept = make_department(client, user_headers)
    task = make_task(client, user_headers, department_id=dept["id"])

    resp = client.delete(f"{API}/tasks/{task['id']}", headers=second_user_headers)
    assert resp.status_code in (403, 404)

    # confirm it still exists for the actual owner
    still_there = {t["id"] for t in client.get(f"{API}/tasks", headers=user_headers).json()}
    assert task["id"] in still_there


def test_user_cannot_overwrite_another_users_staff_via_upsert_with_id(client, user_headers, second_user_headers):
    staff = make_staff(client, user_headers, name="original-name")

    resp = client.post(
        f"{API}/staff",
        json={
            "id": staff["id"],
            "name": "hijacked-name",
            "role": "x",
            "description": "",
            "skill_ids": [],
        },
        headers=second_user_headers,
    )
    assert resp.status_code in (403, 404)

    unchanged = client.get(f"{API}/staff", headers=user_headers).json()
    match = next(s for s in unchanged if s["id"] == staff["id"])
    assert match["name"] == "original-name"


# ---------------------------------------------------------------------------
# Skill config leak (secret-bearing config must never cross owner boundary)
# ---------------------------------------------------------------------------


def _make_skill_with_secret(client, headers, *, secret_value: str) -> dict:
    resp = client.post(
        f"{API}/skills",
        json={
            "name": unique("secret-skill"),
            "description": "",
            "tool_name": "http_client",
            "kind": "integration",
            "config": {"api_key": secret_value},
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_skill_config_not_visible_via_list_skills_to_other_owner(client, user_headers, second_user_headers):
    secret = "sk-should-not-leak-123"
    skill = _make_skill_with_secret(client, user_headers, secret_value=secret)

    other_view = client.get(f"{API}/skills", headers=second_user_headers).json()
    assert all(s["id"] != skill["id"] for s in other_view)


def test_staff_cannot_be_equipped_with_another_owners_skill(client, user_headers, second_user_headers):
    secret = "sk-should-not-leak-456"
    skill = _make_skill_with_secret(client, user_headers, secret_value=secret)

    # second user tries to attach the first user's private skill to their own staff
    staff = make_staff(client, second_user_headers, skill_ids=[skill["id"]])
    assert skill["id"] not in staff.get("skill_ids", [])

    # and it must not show up nested in GET /staff either, config or not
    listed = client.get(f"{API}/staff", headers=second_user_headers).json()
    mine = next(s for s in listed if s["id"] == staff["id"])
    nested_skill_ids = {sk["id"] for sk in mine.get("skills", [])}
    assert skill["id"] not in nested_skill_ids


# ---------------------------------------------------------------------------
# Admin shared-scope semantics (documented contract: admin writes land in the
# shared "default" scope, visible to and usable as a template by every user)
# ---------------------------------------------------------------------------


def test_admin_created_staff_is_visible_to_regular_users(client, admin_headers, user_headers):
    staff = make_staff(client, admin_headers, name=unique("shared-staff"))

    listed_ids = {s["id"] for s in client.get(f"{API}/staff", headers=user_headers).json()}
    assert staff["id"] in listed_ids


def test_regular_user_cannot_delete_admins_shared_staff(client, admin_headers, user_headers):
    staff = make_staff(client, admin_headers, name=unique("shared-staff-2"))

    resp = client.delete(f"{API}/staff/{staff['id']}", headers=user_headers)
    assert resp.status_code in (403, 404)
