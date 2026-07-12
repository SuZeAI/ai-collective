"""API tests for /recruiting (the marketplace catalog + copy-into-own-scope flow).

The recruiting catalog only lists entities owned by the shared "default"
scope (see RecruitingService.list_default_*), which admin-created entities
belong to. So these tests create catalog items as the admin, then copy them
into a regular user's own scope.
"""

from __future__ import annotations

from conftest import API, unique


def test_recruiting_lists_and_copies_a_skill(client, admin_headers, user_headers):
    admin_skill = client.post(
        f"{API}/skills",
        json={"name": unique("catalog-skill"), "description": "d", "third_party": "Custom", "tool_name": "http", "config": {}},
        headers=admin_headers,
    ).json()

    catalog = client.get(f"{API}/recruiting/skills", headers=user_headers)
    assert catalog.status_code == 200
    assert any(s["id"] == admin_skill["id"] for s in catalog.json())

    copied = client.post(
        f"{API}/recruiting/copy",
        json={"type": "skill", "id": admin_skill["id"]},
        headers=user_headers,
    )
    assert copied.status_code == 200, copied.text
    assert copied.json()["type"] == "skill"
    new_id = copied.json()["id"]
    assert new_id != admin_skill["id"]

    my_skills = client.get(f"{API}/skills", headers=user_headers).json()
    assert any(s["id"] == new_id for s in my_skills)


def test_recruiting_copy_of_unknown_id_returns_404(client, user_headers):
    resp = client.post(
        f"{API}/recruiting/copy",
        json={"type": "staff", "id": "agent_does_not_exist"},
        headers=user_headers,
    )
    assert resp.status_code == 404
