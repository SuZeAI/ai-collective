"""
Full lifecycle smoke test for a "marketing agency" using this product for a
real purpose: create a Project for a client campaign, let the Planner
decompose it into tasks, commit one to the Content Studio department, then
actually run it through the real Staff/Skills so they do the work.

Builds a fresh agency Company via Office Builder each run (no cache reuse,
unlike the software usecase script) so it also re-validates plan generation
for the marketing archetype every time.

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_usecase_marketing.py
"""
import json
import sys
import uuid

from _smoke_auth import BASE, get_session

s, headers = get_session()

brief = (
    "We run a boutique digital marketing agency. We plan and execute social "
    "media campaigns and write content for e-commerce clients, then report "
    "back on performance. We need people to plan campaigns, write copy, and "
    "analyze results."
)
plan_resp = s.post(f"{BASE}/office-builder/plan", json={"messages": [{"role": "user", "content": brief}]}, headers=headers)
plan = plan_resp.json()["plan"]
applied = s.post(f"{BASE}/office-builder/apply", json={"plan": plan}, headers=headers).json()
company_id = applied["company"]["id"]
print("company_id", company_id)

depts = s.get(f"{BASE}/departments", params={"company_id": company_id}, headers=headers).json()
for d in depts:
    print(" department:", d["name"], "mode=", d["mode"], "staff=", d["staff"])
content_dept = next((d for d in depts if "Content" in d["name"] or "Copy" in d["name"]), depts[0])
print("using department:", content_dept["name"])

project_key = f"CAMP{uuid.uuid4().hex[:4].upper()}"
project = s.post(f"{BASE}/projects", json={
    "key": project_key, "name": "ClientX Q4 Social Campaign", "companyId": company_id,
}, headers=headers).json()
print("project", project.get("id"), project.get("key"))

decompose = s.post(f"{BASE}/planner/decompose", json={
    "projectId": project["id"],
    "description": (
        "Plan and write a 3-post Instagram launch teaser series for ClientX, an "
        "e-commerce skincare brand, ahead of their Q4 holiday sale."
    ),
    "count": 2,
}, headers=headers)
print("decompose status", decompose.status_code)
draft = decompose.json()
for issue in draft.get("issues", []):
    print(" draft issue:", issue.get("title"), "-", issue.get("type"))

commit = s.post(f"{BASE}/planner/commit", json={
    "projectId": project["id"],
    "departmentId": content_dept["id"],
    "issues": draft["issues"],
}, headers=headers)
print("commit status", commit.status_code)
tasks = commit.json()
for t in tasks:
    print(" committed task:", t["issueKey"], t["title"], "status=", t["status"])

task_to_run = tasks[0]
run_task = s.post(f"{BASE}/tasks", json={
    "id": task_to_run["id"], "title": task_to_run["title"], "departmentId": content_dept["id"],
    "status": "in-progress",
}, headers=headers).json()

payload = {
    "user_input": f"{task_to_run['title']}. {task_to_run.get('description', '')} Deliver the actual finished copy.",
    "staff": content_dept["staff"],
    "mode": content_dept["mode"],
    "meeting_id": run_task["id"],
    "department_id": content_dept["id"],
    "max_rounds": 6,
}
print(f"\n=== running task {task_to_run['issueKey']} through real staff (mode={content_dept['mode']}) ===")
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
