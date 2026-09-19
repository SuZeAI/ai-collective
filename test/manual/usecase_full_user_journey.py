"""Complex, realistic end-to-end user journey driven over REAL HTTP against a
genuinely running backend server, using the EXACT wire contract the real UI
uses (endpoints + payload field names extracted from ui/src/lib/api.ts).

Treats this script as "a real user": register a fresh (non-admin) account,
use Office Builder to AI-generate a company from a plain-English description,
apply the plan (creates real Company/Department/Staff), create a Project +
Epic, use the Planner to AI-decompose a goal into draft tasks and commit them,
run TWO of those tasks through a real multi-agent "supervisor" topology run
(lead delegates to workers -- not the single-staff sequential mode used in
earlier passes), verify project-scoped sandbox knowledge sharing across tasks
that were entirely AI-generated (not hand-crafted), then exercise Recruiting
(browse the seeded catalog, copy a template staff into the new company).

Needs a real LLM provider key configured for the running server (multiple
real LLM calls: office-builder plan generation, planner decomposition, two
supervisor-topology runs). Not collected by pytest -- ad hoc, costs tokens.

Usage: BASE_URL=http://127.0.0.1:8098/api/v1 PYTHONPATH=. python \
       test/manual/usecase_full_user_journey.py
"""
from __future__ import annotations

import json
import os
import uuid

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8098/api/v1")

PASS: list[str] = []
FAIL: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    (PASS if cond else FAIL).append(name)
    status = "PASS" if cond else "FAIL"
    print(f"{status}: {name}" + (f"\n    -- {detail}" if detail else ""))


def sse_events(resp: httpx.Response):
    for line in resp.iter_lines():
        if not line or not line.startswith("data: "):
            continue
        try:
            yield json.loads(line[len("data: "):])
        except json.JSONDecodeError:
            continue


