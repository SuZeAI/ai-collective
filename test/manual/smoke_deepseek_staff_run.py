"""
End-to-end smoke test against a running `make dev` stack: creates a Company/
Staff/Department/Task from scratch and drives one real turn through
POST /llm/staff-graph/run-stream, using whatever LLM is active in config.yml
(written while validating docs/features.md with a real DeepSeek key).

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_staff_run.py
"""
import json
import sys

from _smoke_auth import BASE, get_session

s, headers = get_session()

company = s.post(f"{BASE}/companies", json={"name": "Smoke Test Co", "type": "general"}, headers=headers).json()
print("company", company["id"])

staff = s.post(f"{BASE}/staff", json={
    "name": "Smoke Tester",
    "role": "assistant",
    "description": "answers briefly",
    "companyId": company["id"],
}, headers=headers).json()
print("staff", staff["id"])

dept = s.post(f"{BASE}/departments", json={
    "name": "Smoke Dept",
    "staff": [staff["id"]],
    "mode": "sequential",
    "maxSteps": 3,
    "companyId": company["id"],
}, headers=headers).json()
print("dept", dept["id"])

task = s.post(f"{BASE}/tasks", json={
    "title": "Smoke test task",
    "departmentId": dept["id"],
    "status": "in-progress",
}, headers=headers).json()
print("task", task["id"])

payload = {
    "user_input": "Reply with exactly one word: pong",
    "staff": [staff["id"]],
    "mode": "sequential",
    "meeting_id": task["id"],
    "department_id": dept["id"],
    "max_rounds": 2,
}

with s.post(f"{BASE}/llm/staff-graph/run-stream", json=payload, headers=headers, stream=True, timeout=120) as resp:
    print("status", resp.status_code)
    if resp.status_code != 200:
        print(resp.text)
        sys.exit(1)
    for line in resp.iter_lines(decode_unicode=True):
        if line:
            print("SSE:", line[:300])

# Note: the backend does not persist the transcript itself -- the frontend
# (RunEngineContext.tsx) calls POST /meetings on each turn_complete event,
# so GET /meetings will be empty after running this script standalone.
