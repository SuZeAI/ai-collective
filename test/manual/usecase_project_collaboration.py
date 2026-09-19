"""Live, real-LLM use-case test for project-scoped sandbox + company knowledge.

Ad hoc script (not collected by pytest -- costs real LLM API calls against
whatever provider key is configured in .env, e.g. GOOGLE_API_KEY). Run
directly: `PYTHONPATH=. python test/manual/usecase_project_collaboration.py`.

Modeled on two common real-world multi-agent patterns (see chat for sources):
  1. Research -> writing handoff with a shared company knowledge document
     ("shared organizational memory" pattern -- a researcher and a copywriter,
     working on separate tasks in the same project, both need to see a
     company brand-guidelines doc AND each other's work-in-progress files).
  2. Builder -> reviewer code handoff ("MetaGPT-style" role split -- a
     developer writes a module, a reviewer in a separate task reads it and
     critiques it, without ever being told its contents directly).

Both scenarios exercise the real thing end-to-end: real staff, real tasks,
real LLM tool-calling through POST /llm/staff-graph/run, real sandbox
read/write via SandboxToolkit -- not direct module calls. Verifies the
project-scoped sandbox (workspace_thread_id) and the attach_to_project fix
(company doc attached to one task is visible from a *different* task in the
same project) under real usage, not just unit-level assertions.

Uses its own isolated json storage + sandbox workspace dir (like
test/conftest.py's pattern) so it never touches real dev data. Does NOT blank
LLM provider keys -- this script needs a real one configured in .env.
"""
from __future__ import annotations

import os
import shutil
import tempfile
import uuid

_TEST_STORAGE_DIR = tempfile.mkdtemp(prefix="ai_collective_usecase_storage_")
_SANDBOX_WORKSPACE = tempfile.mkdtemp(prefix="ai_collective_usecase_sandbox_")
_ADMIN_EMAIL = "usecase-admin@example.com"
_ADMIN_PASSWORD = "usecase-admin-password-123"

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
    "admin": {"auto_seed": True, "email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD, "name": "Usecase Admin"},
    "auth": {"jwt_secret_key": "usecase-secret-not-for-production"},
}
_override_path = os.path.join(_TEST_STORAGE_DIR, "_usecase_config_override.yml")
with open(_override_path, "w", encoding="utf-8") as _f:
    yaml.safe_dump(_override, _f)
os.environ["CONFIG_OVERRIDE_FILE"] = _override_path
# Deliberately NOT blanking provider keys here -- this script needs a real LLM.

from fastapi.testclient import TestClient  # noqa: E402

API = "/api/v1"
PASS = []
FAIL = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (PASS if cond else FAIL).append(name)
    status = "PASS" if cond else "FAIL"
    print(f"{status}: {name}" + (f"\n    -- {detail}" if detail else ""))


