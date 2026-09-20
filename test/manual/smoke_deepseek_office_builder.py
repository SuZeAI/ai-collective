"""
End-to-end smoke test for the Office Builder company-creation flow (the
actual "create a company" use case of this app) across four different
company archetypes: software, marketing/agency, research, general.

For each archetype: POST /office-builder/plan with a realistic one-line brief,
inspect the LLM-generated OfficePlan (departments -> staff -> skills), then
POST /office-builder/apply to materialize a real Company and check it landed
correctly (departments/staff/skills actually created, topology modes sane).

Usage: ADMIN_PASSWORD=... python3 test/manual/smoke_deepseek_office_builder.py
"""
import json

from _smoke_auth import BASE, get_session

s, headers = get_session()

BRIEFS = {
    "software": (
        "We're a seed-stage SaaS startup building an AI-powered customer support "
        "chatbot platform for e-commerce sites. We need a small engineering team: "
        "someone to own the backend API, someone to build the widget frontend, and "
        "someone to write and run tests before every release."
    ),
    "marketing": (
        "We run a boutique digital marketing agency. We plan and execute social "
        "media campaigns and write content for e-commerce clients, then report back "
        "on performance. We need people to plan campaigns, write copy, and analyze "
        "results."
    ),
    "research": (
        "We're a small AI research lab studying reinforcement learning for robotics. "
        "We design experiments, run them, and write up the results as papers. We "
        "need someone to design experiments, someone to implement and run them, and "
        "someone to write up findings."
    ),
    "general": (
        "We're a small business strategy consulting firm. We interview client "
        "businesses to understand their problems, research their market, and "
        "deliver a written recommendation report."
    ),
}

results = {}

for archetype, brief in BRIEFS.items():
    print(f"\n{'=' * 20} {archetype} {'=' * 20}")
    resp = s.post(f"{BASE}/office-builder/plan", json={
        "messages": [{"role": "user", "content": brief}],
    }, headers=headers)
    print("plan status", resp.status_code)
    if resp.status_code != 200:
        print(resp.text[:500])
        continue
    data = resp.json()
    plan = data.get("plan")
    print("reply:", (data.get("reply") or "")[:200])
    if not plan:
        print("NO PLAN RETURNED")
        continue

    print(f"company_type={plan.get('company_type')} name={plan.get('name')!r}")
    for dept in plan.get("departments", []):
        staff_names = [st["name"] for st in dept.get("staff", [])]
        print(f"  department: {dept['name']!r} mode={dept.get('mode')} staff={staff_names}")
        for st in dept.get("staff", []):
            skill_names = [sk["name"] for sk in st.get("skills", [])]
            print(f"    staff: {st['name']!r} role={st.get('role')!r} skills={skill_names}")

    apply_resp = s.post(f"{BASE}/office-builder/apply", json={"plan": plan}, headers=headers)
    print("apply status", apply_resp.status_code)
    if apply_resp.status_code != 200:
        print(apply_resp.text[:500])
        continue
    applied = apply_resp.json()
    company = applied["company"]
    print(f"applied -> company_id={company['id']} type={company.get('type')} "
          f"departments={len(applied['department_ids'])} staff={len(applied['staff_ids'])} "
          f"skills={len(applied['skill_ids'])}")
    results[archetype] = {"plan": plan, "applied": applied}

with open("/tmp/office_builder_results.json", "w") as f:
    json.dump(results, f, indent=2)
print("\nSaved full results to /tmp/office_builder_results.json")
