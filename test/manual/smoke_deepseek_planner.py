"""
End-to-end smoke test against a running `make dev` stack: creates a Project
and drives POST /planner/decompose + /planner/commit through whatever LLM is
active in config.yml (written while validating docs/features.md with a real
DeepSeek key -- also checks the count clamp to 1-30 with an out-of-range
count=999 request).

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_planner.py
"""
import json
import os

import requests

BASE = os.environ.get("BASE_URL", "http://localhost:2026/api/v1")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@aicollective.com")
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

s = requests.Session()
r = s.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
r.raise_for_status()
headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

project = s.post(f"{BASE}/projects", json={"key": "SMK", "name": "Smoke Planner Project"}, headers=headers).json()
print("project", project.get("id"), project.get("key"))

resp = s.post(f"{BASE}/planner/decompose", json={
    "projectId": project["id"],
    "description": "Build a tiny CLI todo app with add/list/done commands.",
    "count": 999,
}, headers=headers)
print("decompose status", resp.status_code)
draft = resp.json()
print("issues returned (should be clamped to 30):", len(draft.get("issues", [])))

commit = s.post(f"{BASE}/planner/commit", json={
    "projectId": project["id"],
    "issues": draft["issues"][:2],
}, headers=headers)
print("commit status", commit.status_code)
for task in commit.json():
    print(task["issueKey"], task["title"], task["status"], task["priority"])

usage = s.get(f"{BASE}/consumption", params={"days": 1}, headers=headers)
print("\nconsumption totals:", json.dumps(usage.json().get("totals"), indent=2))
