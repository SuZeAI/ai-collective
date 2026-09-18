"""
Full lifecycle smoke test for a "software company" using this product for a
real purpose: create a Project, let the Planner decompose it into tasks,
commit one to the engineering department, then actually run it through the
real Staff/Skills so they do the work (write code via the bash tool).

Reuses the "software" Company created by smoke_deepseek_office_builder.py
(/tmp/office_builder_results.json) if present; otherwise builds a small one
itself so this script is runnable standalone.

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_usecase_software.py
"""
import json
import sys

from _smoke_auth import BASE, get_session

s, headers = get_session()


def get_or_build_software_company():
    try:
        cached = json.load(open("/tmp/office_builder_results.json"))["software"]["applied"]
        company_id = cached["company"]["id"]
        # Confirm it's still there (dev Mongo may have been reset since).
        resp = s.get(f"{BASE}/companies/{company_id}", headers=headers)
        if resp.status_code == 200:
            print("reusing existing software company", company_id)
            depts = s.get(f"{BASE}/departments", params={"company_id": company_id}, headers=headers).json()
            eng_dept = next(d for d in depts if "Engineering" in d["name"])
            return company_id, eng_dept
    except (FileNotFoundError, KeyError, StopIteration):
        pass

    print("building a fresh software company")
    company = s.post(f"{BASE}/companies", json={"name": "Usecase Software Co", "type": "software"}, headers=headers).json()
    staff = {}
    for name, role, desc in [
        ("Backend Dev", "backend engineer", "Implements backend API endpoints."),
        ("QA Engineer", "qa engineer", "Writes and runs tests."),
    ]:
        obj = s.post(f"{BASE}/staff", json={"name": name, "role": role, "description": desc, "company_id": company["id"]}, headers=headers).json()
        skill = s.post(f"{BASE}/skills", json={"name": f"{name} Bash", "tool_name": "bash", "kind": "integration", "company_id": company["id"]}, headers=headers).json()
        s.post(f"{BASE}/staff", json={"id": obj["id"], "name": name, "role": role, "description": desc, "skill_ids": [skill["id"]], "company_id": company["id"]}, headers=headers)
        staff[name] = obj["id"]
    dept = s.post(f"{BASE}/departments", json={"name": "Engineering", "staff": list(staff.values()), "mode": "sequential", "maxSteps": 6, "company_id": company["id"]}, headers=headers).json()
    return company["id"], dept


company_id, eng_dept = get_or_build_software_company()
print("company_id", company_id, "engineering dept", eng_dept["id"], eng_dept["name"], "staff", eng_dept["staff"])

import uuid
project_key = f"AUTH{uuid.uuid4().hex[:4].upper()}"
project = s.post(f"{BASE}/projects", json={
    "key": project_key, "name": "User Authentication Feature", "companyId": company_id,
}, headers=headers).json()
print("project", project.get("id"), project.get("key"), project)

decompose = s.post(f"{BASE}/planner/decompose", json={
    "projectId": project["id"],
    "description": (
        "Implement email/password login for our SupportBot dashboard: a "
        "backend endpoint that validates credentials and returns a session "
        "token, plus a test that checks a wrong password is rejected."
    ),
    "count": 2,
}, headers=headers)
print("decompose status", decompose.status_code)
draft = decompose.json()
for issue in draft.get("issues", []):
    print(" draft issue:", issue.get("title"), "-", issue.get("type"))

commit = s.post(f"{BASE}/planner/commit", json={
    "projectId": project["id"],
    "departmentId": eng_dept["id"],
    "issues": draft["issues"],
}, headers=headers)
print("commit status", commit.status_code)
tasks = commit.json()
for t in tasks:
    print(" committed task:", t["issueKey"], t["title"], "status=", t["status"])

# Actually run the first task through the real engineering staff.
task_to_run = tasks[0]
run_task = s.post(f"{BASE}/tasks", json={
    "id": task_to_run["id"], "title": task_to_run["title"], "departmentId": eng_dept["id"],
    "status": "in-progress",
}, headers=headers).json()

payload = {
    "user_input": (
        f"{task_to_run['title']}. {task_to_run.get('description', '')} "
        "Use your bash tool to actually write the code to a file in your "
        "workspace and show its contents. Keep it small and runnable."
    ),
    "staff": eng_dept["staff"],
    "mode": "sequential",
    "meeting_id": run_task["id"],
    "department_id": eng_dept["id"],
    "max_rounds": 4,
}
print(f"\n=== running task {task_to_run['issueKey']} through real staff ===")
with s.post(f"{BASE}/llm/staff-graph/run-stream", json=payload, headers=headers, stream=True, timeout=180) as resp:
    print("status", resp.status_code)
    if resp.status_code != 200:
        print(resp.text[:800])
        sys.exit(1)
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        evt = json.loads(line[len("data: "):])
        if evt.get("type") == "turn_complete":
            t = evt["turn"]
            print(f"[{t.get('turn')}] {t.get('staff_name')}: {(t.get('content') or '')[:400]}")
        elif evt.get("type") == "error":
            print("ERROR EVENT:", evt)
