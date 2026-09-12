"""API tests for /companies, /skills, /connections.

Connections hold shared third-party credentials with no per-owner scoping, so
the router restricts every /connections endpoint to admin/system accounts
(see `require_admin` in server/api/routers/connections.py) -- these tests
use admin_headers, not user_headers.
"""

from __future__ import annotations

from conftest import API, make_department, make_staff, unique


def test_create_company_and_list(client, user_headers):
    resp = client.post(
        f"{API}/companies",
        json={"name": unique("company"), "description": "a test company", "type": "software"},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["departmentIds"] == []

    listed = client.get(f"{API}/companies", headers=user_headers)
    assert any(c["id"] == body["id"] for c in listed.json())

    fetched = client.get(f"{API}/companies/{body['id']}", headers=user_headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]

    deleted = client.delete(f"{API}/companies/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200

    missing = client.get(f"{API}/companies/{body['id']}", headers=user_headers)
    assert missing.status_code == 404


def test_companies_platforms_list_is_public_shape(client, user_headers):
    resp = client.get(f"{API}/companies/platforms", headers=user_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_skill_and_delete(client, user_headers):
    resp = client.post(
        f"{API}/skills",
        json={"name": unique("skill"), "description": "d", "third_party": "Custom", "tool_name": "http", "config": {}},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    deleted = client.delete(f"{API}/skills/{body['id']}", headers=user_headers)
    assert deleted.status_code == 200


def test_delete_skill_cascade_removes_from_staff(client, user_headers):
    skill = client.post(
        f"{API}/skills",
        json={"name": unique("skill"), "description": "d", "third_party": "Custom", "tool_name": "http", "config": {}},
        headers=user_headers,
    ).json()
    staff = make_staff(client, user_headers, skill_ids=[skill["id"]])

    impact = client.get(f"{API}/skills/{skill['id']}/impact", headers=user_headers).json()
    assert impact["staff_updated"] == 1

    deleted = client.delete(f"{API}/skills/{skill['id']}", headers=user_headers)
    assert deleted.status_code == 200
    assert deleted.json()["staff_updated"] == 1

    staff_after = client.get(f"{API}/staff", headers=user_headers).json()
    refreshed = next(s for s in staff_after if s["id"] == staff["id"])
    assert skill["id"] not in refreshed["skill_ids"]


def test_delete_company_cascade_does_not_touch_other_companys_department(client, user_headers):
    company_a = client.post(f"{API}/companies", json={"name": unique("company"), "type": "general"}, headers=user_headers).json()
    company_b = client.post(f"{API}/companies", json={"name": unique("company"), "type": "general"}, headers=user_headers).json()

    dept_a = make_department(client, user_headers, company_id=company_a["id"])
    dept_b = make_department(client, user_headers, company_id=company_b["id"])

    company_a = client.post(
        f"{API}/companies",
        json={"id": company_a["id"], "name": company_a["name"], "departmentIds": [dept_a["id"]]},
        headers=user_headers,
    ).json()
    client.post(
        f"{API}/companies",
        json={"id": company_b["id"], "name": company_b["name"], "departmentIds": [dept_b["id"]]},
        headers=user_headers,
    )

    deleted = client.delete(f"{API}/companies/{company_a['id']}", headers=user_headers)
    assert deleted.status_code == 200
    body = deleted.json()
    assert body["removed_teams"] == 1
    assert body["kept_departments"] == []

    departments = client.get(f"{API}/departments", headers=user_headers).json()
    assert any(d["id"] == dept_b["id"] for d in departments)
    assert all(d["id"] != dept_a["id"] for d in departments)


def test_upsert_company_claims_catalog_department(client, admin_headers, user_headers):
    catalog_dept = client.post(
        f"{API}/departments", json={"name": unique("catalog-dept"), "staff": []}, headers=admin_headers
    ).json()
    assert catalog_dept["company_id"] == "__default__"

    company = client.post(
        f"{API}/companies",
        json={"name": unique("company"), "type": "general", "departmentIds": [catalog_dept["id"]]},
        headers=user_headers,
    ).json()
    assert company["departmentIds"] == [catalog_dept["id"]]

    departments = client.get(f"{API}/departments?company_id={company['id']}", headers=user_headers).json()
    assert any(d["id"] == catalog_dept["id"] for d in departments)


def test_upsert_company_clones_department_owned_by_other_company(client, user_headers):
    company_a = client.post(f"{API}/companies", json={"name": unique("company"), "type": "general"}, headers=user_headers).json()
    staff = make_staff(client, user_headers, company_id=company_a["id"])
    dept_a = make_department(client, user_headers, staff=[staff["id"]], company_id=company_a["id"])

    company_b = client.post(
        f"{API}/companies",
        json={"name": unique("company"), "type": "general", "departmentIds": [dept_a["id"]]},
        headers=user_headers,
    ).json()

    assert company_b["departmentIds"] != [dept_a["id"]]
    cloned_id = company_b["departmentIds"][0]
    assert cloned_id != dept_a["id"]

    departments = client.get(f"{API}/departments", headers=user_headers).json()
    original = next(d for d in departments if d["id"] == dept_a["id"])
    assert original["company_id"] == company_a["id"]
    cloned = next(d for d in departments if d["id"] == cloned_id)
    assert cloned["company_id"] == company_b["id"]
    assert len(cloned["staff"]) == 1
    assert cloned["staff"] != original["staff"]


def test_skills_tools_and_tool_presets_are_listable(client, user_headers):
    tools = client.get(f"{API}/skills/tools", headers=user_headers)
    assert tools.status_code == 200
    assert isinstance(tools.json(), list)
    assert len(tools.json()) > 0

    presets = client.get(f"{API}/skills/tool-presets", headers=user_headers)
    assert presets.status_code == 200
    assert isinstance(presets.json(), list)


def test_create_connection_round_trips_config(client, admin_headers):
    resp = client.post(
        f"{API}/connections",
        json={
            "kind": "outbound",
            "platform": "slack",
            "name": unique("conn"),
            "config": {"webhook_url": "https://hooks.example.com/test"},
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["kind"] == "outbound"
    assert body["config"]["webhook_url"] == "https://hooks.example.com/test"

    listed = client.get(f"{API}/connections", headers=admin_headers)
    assert any(c["id"] == body["id"] for c in listed.json())

    deleted = client.delete(f"{API}/connections/{body['id']}", headers=admin_headers)
    assert deleted.status_code == 200


def test_connections_require_admin_role(client, user_headers):
    resp = client.get(f"{API}/connections", headers=user_headers)
    assert resp.status_code == 403