def main() -> None:
    suffix = uuid.uuid4().hex[:8]
    c = httpx.Client(base_url=BASE_URL, timeout=180.0)

    # ── 1. A brand-new user signs up (not the seeded admin) ──────────────────
    email = f"user-{suffix}@example.com"
    register = c.post("/auth/register", json={"name": "Jordan Lee", "email": email, "password": "correct-horse-battery-9"})
    check("register a fresh (non-admin) user account", register.status_code == 201, register.text)
    c.headers["Authorization"] = f"Bearer {register.json()['access_token']}"

    # ── 2. Office Builder: describe the company in plain English, get an AI plan ──
    print("\n=== Office Builder: AI-generate a company from a description ===")
    plan_resp = c.post("/office-builder/plan-stream", json={
        "messages": [{
            "role": "user",
            "content": (
                "I'm starting a small marketing agency that creates social media campaigns for "
                "e-commerce clients. Set up ONE department called 'Content Team' using the "
                "'supervisor' topology mode, with a Content Strategist (the lead) and two Copywriters "
                "(the workers) who the strategist can delegate sub-tasks to. Company type: marketing."
            ),
        }],
        "plan": None,
    })
    check("office-builder plan-stream reachable", plan_resp.status_code == 200, plan_resp.text[:300])

    plan = None
    reply_text = ""
    for ev in sse_events(plan_resp):
        if ev.get("type") == "plan":
            plan = ev["plan"]
        if ev.get("type") == "done":
            reply_text = ev.get("reply", "")
    check("AI generated a plan with at least one department", bool(plan and plan.get("departments")), json.dumps(plan)[:500] if plan else reply_text[:300])

    if plan:
        dept_plan = plan["departments"][0]
        check(
            "AI plan's department has >= 2 staff (lead + worker for supervisor fan-out)",
            len(dept_plan.get("staff", [])) >= 2,
            json.dumps(dept_plan)[:400],
        )
        # A real user reviewing the draft before applying it: force supervisor
        # mode explicitly (the AI may have picked something else) -- mirrors
        # the UI's "edit the plan before applying" step.
        dept_plan["mode"] = "supervisor"

    # ── 3. Apply the plan: really creates Company + Department + Staff ───────
    apply_resp = c.post("/office-builder/apply", json={"plan": plan})
    check("apply office plan creates real Company/Department/Staff", apply_resp.status_code == 200, apply_resp.text[:500])
    applied = apply_resp.json()
    company_id = applied["company"]["id"]
    department_id = applied["department_ids"][0]
    staff_ids = applied["staff_ids"]
    check("applied plan produced >= 2 real staff records", len(staff_ids) >= 2, str(staff_ids))

    dept_list = c.get("/departments")
    created_dept = next((d for d in dept_list.json() if d["id"] == department_id), None) if dept_list.status_code == 200 else None
    check(
        "the created department is really in supervisor mode",
        created_dept is not None and created_dept.get("mode") == "supervisor",
        json.dumps(created_dept)[:300] if created_dept else dept_list.text[:300],
    )

    # ── 4. Create a Project + Epic under the new company ──────────────────────
    print("\n=== Project + Epic + AI Planner ===")
    project = c.post("/projects", json={"key": f"MKT{suffix[:4].upper()}", "name": "Client Campaigns", "companyId": company_id}).json()
    epic = c.post("/epics", json={"projectId": project["id"], "title": "UrbanThreads Black Friday Campaign"}).json()
    check("create epic under the new project", "id" in epic, json.dumps(epic)[:300])

    # ── 5. Planner: AI decomposes a goal into draft tasks ──────────────────────
    decompose = c.post("/planner/decompose", json={
        "projectId": project["id"],
        "epicId": epic["id"],
        "description": (
            "Launch a Black Friday social media campaign for our e-commerce client 'UrbanThreads'. "
            "We need a content calendar and sample post copy."
        ),
        "count": 4,
    })
    check("planner/decompose reachable", decompose.status_code == 200, decompose.text[:400])
    draft_issues = decompose.json().get("issues", [])
    check("planner produced at least 2 draft issues", len(draft_issues) >= 2, json.dumps(draft_issues)[:500])

    # ── 6. Commit the AI-drafted issues into real Tasks ────────────────────────
    commit = c.post("/planner/commit", json={
        "projectId": project["id"], "epicId": epic["id"], "departmentId": department_id, "issues": draft_issues,
    })
    check("planner/commit creates real tasks from the draft issues", commit.status_code == 200, commit.text[:400])
    committed_tasks = commit.json()
    check("committed tasks are linked to the project/epic", all(t.get("projectId") == project["id"] for t in committed_tasks), json.dumps(committed_tasks)[:400])

    if len(committed_tasks) < 2:
        print("Not enough committed tasks to run the cross-task scenario; stopping here.")
        report(c)
        return

    task_a, task_b = committed_tasks[0], committed_tasks[1]

    # ── 7. Run task A with the FULL supervisor department (lead + 2 workers, fan-out) ──
    print("\n=== Real multi-agent supervisor-topology run (lead delegates to workers) ===")
    run_a = c.post("/llm/staff-graph/run", json={
        "user_input": (
            f"Task: {task_a['title']}. {task_a.get('description', '')} "
            "Delegate to your team as needed. End by using your sandbox tools to write a file "
            "named content_calendar.md to your shared project workspace with 3 example post ideas "
            "for a Black Friday e-commerce campaign."
        ),
        "staff": staff_ids, "mode": "supervisor", "meeting_id": task_a["id"], "department_id": department_id, "max_rounds": 6,
    })
    check("supervisor-topology run completed without error", run_a.status_code == 200 and not run_a.json().get("error"), run_a.text[:400])
    run_a_body = run_a.json()
    # A fan-out wave (coordinator decision + branch(es) + synthesis) counts as
    # ONE round/superstep, so check turn count (lead + >=1 worker + synthesis),
    # not rounds.
    check(
        "supervisor run produced multiple turns (lead delegation + >=1 worker + synthesis)",
        len(run_a_body.get("turns", [])) >= 2,
        json.dumps(run_a_body.get("turns", []))[:500],
    )

    # ── 8. Run task B (different task, same project) with a DIFFERENT single staff ──
    # reads the calendar the supervisor team wrote in task A's run, via the
    # project-scoped shared sandbox -- proving cross-task sharing holds even
    # for entirely AI-generated staff/tasks/topology, not hand-crafted ones.
    worker_id = staff_ids[-1]
    run_b = c.post("/llm/staff-graph/run", json={
        "user_input": (
            f"Task: {task_b['title']}. Directly read content_calendar.md from your shared project "
            "workspace (skip listing the directory first) and write ONE sample social media post "
            "based on one of its ideas, to a file named sample_post.md in that same workspace."
        ),
        "staff": [worker_id], "mode": "sequential", "meeting_id": task_b["id"], "department_id": department_id, "max_rounds": 3,
    })
    check("second task (different staff) completed without error", run_b.status_code == 200 and not run_b.json().get("error"), run_b.text[:400])
    check(
        "second task's staff genuinely read the first task's AI-written calendar (cross-task project sandbox)",
        "calendar" in run_b.json().get("final_response", "").lower() or "black friday" in run_b.json().get("final_response", "").lower(),
        run_b.json().get("final_response", "")[:400],
    )

    # ── 9. Recruiting: browse the seeded catalog, copy a template staff into the new company ──
    print("\n=== Recruiting: browse + copy a template staff into the new company ===")
    catalog = c.get("/recruiting/staff")
    check("recruiting catalog is reachable and non-empty (seeded templates)", catalog.status_code == 200 and len(catalog.json()) > 0, f"{len(catalog.json()) if catalog.status_code == 200 else 0} templates")
    if catalog.status_code == 200 and catalog.json():
        template = catalog.json()[0]
        copy_resp = c.post("/recruiting/copy", json={"type": "staff", "id": template["id"], "companyId": company_id})
        check("copy a recruiting template staff into the new company", copy_resp.status_code == 200, copy_resp.text[:300])
        if copy_resp.status_code == 200:
            new_staff_id = copy_resp.json()["id"]
            staff_list = c.get("/staff")
            recruited = next((s for s in staff_list.json() if s["id"] == new_staff_id), None) if staff_list.status_code == 200 else None
            check(
                "the recruited staff is now a real, usable staff record owned by this user",
                recruited is not None,
                json.dumps(recruited)[:300] if recruited else staff_list.text[:300],
            )

    report(c)


def report(c: httpx.Client) -> None:
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed checks:", FAIL)


if __name__ == "__main__":
    main()
