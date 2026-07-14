"""API tests for /tasks.

Includes regression coverage for a bug found during a manual full-system pass
(2026-07-12): POST /tasks read `req.teamId` / `req.assignedAgents`, which do
not exist on UpsertTaskRequest (the real fields are `departmentId` /
`assignedStaff`), so every single task create/update crashed with a 500. Fixed
in backend/api/routers/tasks.py. These tests fail again if that regresses.
"""

from __future__ import annotations

from conftest import API, unique


def _make_department(client, headers) -> str:
    resp = client.post(
        f"{API}/departments",
        json={"name": unique("dept"), "description": "", "staff": [], "mode": "sequential", "maxSteps": 6},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _make_staff(client, headers) -> str:
    resp = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Tester", "description": "", "skill_ids": []},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_create_task_round_trips_department_and_assigned_staff(client, user_headers):
    department_id = _make_department(client, user_headers)
    staff_id = _make_staff(client, user_headers)

    resp = client.post(
        f"{API}/tasks",
        json={
            "title": "Write the quarterly report",
            "description": "desc",
            "departmentId": department_id,
            "assignedStaff": [staff_id],
            "status": "pending",
            "priority": "high",
        },
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["departmentId"] == department_id
    assert body["assignedStaff"] == [staff_id]
    assert body["priority"] == "high"

    listed = client.get(f"{API}/tasks", headers=user_headers)
    assert any(t["id"] == body["id"] for t in listed.json())

    deleted = client.delete(f"{API}/tasks/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_create_task_with_invalid_status_returns_422_not_500(client, user_headers):
    department_id = _make_department(client, user_headers)

    resp = client.post(
        f"{API}/tasks",
        json={"title": "Bad status task", "departmentId": department_id, "status": "todo"},
        headers=user_headers,
    )
    assert resp.status_code == 422
    assert "todo" in resp.json()["detail"]


def test_create_task_with_invalid_priority_falls_back_to_medium(client, user_headers):
    department_id = _make_department(client, user_headers)

    resp = client.post(
        f"{API}/tasks",
        json={"title": "Weird priority", "departmentId": department_id, "priority": "urgentest"},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["priority"] == "medium"


def test_task_status_transition_to_completed_sets_end_time(client, user_headers):
    department_id = _make_department(client, user_headers)

    created = client.post(
        f"{API}/tasks",
        json={"title": "Finish me", "departmentId": department_id, "status": "in-progress"},
        headers=user_headers,
    ).json()
    assert created["startTime"] is not None
    assert created["endTime"] is None

    completed = client.post(
        f"{API}/tasks",
        json={"id": created["id"], "title": created["title"], "departmentId": department_id, "status": "completed"},
        headers=user_headers,
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["endTime"] is not None


def test_tasks_are_scoped_per_owner(client):
    email_a = f"{unique('owner-a')}@example.com"
    email_b = f"{unique('owner-b')}@example.com"
    token_a = client.post(
        f"{API}/auth/register", json={"name": "A", "email": email_a, "password": "password123"}
    ).json()["access_token"]
    token_b = client.post(
        f"{API}/auth/register", json={"name": "B", "email": email_b, "password": "password123"}
    ).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    department_id = _make_department(client, headers_a)
    task = client.post(
        f"{API}/tasks",
        json={"title": "Only A should see this", "departmentId": department_id},
        headers=headers_a,
    ).json()

    ids_for_b = {t["id"] for t in client.get(f"{API}/tasks", headers=headers_b).json()}
    assert task["id"] not in ids_for_b

    ids_for_a = {t["id"] for t in client.get(f"{API}/tasks", headers=headers_a).json()}
    assert task["id"] in ids_for_a
