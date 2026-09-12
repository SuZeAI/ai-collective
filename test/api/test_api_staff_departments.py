"""API tests for /staff and /departments."""

from __future__ import annotations

from conftest import API, make_department, make_staff, unique


def test_create_staff_and_list(client, user_headers):
    resp = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Researcher", "description": "digs up facts", "skill_ids": []},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["role"] == "Researcher"
    assert body["status"] == "idle"

    listed = client.get(f"{API}/staff", headers=user_headers)
    assert any(s["id"] == body["id"] for s in listed.json())

    deleted = client.delete(f"{API}/staff/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_create_department_with_staff_members(client, user_headers):
    staff = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Writer", "description": "", "skill_ids": []},
        headers=user_headers,
    ).json()

    resp = client.post(
        f"{API}/departments",
        json={
            "name": "Content Team",
            "description": "writes things",
            "staff": [staff["id"]],
            "mode": "mesh",
            "maxSteps": 8,
        },
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["staff"] == [staff["id"]]
    assert body["mode"] == "mesh"
    assert body["maxSteps"] == 8

    deleted = client.delete(f"{API}/departments/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_department_requires_staff_field(client, user_headers):
    resp = client.post(f"{API}/departments", json={"name": "No staff field"}, headers=user_headers)
    assert resp.status_code == 422


def test_delete_department_cascade_unlinks_company_and_removes_exclusive_staff(client, user_headers):
    company = client.post(
        f"{API}/companies", json={"name": unique("company"), "type": "general"}, headers=user_headers
    ).json()
    staff = make_staff(client, user_headers)
    department = make_department(client, user_headers, staff=[staff["id"]], company_id=company["id"])

    company = client.post(
        f"{API}/companies",
        json={"id": company["id"], "name": company["name"], "departmentIds": [department["id"]]},
        headers=user_headers,
    ).json()
    assert company["departmentIds"] == [department["id"]]

    impact = client.get(f"{API}/departments/{department['id']}/impact", headers=user_headers).json()
    assert impact["affected_companies"] == [{"id": company["id"], "name": company["name"]}]
    assert impact["staff_removed"] == 1

    deleted = client.delete(f"{API}/departments/{department['id']}", headers=user_headers)
    assert deleted.status_code == 200
    assert deleted.json()["removed_staff"] == 1

    refreshed_company = client.get(f"{API}/companies/{company['id']}", headers=user_headers).json()
    assert department["id"] not in refreshed_company["departmentIds"]

    staff_after = client.get(f"{API}/staff", headers=user_headers).json()
    assert all(s["id"] != staff["id"] for s in staff_after)


def test_delete_staff_cascade_unassigns_from_department(client, user_headers):
    staff = make_staff(client, user_headers)
    department = make_department(client, user_headers, staff=[staff["id"]])

    impact = client.get(f"{API}/staff/{staff['id']}/impact", headers=user_headers).json()
    assert impact["departments_updated"] == 1

    deleted = client.delete(f"{API}/staff/{staff['id']}", headers=user_headers)
    assert deleted.status_code == 200
    assert deleted.json()["departments_updated"] == 1

    departments = client.get(f"{API}/departments", headers=user_headers).json()
    refreshed = next(d for d in departments if d["id"] == department["id"])
    assert staff["id"] not in refreshed["staff"]
