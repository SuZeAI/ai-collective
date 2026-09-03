"""API tests for /staff and /departments."""

from __future__ import annotations

from conftest import API, unique


def test_create_staff_and_list(client, user_headers):
    resp = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Researcher", "description": "digs up facts", "skill_ids": []},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["role"] == "Researcher"
    assert body["status"] == "idle"

    listed = client.get(f"{API}/staff", headers=user_headers)
    assert any(s["id"] == body["id"] for s in listed.json())

    deleted = client.delete(f"{API}/staff/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_create_department_with_staff_members(client, user_headers):
    staff = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Writer", "description": "", "skill_ids": []},
        headers=user_headers,
    ).json()

    resp = client.post(
        f"{API}/departments",
        json={
            "name": "Content Team",
            "description": "writes things",
            "staff": [staff["id"]],
            "mode": "mesh",
            "maxSteps": 8,
        },
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["staff"] == [staff["id"]]
    assert body["mode"] == "mesh"
    assert body["maxSteps"] == 8

    deleted = client.delete(f"{API}/departments/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_department_requires_staff_field(client, user_headers):
    resp = client.post(f"{API}/departments", json={"name": "No staff field"}, headers=user_headers)
    assert resp.status_code == 422
