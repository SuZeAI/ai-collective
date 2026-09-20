"""Ad-hoc live baseline check (not collected by pytest) for the project-scoped
sandbox work. Run directly: `PYTHONPATH=. python test/manual/verify_project_sandbox_baseline.py`.

Uses the same isolated-storage-override trick as test/conftest.py (own throwaway
json storage dir, no real Mongo/LLM dependency) so it never touches dev data.

Checks, against the real running app + real sandbox_session module:
  1. Company Document Library upload + company_id-scoped list -> company knowledge tier works.
  2. Two tasks (A, B) in the same project currently resolve to DIFFERENT sandbox
     workspaces (the gap this plan fixes) -- a file written for Task A is not
     visible from Task B's workspace today.
  3. Two different "staff" runs against the SAME task already resolve to the
     SAME sandbox workspace (the part that's supposed to already work).
"""
from __future__ import annotations

import os
import shutil
import tempfile
import uuid

_TEST_STORAGE_DIR = tempfile.mkdtemp(prefix="ai_collective_manual_sandbox_baseline_")
_SANDBOX_WORKSPACE = tempfile.mkdtemp(prefix="ai_collective_manual_sandbox_ws_")
_ADMIN_EMAIL = "baseline-admin@example.com"
_ADMIN_PASSWORD = "baseline-admin-password-123"

import yaml  # noqa: E402

_override = {
    "app": {"environment": "development"},
    "logging": {"log_file": False},
    "storage": {"backend": "json", "dir": _TEST_STORAGE_DIR, "file_backend": "local"},
    "task_queue": {"backend": "memory"},
    "lock": {"backend": "threading"},
    "sandbox": {"mode": "local", "workspace": _SANDBOX_WORKSPACE},
    "graph": {"backend": "auto", "neo4j_uri": ""},
    "seed": {"default_data": False},
    "mcp": {"auto_seed": False},
    "admin": {"auto_seed": True, "email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD, "name": "Baseline Admin"},
    "auth": {"jwt_secret_key": "baseline-secret-not-for-production"},
}
_override_path = os.path.join(_TEST_STORAGE_DIR, "_baseline_config_override.yml")
with open(_override_path, "w", encoding="utf-8") as _f:
    yaml.safe_dump(_override, _f)
os.environ["CONFIG_OVERRIDE_FILE"] = _override_path
for _key in ("GOOGLE_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY", "KIMI_API_KEY", "GLM_API_KEY", "OPENROUTER_API_KEY"):
    os.environ[_key] = ""

from fastapi.testclient import TestClient  # noqa: E402

API = "/api/v1"
PASS = []
FAIL = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (PASS if cond else FAIL).append(name)
    print(f"{'PASS' if cond else 'FAIL'}: {name}" + (f" -- {detail}" if detail else ""))


def main() -> None:
    from server.api.main import app

    with TestClient(app) as client:
        login = client.post(f"{API}/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD})
        check("admin login", login.status_code == 200, login.text)
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # --- 1. Company + Project + two Tasks ---
        suffix = uuid.uuid4().hex[:8]
        company = client.post(f"{API}/companies", json={"name": f"BaselineCo-{suffix}"}, headers=headers)
        check("create company", company.status_code == 200, company.text)
        company_id = company.json()["id"]

        dept = client.post(
            f"{API}/departments",
            json={"name": f"dept-{suffix}", "description": "", "staff": [], "mode": "sequential", "maxSteps": 6},
            headers=headers,
        )
        check("create department", dept.status_code == 200, dept.text)
        department_id = dept.json()["id"]

        project = client.post(
            f"{API}/projects",
            json={"key": f"BL{suffix[:4].upper()}", "name": f"Baseline Project {suffix}", "companyId": company_id},
            headers=headers,
        )
        check("create project", project.status_code == 200, project.text)
        project_id = project.json()["id"]

        task_a = client.post(
            f"{API}/tasks",
            json={"title": f"Task A {suffix}", "departmentId": department_id, "projectId": project_id},
            headers=headers,
        )
        task_b = client.post(
            f"{API}/tasks",
            json={"title": f"Task B {suffix}", "departmentId": department_id, "projectId": project_id},
            headers=headers,
        )
        check("create task A (same project)", task_a.status_code == 200, task_a.text)
        check("create task B (same project)", task_b.status_code == 200, task_b.text)
        task_a_id = task_a.json()["id"]
        task_b_id = task_b.json()["id"]
        check(
            "both tasks carry the same projectId",
            task_a.json().get("projectId") == project_id and task_b.json().get("projectId") == project_id,
            f"A={task_a.json().get('projectId')} B={task_b.json().get('projectId')} expected={project_id}",
        )

        # --- 2. Company Document Library (company-wide knowledge tier) ---
        upload = client.post(
            f"{API}/library/documents",
            data={"companyId": company_id, "description": "baseline doc"},
            files={"file": ("notes.txt", b"company-wide knowledge", "text/plain")},
            headers=headers,
        )
        check("upload company document", upload.status_code == 201, upload.text)

        listed = client.get(f"{API}/library/documents", params={"company_id": company_id}, headers=headers)
        check(
            "company document visible via company_id filter",
            listed.status_code == 200 and any(d["companyId"] == company_id for d in listed.json()),
            listed.text,
        )

        # --- 3. Sandbox: same task shares a workspace (already-working part) ---
        from server.infra.sandbox import sandbox_session as sb

        thread_task_a_run1 = sb.meeting_thread_id(task_a_id)
        thread_task_a_run2 = sb.meeting_thread_id(task_a_id)
        check(
            "two staff runs on the SAME task resolve to the same sandbox thread",
            thread_task_a_run1 == thread_task_a_run2,
            f"{thread_task_a_run1} vs {thread_task_a_run2}",
        )

        # --- 4. Sandbox: two tasks in the SAME project currently do NOT share (the gap) ---
        ws_a = sb.ensure_meeting_workspace(task_a_id)
        ws_b = sb.ensure_meeting_workspace(task_b_id)
        check(
            "[EXPECTED GAP] tasks in same project get DIFFERENT sandbox workspaces today",
            ws_a != ws_b,
            f"A={ws_a} B={ws_b}",
        )

        marker_path = os.path.join(ws_a, "shared_report.txt")
        with open(marker_path, "w", encoding="utf-8") as f:
            f.write("written by Task A's staff")
        b_can_see_it = os.path.exists(os.path.join(ws_b, "shared_report.txt"))
        check(
            "[EXPECTED GAP] Task B cannot see the file Task A's staff wrote",
            not b_can_see_it,
            f"checked {os.path.join(ws_b, 'shared_report.txt')}",
        )

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed checks:", FAIL)


if __name__ == "__main__":
    try:
        main()
    finally:
        shutil.rmtree(_TEST_STORAGE_DIR, ignore_errors=True)
        shutil.rmtree(_SANDBOX_WORKSPACE, ignore_errors=True)
