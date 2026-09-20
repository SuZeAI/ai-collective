import json

from _smoke_auth import BASE, get_session

s, headers = get_session()

company = s.post(f"{BASE}/companies", json={"name": "Verify Mesh Opt Co", "type": "marketing"}, headers=headers).json()

FEATURE_BRIEF = (
    "AI Collective just shipped a new 'Recruiting' feature: a shared catalog of "
    "pre-built Departments/Staff/Skills that any company on the platform can "
    "copy into their own workspace as an independent, editable copy in one click."
)

staff = {}
for name, role, desc in [
    ("Researcher", "researcher", "Finds the strongest angle and 2-3 concrete facts before anyone writes."),
    ("Writer", "content writer", "Drafts the blog post copy from the research provided to them."),
    ("Editor", "editor-in-chief", "Reviews, tightens, and finalizes the post. Has the final say."),
    ("SEO", "seo specialist", "Adds a meta description and 3 SEO keywords for the post."),
]:
    obj = s.post(f"{BASE}/staff", json={"name": name, "role": role, "description": desc, "company_id": company["id"]}, headers=headers).json()
    staff[name] = obj["id"]

dept = s.post(f"{BASE}/departments", json={
    "name": "Verify Mesh Opt", "staff": [staff["Researcher"], staff["Writer"], staff["Editor"], staff["SEO"]],
    "mode": "mesh", "maxSteps": 8, "company_id": company["id"],
}, headers=headers).json()
task = s.post(f"{BASE}/tasks", json={"title": "verify mesh opt", "departmentId": dept["id"], "status": "in-progress"}, headers=headers).json()
payload = {
    "user_input": f"{FEATURE_BRIEF} Collaborate freely (hand off to whichever teammate should go next) to produce a final 120-180 word blog post with SEO keywords announcing it.",
    "staff": [staff["Researcher"], staff["Writer"], staff["Editor"], staff["SEO"]], "mode": "mesh",
    "meeting_id": task["id"], "department_id": dept["id"], "max_rounds": 6,
}
turns = []
with s.post(f"{BASE}/llm/staff-graph/run-stream", json=payload, headers=headers, stream=True, timeout=180) as resp:
    print("status", resp.status_code)
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        evt = json.loads(line[len("data: "):])
        if evt.get("type") == "turn_complete":
            t = evt["turn"]
            turns.append(t.get("staff_name"))
            print(f"[{t.get('turn')}] {t.get('staff_name')}: {(t.get('content') or '')[:150]}")
print("turn order:", turns)
