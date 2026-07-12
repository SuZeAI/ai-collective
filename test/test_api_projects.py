"""API tests for /projects, /epics, /sprints.

Includes a regression test for a bug found during a manual full-system pass
(2026-07-12): POST /projects read `req.plannerAgentId`, which does not exist
on UpsertProjectRequest (the real field is `plannerStaffId`), so every single
project create/update crashed with a 500. Fixed in
backend/api/routers/projects.py.
"""

from __future__ import annotations

from conftest import API, unique


def _make_staff(client, headers) -> str:
    resp = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Planner", "description": "", "skill_ids": []},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_create_project_round_trips_planner_staff_id(client, user_headers):
    staff_id = _make_staff(client, user_headers)
    key = unique("PRJ").upper()[:10]

    resp = client.post(
        f"{API}/projects",
        json={"key": key, "name": "Test Project", "description": "d", "plannerStaffId": staff_id},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["key"] == key
    assert body["plannerStaffId"] == staff_id
    assert body["issueCounter"] == 0

    deleted = client.delete(f"{API}/projects/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_project_requires_key(client, user_headers):
    resp = client.post(f"{API}/projects", json={"key": "", "name": "No key"}, headers=user_headers)
    assert resp.status_code == 422


def test_project_key_must_be_unique_within_scope(client, user_headers):
    key = unique("DUP").upper()[:10]
    first = client.post(f"{API}/projects", json={"key": key, "name": "First"}, headers=user_headers)
    assert first.status_code == 200

    second = client.post(f"{API}/projects", json={"key": key, "name": "Second"}, headers=user_headers)
    assert second.status_code == 409


def test_epic_and_sprint_reference_project_and_allocate_issue_keys(client, user_headers):
    key = unique("EPC").upper()[:10]
    project = client.post(f"{API}/projects", json={"key": key, "name": "P"}, headers=user_headers).json()

    epic = client.post(
        f"{API}/epics",
        json={"projectId": project["id"], "title": "Epic One", "description": "d"},
        headers=user_headers,
    )
    assert epic.status_code == 200, epic.text
    assert epic.json()["projectId"] == project["id"]

    sprint = client.post(
        f"{API}/sprints",
        json={"projectId": project["id"], "name": "Sprint 1"},
        headers=user_headers,
    )
    assert sprint.status_code == 200, sprint.text
    assert sprint.json()["projectId"] == project["id"]

    department = client.post(
        f"{API}/departments",
        json={"name": unique("dept"), "staff": [], "mode": "sequential", "maxSteps": 6},
        headers=user_headers,
    ).json()

    task1 = client.post(
        f"{API}/tasks",
        json={"title": "First issue", "departmentId": department["id"], "projectId": project["id"]},
        headers=user_headers,
    ).json()
    task2 = client.post(
        f"{API}/tasks",
        json={"title": "Second issue", "departmentId": department["id"], "projectId": project["id"]},
        headers=user_headers,
    ).json()
    # Issue keys are `<PROJECT_KEY>-<n>`, allocated once from a shared,
    # project-wide counter -- the epic created above already consumed one
    # number, so tasks pick up where it left off rather than starting at 1.
    assert epic.json()["key"].startswith(f"{key}-")
    epic_n = int(epic.json()["key"].rsplit("-", 1)[1])
    assert task1["issueKey"] == f"{key}-{epic_n + 1}"
    assert task2["issueKey"] == f"{key}-{epic_n + 2}"

    epic_delete = client.delete(f"{API}/epics/{epic.json()['id']}", headers=user_headers)
    assert epic_delete.status_code == 200
    sprint_delete = client.delete(f"{API}/sprints/{sprint.json()['id']}", headers=user_headers)
    assert sprint_delete.status_code == 200
