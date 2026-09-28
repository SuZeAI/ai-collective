"""Regression test: a staff's skill_ids must be filtered to skills the caller can see.

Found via real-HTTP exploratory testing against a full docker stack: a Recruiting
catalog staff had picked up a skill_id belonging to a different user's private
company, so its (possibly secret-bearing) config leaked to every caller of
GET /recruiting/staff and GET /staff. Root cause: POST /staff accepted any
skill_id verbatim, with no ownership check, and the nested-skill resolution used
for both listings didn't filter by visibility either.
"""

from __future__ import annotations

from conftest import API, make_staff, unique


def test_upsert_staff_drops_skill_ids_not_visible_to_caller(client, user_headers, second_user_headers):
    private_skill = client.post(
        f"{API}/skills",
        json={"name": unique("secret-skill"), "description": "", "kind": "integration"},
        headers=user_headers,
    )
    assert private_skill.status_code == 200, private_skill.text
    private_skill_id = private_skill.json()["id"]

    # second_user tries to attach the first user's private skill to their own staff.
    staff = make_staff(client, second_user_headers, skill_ids=[private_skill_id])

    assert staff["skill_ids"] == []
    assert staff["skills"] == []


def test_list_staff_never_embeds_a_skill_the_caller_cannot_see(client, user_headers, second_user_headers):
    private_skill = client.post(
        f"{API}/skills",
        json={"name": unique("secret-skill"), "description": "", "kind": "integration"},
        headers=user_headers,
    )
    private_skill_id = private_skill.json()["id"]

    # second_user's own skill, so it's a legitimate skill_id for them...
    own_skill = client.post(
        f"{API}/skills",
        json={"name": unique("own-skill"), "description": "", "kind": "integration"},
        headers=second_user_headers,
    )
    own_skill_id = own_skill.json()["id"]
    staff = make_staff(client, second_user_headers, skill_ids=[own_skill_id])

    # ...even if legacy/corrupted data somehow put the other user's skill_id
    # onto their staff record, listing must never surface it.
    from dataclasses import replace

    from server.api.deps import get_staff_service

    staff_service = get_staff_service()
    domain_staff = staff_service.get_staff(staff["id"])
    staff_service.upsert_staff(replace(domain_staff, skill_ids=[own_skill_id, private_skill_id]))

    listed = client.get(f"{API}/staff", headers=second_user_headers)
    assert listed.status_code == 200
    entry = next(s for s in listed.json() if s["id"] == staff["id"])
    assert entry["skill_ids"] == [own_skill_id, private_skill_id]  # not filtered at the id level
    assert [s["id"] for s in entry["skills"]] == [own_skill_id]  # but never resolved/embedded
