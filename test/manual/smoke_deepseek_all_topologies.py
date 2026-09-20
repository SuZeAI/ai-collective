"""
End-to-end use-case smoke test across all 6 Department topologies
(sequential, ring, supervisor, tree, mesh, custom) with the SAME real
use case: write a short blog post announcing AI Collective's new Recruiting
feature, using 4 collaborating Staff (Researcher, Writer, Editor, SEO).

Confirms each topology's real wiring (delegation tags, fan-out/fan-in, round
order) actually drives the LLM the way docs/features.md describes, and lets a
human/LLM reviewer judge whether the handed-off context stays coherent turn to
turn. Writes the full SSE transcript for every topology to a JSON file for
offline review (stdout only prints a short per-turn summary).

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_all_topologies.py
"""
import json
import os
import sys

from _smoke_auth import BASE, get_session

OUT_PATH = os.environ.get("OUT_PATH", "/tmp/topology_transcripts.json")

FEATURE_BRIEF = (
    "AI Collective just shipped a new 'Recruiting' feature: a shared catalog of "
    "pre-built Departments/Staff/Skills that any company on the platform can "
    "copy into their own workspace as an independent, editable copy in one click."
)

s, headers = get_session()

company = s.post(f"{BASE}/companies", json={"name": "Topology Use Case Co", "type": "marketing"}, headers=headers).json()
print("company", company["id"])

STAFF_SPECS = [
    ("Researcher", "researcher", "Finds the strongest angle and 2-3 concrete facts before anyone writes."),
    ("Writer", "content writer", "Drafts the blog post copy from the research provided to them."),
    ("Editor", "editor-in-chief", "Reviews, tightens, and finalizes the post. Has the final say."),
    ("SEO", "seo specialist", "Adds a meta description and 3 SEO keywords for the post."),
]

staff = {}
for name, role, desc in STAFF_SPECS:
    obj = s.post(f"{BASE}/staff", json={
        "name": name, "role": role, "description": desc, "company_id": company["id"],
    }, headers=headers).json()
    staff[name] = obj["id"]
    print("staff", name, obj["id"])


def make_dept(name: str, mode: str, staff_order: list[str]) -> str:
    dept = s.post(f"{BASE}/departments", json={
        "name": name, "staff": staff_order, "mode": mode, "maxSteps": 8, "company_id": company["id"],
    }, headers=headers).json()
    return dept["id"]


def make_task(dept_id: str, title: str) -> str:
    task = s.post(f"{BASE}/tasks", json={
        "title": title, "departmentId": dept_id, "status": "in-progress",
    }, headers=headers).json()
    return task["id"]


def run(label: str, dept_id: str, staff_order: list[str], mode: str, user_input: str,
        max_rounds: int, custom_graph: dict | None = None) -> dict:
    task_id = make_task(dept_id, f"{label} use case")
    payload = {
        "user_input": user_input,
        "staff": staff_order,
        "mode": mode,
        "meeting_id": task_id,
        "department_id": dept_id,
        "max_rounds": max_rounds,
    }
    if custom_graph:
        payload["custom_graph"] = custom_graph

    events = []
    print(f"\n=== {label} (mode={mode}) ===")
    with s.post(f"{BASE}/llm/staff-graph/run-stream", json=payload, headers=headers, stream=True, timeout=240) as resp:
        if resp.status_code != 200:
            print("FAILED", resp.status_code, resp.text[:500])
            return {"label": label, "mode": mode, "status": resp.status_code, "error": resp.text, "events": []}
        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            try:
                evt = json.loads(line[len("data: "):])
            except json.JSONDecodeError:
                continue
            events.append(evt)
            etype = evt.get("type")
            if etype == "turn_complete":
                turn = evt.get("turn", {})
                print(f"  [{turn.get('turn')}] {turn.get('staff_name')}: {(turn.get('content') or '')[:180]}")
            elif etype == "agent_start":
                print(f"  -> agent_start: {evt.get('agent_name')}")
    return {"label": label, "mode": mode, "status": 200, "task_id": task_id, "events": events}


