"""Tests for the project-scoped sandbox workspace.

Verifies the fix from the "staff need a shared per-project workspace" pass:
tasks that belong to the same project resolve to ONE shared sandbox workspace
(server/infra/sandbox/sandbox_session.py: workspace_thread_id), while
project-less tasks keep today's private per-task workspace. Also covers the
delete_task sibling-check fix (server/api/routers/tasks.py) that stops
deleting one task from destroying a shared project workspace sibling tasks
still need.

These tests call the sandbox_session module directly (not through a real LLM
run) since the test harness runs with no LLM provider key configured (see
conftest.py) -- the mechanism under test is a pure function of
task_id/project_id, not LLM tool-calling.
"""
from __future__ import annotations

import os
import shutil

from conftest import API, make_department, unique


def _make_project(client, headers, **overrides) -> dict:
    payload = {"key": unique("PSB").upper()[:10], "name": "Project Sandbox Test"}
    payload.update(overrides)
    resp = client.post(f"{API}/projects", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _make_task(client, headers, *, department_id: str, project_id: str = "", **overrides) -> dict:
    payload = {"title": unique("task"), "departmentId": department_id, "projectId": project_id}
    payload.update(overrides)
    resp = client.post(f"{API}/tasks", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_tasks_in_same_project_share_one_sandbox_workspace(client, user_headers):
    from server.infra.sandbox.sandbox_session import ensure_workspace_for, workspace_thread_id

    department_id = make_department(client, user_headers)["id"]
    project = _make_project(client, user_headers)
    task_a = _make_task(client, user_headers, department_id=department_id, project_id=project["id"])
    task_b = _make_task(client, user_headers, department_id=department_id, project_id=project["id"])

    thread_a = workspace_thread_id(task_id=task_a["id"], project_id=project["id"])
    thread_b = workspace_thread_id(task_id=task_b["id"], project_id=project["id"])
    assert thread_a == thread_b

    ws_a = ensure_workspace_for(task_id=task_a["id"], project_id=project["id"])
    ws_b = ensure_workspace_for(task_id=task_b["id"], project_id=project["id"])
    assert ws_a == ws_b

    try:
        with open(os.path.join(ws_a, "shared_report.txt"), "w", encoding="utf-8") as f:
            f.write("written by task A's staff")
        assert os.path.exists(os.path.join(ws_b, "shared_report.txt"))
    finally:
        shutil.rmtree(ws_a, ignore_errors=True)
        client.delete(f"{API}/tasks/{task_a['id']}", headers=user_headers)
        client.delete(f"{API}/tasks/{task_b['id']}", headers=user_headers)
        client.delete(f"{API}/projects/{project['id']}", headers=user_headers)


def test_project_less_task_keeps_private_sandbox_workspace(client, user_headers):
    from server.infra.sandbox.sandbox_session import meeting_thread_id, workspace_thread_id

    department_id = make_department(client, user_headers)["id"]
    task_a = _make_task(client, user_headers, department_id=department_id)
    task_b = _make_task(client, user_headers, department_id=department_id)

    try:
        # No project -> falls back to today's per-task conv-<hash(task_id)>
        # id, byte-identical to pre-change behavior.
        assert workspace_thread_id(task_id=task_a["id"], project_id=None) == meeting_thread_id(task_a["id"])
        assert workspace_thread_id(task_id=task_a["id"], project_id="") == meeting_thread_id(task_a["id"])
        assert workspace_thread_id(task_id=task_a["id"], project_id=None) != workspace_thread_id(
            task_id=task_b["id"], project_id=None
        )
    finally:
        client.delete(f"{API}/tasks/{task_a['id']}", headers=user_headers)
        client.delete(f"{API}/tasks/{task_b['id']}", headers=user_headers)


def test_delete_task_with_sibling_does_not_destroy_shared_workspace(client, user_headers):
    from server.infra.sandbox.sandbox_session import ensure_workspace_for

    department_id = make_department(client, user_headers)["id"]
    project = _make_project(client, user_headers)
    task_a = _make_task(client, user_headers, department_id=department_id, project_id=project["id"])
    task_b = _make_task(client, user_headers, department_id=department_id, project_id=project["id"])

    ws = ensure_workspace_for(task_id=task_a["id"], project_id=project["id"])
    marker = os.path.join(ws, "task_a_output.txt")
    with open(marker, "w", encoding="utf-8") as f:
        f.write("task A's output")

    try:
        # Deleting task A while task B (same project) still exists must NOT
        # destroy the shared workspace task B still needs.
        resp = client.delete(f"{API}/tasks/{task_a['id']}", headers=user_headers)
        assert resp.status_code == 200
        assert os.path.exists(marker), "sibling task's shared workspace was wrongly destroyed"

        # Deleting the last remaining task in the project DOES tear the
        # shared workspace down.
        resp = client.delete(f"{API}/tasks/{task_b['id']}", headers=user_headers)
        assert resp.status_code == 200
        assert not os.path.exists(marker), "last-task-in-project delete should clean up the shared workspace"
    finally:
        shutil.rmtree(ws, ignore_errors=True)
        client.delete(f"{API}/projects/{project['id']}", headers=user_headers)