def make_staff(client, headers, *, name, role, system_prompt) -> str:
    resp = client.post(
        f"{API}/staff",
        json={"name": name, "role": role, "description": "", "skill_ids": [], "system_prompt": system_prompt},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def run_task(client, headers, *, task_id: str, staff_id: str, user_input: str) -> dict:
    resp = client.post(
        f"{API}/llm/staff-graph/run",
        json={"user_input": user_input, "staff": [staff_id], "mode": "sequential", "meeting_id": task_id, "max_rounds": 3},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def scenario_research_to_copywriting(client, headers, *, company_id: str, department_id: str) -> None:
    print("\n=== Scenario 1: company doc + research -> copywriting handoff ===")
    suffix = uuid.uuid4().hex[:8]
    project = client.post(
        f"{API}/projects",
        json={"key": f"CMP{suffix[:4].upper()}", "name": f"Fall Campaign {suffix}", "companyId": company_id},
        headers=headers,
    ).json()
    project_id = project["id"]

    upload = client.post(
        f"{API}/library/documents",
        data={"companyId": company_id, "description": "brand guidelines"},
        files={"file": ("brand_guidelines.txt", b"Acme's brand voice is playful and concise. Always mention our tagline: 'Simply Smarter.'", "text/plain")},
        headers=headers,
    )
    check("upload company brand guidelines doc", upload.status_code == 201, upload.text)
    doc_id = upload.json()["id"]

    kickoff_task = client.post(
        f"{API}/tasks",
        json={"title": f"Kickoff {suffix}", "departmentId": department_id, "projectId": project_id},
        headers=headers,
    ).json()

    attach = client.post(
        f"{API}/library/documents/{doc_id}/attach",
        json={"taskId": kickoff_task["id"]},
        headers=headers,
    )
    check("attach company doc to kickoff task (project-scoped)", attach.status_code == 200, attach.text)

    researcher_id = make_staff(
        client, headers, name=f"Researcher {suffix}", role="Research Analyst",
        system_prompt="You are a market research analyst. Be concise.",
    )
    research_task = client.post(
        f"{API}/tasks",
        json={"title": f"Research audience {suffix}", "departmentId": department_id, "projectId": project_id},
        headers=headers,
    ).json()

    research_result = run_task(
        client, headers,
        task_id=research_task["id"], staff_id=researcher_id,
        user_input=(
            "First, use your sandbox tools to list the files already in your shared project workspace "
            "and tell me what you find. Then write a new file called research_notes.md to that same "
            "workspace containing 3 short bullet points describing a plausible target audience for a "
            "mid-size SaaS analytics product."
        ),
    )
    check(
        "researcher found the kickoff task's attached brand doc in the SHARED project workspace",
        "brand_guidelines" in research_result["final_response"].lower(),
        research_result["final_response"][:500],
    )

    copywriter_id = make_staff(
        client, headers, name=f"Copywriter {suffix}", role="Copywriter",
        system_prompt="You are a marketing copywriter. Be concise.",
    )
    copy_task = client.post(
        f"{API}/tasks",
        json={"title": f"Draft campaign copy {suffix}", "departmentId": department_id, "projectId": project_id},
        headers=headers,
    ).json()

    copy_result = run_task(
        client, headers,
        task_id=copy_task["id"], staff_id=copywriter_id,
        user_input=(
            "Directly read research_notes.md and brand_guidelines.txt from your shared project "
            "workspace (no need to list the directory first). Using both, write a 2-sentence "
            "marketing blurb to a file called final_copy.md in that same workspace."
        ),
    )
    check(
        "copywriter's output reflects the brand tagline from the company doc",
        "simply smarter" in copy_result["final_response"].lower(),
        copy_result["final_response"][:500],
    )

    # Ground-truth check: read the actual file bytes on disk, not the LLM's self-report --
    # and check the written blurb overlaps with themes from research_notes.md (a DIFFERENT
    # task's output), proving the cross-task read genuinely happened.
    from server.infra.sandbox.sandbox_session import ensure_workspace_for

    ws = ensure_workspace_for(task_id=copy_task["id"], project_id=project_id)
    final_copy_path = os.path.join(ws, "final_copy.md")
    check(
        "final_copy.md actually exists on disk in the shared project workspace",
        os.path.isfile(final_copy_path),
        final_copy_path,
    )
    if os.path.isfile(final_copy_path):
        final_copy_text = open(final_copy_path, encoding="utf-8").read().lower()
        research_themes = ("growth", "retention", "startup", "data", "analytics", "e-commerce", "ltv")
        check(
            "final_copy.md content overlaps with research_notes.md themes (written by a DIFFERENT task)",
            any(theme in final_copy_text for theme in research_themes),
            final_copy_text[:300],
        )


def scenario_dev_to_reviewer_handoff(client, headers, *, department_id: str) -> None:
    print("\n=== Scenario 2: developer -> reviewer code handoff (same project) ===")
    suffix = uuid.uuid4().hex[:8]
    project = client.post(
        f"{API}/projects",
        json={"key": f"DEV{suffix[:4].upper()}", "name": f"API Refactor {suffix}"},
        headers=headers,
    ).json()
    project_id = project["id"]

    dev_id = make_staff(
        client, headers, name=f"Backend Dev {suffix}", role="Backend Developer",
        system_prompt="You are a backend developer. Write clean, minimal Python.",
    )
    dev_task = client.post(
        f"{API}/tasks",
        json={"title": f"Implement config module {suffix}", "departmentId": department_id, "projectId": project_id},
        headers=headers,
    ).json()

    dev_result = run_task(
        client, headers,
        task_id=dev_task["id"], staff_id=dev_id,
        user_input=(
            "Write a Python file named config.py using your sandbox file-write tool. "
            "It should define a function get_setting(key: str) -> str | None that looks up "
            "a value from a hardcoded dict of 2-3 example settings and returns None if missing."
        ),
    )
    check("developer task completed without error", not dev_result.get("error"), dev_result.get("error") or "")

    # Ground-truth check: the file is really in the shared project workspace on
    # disk, independent of whether the reviewer LLM call below converges to a
    # clean text answer within its tool-call budget (see chat notes on the
    # ModelCallLimitMiddleware run-limit -- a separate, pre-existing reliability
    # characteristic unrelated to the sandbox-sharing mechanism under test).
    from server.infra.sandbox.sandbox_session import ensure_workspace_for

    dev_ws = ensure_workspace_for(task_id=dev_task["id"], project_id=project_id)
    config_path = os.path.join(dev_ws, "config.py")
    check("config.py actually exists on disk in the shared project workspace", os.path.isfile(config_path), config_path)
    if os.path.isfile(config_path):
        check(
            "config.py contains the requested get_setting function (ground truth, not LLM self-report)",
            "get_setting" in open(config_path, encoding="utf-8").read(),
        )

    reviewer_id = make_staff(
        client, headers, name=f"Code Reviewer {suffix}", role="Code Reviewer",
        system_prompt="You are a meticulous code reviewer. Be concise and specific.",
    )
    review_task = client.post(
        f"{API}/tasks",
        json={"title": f"Review config module {suffix}", "departmentId": department_id, "projectId": project_id},
        headers=headers,
    ).json()

    review_result = run_task(
        client, headers,
        task_id=review_task["id"], staff_id=reviewer_id,
        user_input=(
            "Use your sandbox tools to directly read the file config.py (skip listing the directory "
            "first). Then write a short code review: what does it do, and one concrete improvement "
            "suggestion. You were NOT told what the file contains -- find it yourself."
        ),
    )
    check(
        "reviewer (different task, same project) found and read the dev's config.py without being told its contents",
        "get_setting" in review_result["final_response"],
        review_result["final_response"][:500],
    )


def main() -> None:
    from server.api.main import app

    with TestClient(app) as client:
        login = client.post(f"{API}/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD})
        check("admin login", login.status_code == 200, login.text)
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        suffix = uuid.uuid4().hex[:8]
        company = client.post(f"{API}/companies", json={"name": f"Acme Corp {suffix}"}, headers=headers)
        check("create company", company.status_code == 200, company.text)
        company_id = company.json()["id"]

        dept = client.post(
            f"{API}/departments",
            json={"name": f"dept-{suffix}", "description": "", "staff": [], "mode": "sequential", "maxSteps": 6},
            headers=headers,
        )
        check("create department", dept.status_code == 200, dept.text)
        department_id = dept.json()["id"]

        scenario_research_to_copywriting(client, headers, company_id=company_id, department_id=department_id)
        scenario_dev_to_reviewer_handoff(client, headers, department_id=department_id)

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed checks:", FAIL)


if __name__ == "__main__":
    try:
        main()
    finally:
        shutil.rmtree(_TEST_STORAGE_DIR, ignore_errors=True)
        shutil.rmtree(_SANDBOX_WORKSPACE, ignore_errors=True)
