"""API tests for /planner/commit.

Regression coverage for a bug found during a manual full-system pass
(2026-07-12): PlannerCommitRequest's field was named `teamId`, but the
frontend (ui/src/lib/api.ts `plannerCommit`) sends `departmentId` -- extra JSON
fields are silently ignored by Pydantic, so every planner-committed task
silently got `department_id=""` (unassigned) instead of crashing. Fixed by
renaming the schema field to `departmentId` in server/api/schemas/planner.py
(and the one read site in server/api/routers/planner.py).

/planner/decompose is not covered here since it requires a configured LLM
provider (this test session forces every provider key empty) -- it is only
reachable via a live 200/503, exercised in test_api_llm_unconfigured.py.
"""

from __future__ import annotations

from conftest import API, unique


def test_planner_commit_assigns_department_id(client, user_headers):
    key = unique("PLN").upper()[:10]
    project = client.post(f"{API}/projects", json={"key": key, "name": "Planner Project"}, headers=user_headers).json()
    department = client.post(
        f"{API}/departments",
        json={"name": unique("dept"), "staff": [], "mode": "sequential", "maxSteps": 6},
        headers=user_headers,
    ).json()

    resp = client.post(
        f"{API}/planner/commit",
        json={
            "projectId": project["id"],
            "departmentId": department["id"],
            "issues": [
                {"title": "Issue A", "type": "task", "description": "d"},
                {"title": "Issue B", "type": "bug", "description": "d"},
            ],
        },
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    tasks = resp.json()
    assert len(tasks) == 2
    for task in tasks:
        assert task["departmentId"] == department["id"], (
            "planner-committed task was not assigned to the requested department -- "
            "this is the teamId/departmentId field-name regression"
        )
        assert task["projectId"] == project["id"]
        assert task["issueKey"].startswith(f"{key}-")


def test_planner_commit_rejects_unknown_project(client, user_headers):
    resp = client.post(
        f"{API}/planner/commit",
        json={"projectId": "project_does_not_exist", "issues": [{"title": "X"}]},
        headers=user_headers,
    )
    assert resp.status_code == 404
