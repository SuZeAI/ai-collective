"""API tests for POST /office-builder/apply, focused on reusing existing
departments/staff/skills via existing_id instead of always creating new ones."""

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

    assert body["department_ids"] == [department["id"]]
    assert body["reused_department_ids"] == [department["id"]]
    assert body["staff_ids"] == [staff["id"]]
    assert body["reused_staff_ids"] == [staff["id"]]
    assert body["skill_ids"] == []

    # The reused department must not be duplicated or lose its original staff.
    all_departments = client.get(f"{API}/departments", headers=user_headers).json()
    matches = [d for d in all_departments if d["id"] == department["id"]]
    assert len(matches) == 1
    assert matches[0]["staff"] == [staff["id"]]


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
    assert body["reused_skill_ids"] == [skill["id"]]

    all_staff = client.get(f"{API}/staff", headers=user_headers).json()
    new_staff = next(s for s in all_staff if s["id"] == body["staff_ids"][0])
    assert new_staff["skill_ids"] == [skill["id"]]


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

    new_staff_id = body["staff_ids"][0]
    assert body["reused_staff_ids"] == []

    all_departments = client.get(f"{API}/departments", headers=user_headers).json()
    matches = [d for d in all_departments if d["id"] == department["id"]]
    assert len(matches) == 1
    assert set(matches[0]["staff"]) == {existing_staff["id"], new_staff_id}
