"""Same use-case scenarios as usecase_project_collaboration.py, but driven over
REAL HTTP against a genuinely running backend process (not FastAPI's in-process
TestClient). Proves the project-scoped sandbox + company-knowledge-attach flow
works end-to-end against the actual served API, the way the real UI would call it.

Prereq: start the real server against an isolated config first, e.g.:

  CONFIG_OVERRIDE_FILE=/path/to/override.yml PYTHONPATH=. uv run uvicorn \
      server.api.main:app --host 127.0.0.1 --port 8099 &

The override.yml should set storage.backend=json to an isolated dir,
sandbox.workspace to an isolated dir, and admin.auto_seed with a known
email/password -- see the CONFIG_OVERRIDE_FILE block test/conftest.py builds,
or the ad hoc one used to produce this script's original run.

Run: BASE_URL=http://127.0.0.1:8099/api/v1 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
     PYTHONPATH=. python test/manual/usecase_live_server_api.py

Costs real LLM API calls (needs a real provider key configured for the running
server's process). Not collected by pytest.
"""
from __future__ import annotations

import os
import uuid

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8099/api/v1")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "live-admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "live-admin-password-123")
# Must match the running server's sandbox.workspace config (see override.yml).
SANDBOX_WORKSPACE = os.environ.get("SANDBOX_WORKSPACE", "")

PASS: list[str] = []
FAIL: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (PASS if cond else FAIL).append(name)
    status = "PASS" if cond else "FAIL"
    print(f"{status}: {name}" + (f"\n    -- {detail}" if detail else ""))


def make_staff(client: httpx.Client, *, name: str, role: str, system_prompt: str) -> str:
    resp = client.post(
        "/staff",
        json={"name": name, "role": role, "description": "", "skill_ids": [], "system_prompt": system_prompt},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def run_task(client: httpx.Client, *, task_id: str, staff_id: str, user_input: str) -> dict:
    resp = client.post(
        "/llm/staff-graph/run",
        json={"user_input": user_input, "staff": [staff_id], "mode": "sequential", "meeting_id": task_id, "max_rounds": 3},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def main() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=120.0) as client:
        health = client.get("/health")
        check("real server is reachable over HTTP", health.status_code == 200, f"{BASE_URL}/health -> {health.text}")

        login = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        check("admin login (real HTTP)", login.status_code == 200, login.text)
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

        suffix = uuid.uuid4().hex[:8]
        company = client.post("/companies", json={"name": f"Acme Live {suffix}"})
        check("create company (real HTTP)", company.status_code == 200, company.text)
        company_id = company.json()["id"]

        dept = client.post(
            "/departments",
            json={"name": f"dept-{suffix}", "description": "", "staff": [], "mode": "sequential", "maxSteps": 6},
        )
        check("create department (real HTTP)", dept.status_code == 200, dept.text)
        department_id = dept.json()["id"]

        project = client.post("/projects", json={"key": f"LIVE{suffix[:4].upper()}", "name": f"Live Campaign {suffix}", "companyId": company_id})
        check("create project (real HTTP)", project.status_code == 200, project.text)
        project_id = project.json()["id"]

        upload = client.post(
            "/library/documents",
            data={"companyId": company_id, "description": "brand guidelines"},
            files={"file": ("brand_guidelines.txt", b"Acme's brand voice is playful and concise. Always mention our tagline: 'Simply Smarter.'", "text/plain")},
        )
        check("upload company brand doc (real HTTP, multipart)", upload.status_code == 201, upload.text)
        doc_id = upload.json()["id"]

        kickoff_task = client.post("/tasks", json={"title": f"Kickoff {suffix}", "departmentId": department_id, "projectId": project_id}).json()
        attach = client.post(f"/library/documents/{doc_id}/attach", json={"taskId": kickoff_task["id"]})
        check("attach company doc to kickoff task, project-scoped (real HTTP)", attach.status_code == 200, attach.text)

        researcher_id = make_staff(client, name=f"Researcher {suffix}", role="Research Analyst", system_prompt="You are a market research analyst. Be concise.")
        research_task = client.post("/tasks", json={"title": f"Research {suffix}", "departmentId": department_id, "projectId": project_id}).json()

        research_result = run_task(
            client, task_id=research_task["id"], staff_id=researcher_id,
            user_input=(
                "First, use your sandbox tools to list the files already in your shared project workspace "
                "and tell me what you find. Then write a new file called research_notes.md to that same "
                "workspace containing 3 short bullet points describing a plausible target audience for a "
                "mid-size SaaS analytics product."
            ),
        )
        check(
            "researcher (real LLM call, over real HTTP) found the kickoff task's attached brand doc",
            "brand_guidelines" in research_result["final_response"].lower(),
            research_result["final_response"][:400],
        )

        copywriter_id = make_staff(client, name=f"Copywriter {suffix}", role="Copywriter", system_prompt="You are a marketing copywriter. Be concise.")
        copy_task = client.post("/tasks", json={"title": f"Draft copy {suffix}", "departmentId": department_id, "projectId": project_id}).json()

        copy_result = run_task(
            client, task_id=copy_task["id"], staff_id=copywriter_id,
            user_input=(
                "Directly read research_notes.md and brand_guidelines.txt from your shared project "
                "workspace (no need to list the directory first). Using both, write a 2-sentence "
                "marketing blurb to a file called final_copy.md in that same workspace."
            ),
        )
        check(
            "copywriter (3rd task, real LLM call over real HTTP) reflects the brand tagline",
            "simply smarter" in copy_result["final_response"].lower(),
            copy_result["final_response"][:400],
        )

        # Ground truth: read the file bytes back directly from the shared workspace
        # on disk (this script and the live server share a filesystem here), not
        # the LLM's self-report. NOTE: GET /conversations/{id}/files/download is
        # NOT used for this check -- it's scoped to meeting_thread_id(task_id)'s
        # uploads/ dir only (not project-aware, not the workspace root where
        # sandbox_write_file puts files), a separate, still-open gap unrelated
        # to the run/run-stream path this pass covers -- see chat notes.
        import hashlib

        digest = hashlib.sha256(project_id.encode("utf-8")).hexdigest()[:32]
        final_copy_path = os.path.join(SANDBOX_WORKSPACE, f"proj-{digest}", "final_copy.md")
        check(
            "final_copy.md exists on disk in the shared project workspace (ground truth)",
            os.path.isfile(final_copy_path),
            final_copy_path,
        )

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed checks:", FAIL)


if __name__ == "__main__":
    main()
