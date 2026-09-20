"""API tests for /tasks.

Includes regression coverage for a bug found during a manual full-system pass
(2026-07-12): POST /tasks read `req.teamId` / `req.assignedAgents`, which do
not exist on UpsertTaskRequest (the real fields are `departmentId` /
`assignedStaff`), so every single task create/update crashed with a 500. Fixed
in server/api/routers/tasks.py. These tests fail again if that regresses.
"""

from __future__ import annotations

from conftest import API, make_department, make_staff


def test_create_task_round_trips_department_and_assigned_staff(client, user_headers):
    department_id = make_department(client, user_headers)["id"]
    staff_id = make_staff(client, user_headers)["id"]

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
    department_id = make_department(client, user_headers)["id"]

    resp = client.post(
        f"{API}/tasks",
        json={"title": "Bad status task", "departmentId": department_id, "status": "todo"},
        headers=user_headers,
    )
    assert resp.status_code == 422
    assert "todo" in resp.json()["detail"]


def test_create_task_with_invalid_priority_falls_back_to_medium(client, user_headers):
    department_id = make_department(client, user_headers)["id"]

    resp = client.post(
        f"{API}/tasks",
        json={"title": "Weird priority", "departmentId": department_id, "priority": "urgentest"},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["priority"] == "medium"


def test_task_status_transition_to_completed_sets_end_time(client, user_headers):
    department_id = make_department(client, user_headers)["id"]

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


def test_task_restart_from_completed_appends_session_divider_and_resets_progress(client, user_headers):
    department_id = make_department(client, user_headers)["id"]

    created = client.post(
        f"{API}/tasks",
        json={"title": "Restart me", "departmentId": department_id, "status": "in-progress", "progress": 80},
        headers=user_headers,
    ).json()

    completed = client.post(
        f"{API}/tasks",
        json={"id": created["id"], "title": created["title"], "departmentId": department_id, "status": "completed"},
        headers=user_headers,
    ).json()
    assert completed["endTime"] is not None

    restarted = client.post(
        f"{API}/tasks",
        json={
            "id": created["id"],
            "title": created["title"],
            "departmentId": department_id,
            "status": "in-progress",
            "progress": 80,
        },
        headers=user_headers,
    )
    assert restarted.status_code == 200, restarted.text
    body = restarted.json()
    assert body["progress"] == 0
    assert body["endTime"] is None
    assert body["startTime"] is not None

    messages = client.get(f"{API}/meetings", params={"task_id": created["id"]}, headers=user_headers).json()
    dividers = [m for m in messages if m["staffId"] == "system" and "New session started" in m["content"]]
    assert len(dividers) == 1


def test_task_resume_from_paused_preserves_start_time_and_progress(client, user_headers):
    department_id = make_department(client, user_headers)["id"]

    created = client.post(
        f"{API}/tasks",
        json={"title": "Pause me", "departmentId": department_id, "status": "in-progress", "progress": 40},
        headers=user_headers,
    ).json()

    paused = client.post(
        f"{API}/tasks",
        json={"id": created["id"], "title": created["title"], "departmentId": department_id, "status": "paused", "progress": 40},
        headers=user_headers,
    ).json()
    assert paused["status"] == "paused"

    resumed = client.post(
        f"{API}/tasks",
        json={"id": created["id"], "title": created["title"], "departmentId": department_id, "status": "in-progress", "progress": 40},
        headers=user_headers,
    )
    assert resumed.status_code == 200, resumed.text
    body = resumed.json()
    assert body["progress"] == 40
    assert body["startTime"] == created["startTime"]

    messages = client.get(f"{API}/meetings", params={"task_id": created["id"]}, headers=user_headers).json()
    dividers = [m for m in messages if m["staffId"] == "system" and "New session started" in m["content"]]
    assert len(dividers) == 0


def test_tasks_are_scoped_per_owner(client, user_headers, second_user_headers):
    headers_a = user_headers
    headers_b = second_user_headers

    department_id = make_department(client, headers_a)["id"]
    task = client.post(
        f"{API}/tasks",
        json={"title": "Only A should see this", "departmentId": department_id},
        headers=headers_a,
    ).json()

    ids_for_b = {t["id"] for t in client.get(f"{API}/tasks", headers=headers_b).json()}
    assert task["id"] not in ids_for_b

    ids_for_a = {t["id"] for t in client.get(f"{API}/tasks", headers=headers_a).json()}
    assert task["id"] in ids_for_a