results = []

# 1. sequential: Researcher -> Writer -> Editor, each sees only the prior output.
dept = make_dept("Blog Sequential", "sequential", [staff["Researcher"], staff["Writer"], staff["Editor"]])
results.append(run(
    "sequential", dept, [staff["Researcher"], staff["Writer"], staff["Editor"]], "sequential",
    f"{FEATURE_BRIEF} Write a short (120-180 word) blog post announcing it. "
    "Researcher: note the angle and facts. Writer: draft from that. Editor: polish and finalize.",
    max_rounds=3,
))

# 2. ring: same 3, cycling rounds to iteratively refine.
dept = make_dept("Blog Ring", "ring", [staff["Researcher"], staff["Writer"], staff["Editor"]])
results.append(run(
    "ring", dept, [staff["Researcher"], staff["Writer"], staff["Editor"]], "ring",
    f"{FEATURE_BRIEF} Collaborate in rounds to iteratively improve a short (120-180 word) "
    "blog post announcing it until the Editor is satisfied and says it's final.",
    max_rounds=6,
))

# 3. supervisor: lead (Editor) delegates to Researcher/Writer, then finalizes.
dept = make_dept("Blog Supervisor", "supervisor", [staff["Editor"], staff["Researcher"], staff["Writer"]])
results.append(run(
    "supervisor", dept, [staff["Editor"], staff["Researcher"], staff["Writer"]], "supervisor",
    f"{FEATURE_BRIEF} You are the lead editor. Delegate research and drafting to your team, "
    "then produce the final 120-180 word blog post announcing it.",
    max_rounds=6,
))

# 4. tree: root=Editor(0), children=Researcher(1)/Writer(2) per docs' child=2i+1/2i+2.
dept = make_dept("Blog Tree", "tree", [staff["Editor"], staff["Researcher"], staff["Writer"]])
results.append(run(
    "tree", dept, [staff["Editor"], staff["Researcher"], staff["Writer"]], "tree",
    f"{FEATURE_BRIEF} You are the root. Delegate down to your branches for research and a draft, "
    "then combine into the final 120-180 word blog post announcing it.",
    max_rounds=6,
))

# 5. mesh: hub + spokes, any-to-any via NEXT_AGENT.
dept = make_dept("Blog Mesh", "mesh", [staff["Researcher"], staff["Writer"], staff["Editor"], staff["SEO"]])
results.append(run(
    "mesh", dept, [staff["Researcher"], staff["Writer"], staff["Editor"], staff["SEO"]], "mesh",
    f"{FEATURE_BRIEF} Collaborate freely (hand off to whichever teammate should go next) to produce "
    "a final 120-180 word blog post with SEO keywords announcing it.",
    max_rounds=6,
))

# 6. custom: Researcher -> Writer -> Editor, SEO -> Editor (fan-in merge).
custom_graph = {
    "edges": [
        {"source": staff["Researcher"], "target": staff["Writer"]},
        {"source": staff["Writer"], "target": staff["Editor"]},
        {"source": staff["SEO"], "target": staff["Editor"]},
    ],
    "entry": [staff["Researcher"], staff["SEO"]],
}
dept = make_dept("Blog Custom", "custom", [staff["Researcher"], staff["Writer"], staff["Editor"], staff["SEO"]])
results.append(run(
    "custom", dept, [staff["Researcher"], staff["Writer"], staff["Editor"], staff["SEO"]], "custom",
    f"{FEATURE_BRIEF} Produce the final 120-180 word blog post with SEO keywords announcing it.",
    max_rounds=5, custom_graph=custom_graph,
))

with open(OUT_PATH, "w") as f:
    json.dump(results, f, indent=2)
print(f"\nSaved full transcripts to {OUT_PATH}")

failed = [r for r in results if r["status"] != 200]
if failed:
    print(f"\n{len(failed)} topology run(s) FAILED: {[r['label'] for r in failed]}")
    sys.exit(1)
