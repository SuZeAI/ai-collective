"""
End-to-end smoke test: attach a `bash` Skill to a Staff and drive one real
turn asking it to run a shell command, to confirm the sandbox (k8s mode via
the provisioner container) actually executes tool calls end-to-end.

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_bash_tool.py
"""
import os
import sys

import requests

BASE = os.environ.get("BASE_URL", "http://localhost:2026/api/v1")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@aicollective.com")
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

s = requests.Session()
r = s.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
r.raise_for_status()
headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

company = s.post(f"{BASE}/companies", json={"name": "Bash Tool Smoke Co", "type": "general"}, headers=headers).json()
print("company", company["id"])

skill = s.post(f"{BASE}/skills", json={
    "name": "Bash",
    "tool_name": "bash",
    "kind": "integration",
    "company_id": company["id"],
}, headers=headers).json()
print("skill", skill.get("id"), "tool_name=", skill.get("tool_name"))

staff = s.post(f"{BASE}/staff", json={
    "name": "Shell Runner",
    "role": "engineer",
    "description": "Runs shell commands when asked.",
    "skill_ids": [skill["id"]],
    "company_id": company["id"],
}, headers=headers).json()
print("staff", staff["id"], "skill_ids=", staff.get("skill_ids"))

dept = s.post(f"{BASE}/departments", json={
    "name": "Bash Dept",
    "staff": [staff["id"]],
    "mode": "sequential",
    "maxSteps": 3,
    "company_id": company["id"],
}, headers=headers).json()
print("dept", dept["id"])

task = s.post(f"{BASE}/tasks", json={
    "title": "Bash tool smoke test",
    "departmentId": dept["id"],
    "status": "in-progress",
}, headers=headers).json()
print("task", task["id"])

payload = {
    "user_input": "Use your bash tool to run: echo hello-from-sandbox && whoami. Report the exact output.",
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
