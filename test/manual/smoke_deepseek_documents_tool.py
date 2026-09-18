"""
End-to-end smoke test: attach a `documents` Skill to a Staff and drive one
real turn asking it to fetch a URL, to confirm the sandbox-backed documents
tool (document_fetch_url) actually works end-to-end.

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_documents_tool.py
"""
import sys

from _smoke_auth import BASE, get_session

s, headers = get_session()

company = s.post(f"{BASE}/companies", json={"name": "Documents Tool Smoke Co", "type": "general"}, headers=headers).json()
print("company", company["id"])

skill = s.post(f"{BASE}/skills", json={
    "name": "Documents",
    "tool_name": "documents",
    "kind": "integration",
    "company_id": company["id"],
}, headers=headers).json()
print("skill", skill.get("id"), "tool_name=", skill.get("tool_name"))

staff = s.post(f"{BASE}/staff", json={
    "name": "Doc Runner",
    "role": "engineer",
    "description": "Fetches and reads documents when asked.",
    "skill_ids": [skill["id"]],
    "company_id": company["id"],
}, headers=headers).json()
print("staff", staff["id"], "skill_ids=", staff.get("skill_ids"))

dept = s.post(f"{BASE}/departments", json={
    "name": "Doc Dept",
    "staff": [staff["id"]],
    "mode": "sequential",
    "maxSteps": 3,
    "company_id": company["id"],
}, headers=headers).json()
print("dept", dept["id"])

task = s.post(f"{BASE}/tasks", json={
    "title": "Documents tool smoke test",
    "departmentId": dept["id"],
    "status": "in-progress",
}, headers=headers).json()
print("task", task["id"])

payload = {
    "user_input": "Use your documents tool to fetch https://example.com and report the page title and first sentence of text.",
    "staff": [staff["id"]],
    "mode": "sequential",
    "meeting_id": task["id"],
    "department_id": dept["id"],
    "max_rounds": 4,
}

with s.post(f"{BASE}/llm/staff-graph/run-stream", json=payload, headers=headers, stream=True, timeout=180) as resp:
    print("status", resp.status_code)
    if resp.status_code != 200:
        print(resp.text)
        sys.exit(1)
    for line in resp.iter_lines(decode_unicode=True):
        if line:
            print("SSE:", line[:500])
