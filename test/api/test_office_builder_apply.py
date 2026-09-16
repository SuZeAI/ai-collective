"""API tests for POST /office-builder/apply, focused on reusing existing
departments/staff/skills via existing_id. apply() always creates a brand-new
company, and Staff/Skill/Department each belong to exactly one company, so
"reusing" a template clones it into the new company rather than referencing
the original row in place."""

from __future__ import annotations

from conftest import API, make_department, make_staff, unique


def _create_skill(client, headers, name: str) -> dict:
    resp = client.post(
        f"{API}/skills",
        json={"name": name, "description": "", "tool_name": None},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_apply_reuses_existing_department_and_staff_by_existing_id(client, user_headers):
    skill = _create_skill(client, user_headers, unique("skill"))
    staff = make_staff(client, user_headers, role="Specialist", skill_ids=[skill["id"]])
    department = make_department(client, user_headers, staff=[staff["id"]])

    plan = {
        "name": unique("office"),
        "description": "",
        "company_type": "general",
        "departments": [
            {
                "existing_id": department["id"],
                "name": department["name"],
                "description": "",
                "mode": "sequential",
                "staff": [
                    {
                        "existing_id": staff["id"],
                        "name": staff["name"],
                        "role": staff["role"],
                        "description": "",
                        "skills": [],
                    }
                ],
            }
        ],
    }

    resp = client.post(f"{API}/office-builder/apply", json={"plan": plan}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Reusing clones the template into the new company; the original ids are
    # never reused in place, and each template is cloned exactly once even
    # though it's referenced both as the department's own staff and directly
    # as a plan member.
    assert len(body["department_ids"]) == 1
    assert body["department_ids"] == body["reused_department_ids"]
    assert body["department_ids"][0] != department["id"]
    assert len(body["staff_ids"]) == 1
    assert body["staff_ids"] == body["reused_staff_ids"]
    assert body["staff_ids"][0] != staff["id"]
    assert body["skill_ids"] == []

    # The original template department/staff are untouched, and a distinct
    # clone now exists with the cloned staff.
    all_departments = client.get(f"{API}/departments", headers=user_headers).json()
    original = next(d for d in all_departments if d["id"] == department["id"])
    assert original["staff"] == [staff["id"]]
    cloned = next(d for d in all_departments if d["id"] == body["department_ids"][0])
    assert cloned["staff"] == body["staff_ids"]


def test_apply_reuses_existing_skill_by_existing_id_for_new_staff(client, user_headers):
    skill = _create_skill(client, user_headers, unique("skill"))

    plan = {
        "name": unique("office"),
        "description": "",
        "company_type": "general",
        "departments": [
            {
                "existing_id": None,
                "name": unique("dept"),
                "description": "",
                "mode": "sequential",
                "staff": [
                    {
                        "existing_id": None,
                        "name": unique("staff"),
                        "role": "Specialist",
                        "description": "",
                        "skills": [
                            {"existing_id": skill["id"], "name": skill["name"], "description": "", "tool_name": None}
                        ],
                    }
                ],
            }
        ],
    }

    resp = client.post(f"{API}/office-builder/apply", json={"plan": plan}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["skill_ids"] == []
    assert len(body["reused_skill_ids"]) == 1
    cloned_skill_id = body["reused_skill_ids"][0]
    assert cloned_skill_id != skill["id"]

    all_staff = client.get(f"{API}/staff", headers=user_headers).json()
    new_staff = next(s for s in all_staff if s["id"] == body["staff_ids"][0])
    assert new_staff["skill_ids"] == [cloned_skill_id]


def test_apply_adds_new_staff_into_reused_department(client, user_headers):
    existing_staff = make_staff(client, user_headers, role="Specialist")
    department = make_department(client, user_headers, staff=[existing_staff["id"]])

    plan = {
        "name": unique("office"),
        "description": "",
        "company_type": "general",
        "departments": [
            {
                "existing_id": department["id"],
                "name": department["name"],
                "description": "",
                "mode": "sequential",
                "staff": [
                    {
                        "existing_id": None,
                        "name": unique("newstaff"),
                        "role": "Specialist",
                        "description": "",
                        "skills": [],
                    }
                ],
            }
        ],
    }

    resp = client.post(f"{API}/office-builder/apply", json={"plan": plan}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # The plan's brand-new member plus a clone of the department's existing
    # (template) staff member.
    assert len(body["staff_ids"]) == 2
    assert len(body["reused_staff_ids"]) == 1
    cloned_existing_staff_id = body["reused_staff_ids"][0]
    assert cloned_existing_staff_id != existing_staff["id"]
    new_staff_id = next(sid for sid in body["staff_ids"] if sid != cloned_existing_staff_id)

    new_department_id = body["department_ids"][0]
    assert new_department_id != department["id"]

    all_departments = client.get(f"{API}/departments", headers=user_headers).json()
    original = next(d for d in all_departments if d["id"] == department["id"])
    assert original["staff"] == [existing_staff["id"]]
    cloned = next(d for d in all_departments if d["id"] == new_department_id)
    assert set(cloned["staff"]) == {cloned_existing_staff_id, new_staff_id}
