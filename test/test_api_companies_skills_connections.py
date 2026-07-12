"""API tests for /companies, /skills, /connections.

Connections hold shared third-party credentials with no per-owner scoping, so
the router restricts every /connections endpoint to admin/system accounts
(see `require_admin` in backend/api/routers/connections.py) -- these tests
use admin_headers, not user_headers.
"""

from __future__ import annotations

from conftest import API, unique


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
