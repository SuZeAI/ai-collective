"""Regression test: unauthenticated (no Authorization header) writes are rejected.

Previously every request with no Authorization header resolved to the shared
GUEST_OWNER_ID scope regardless of HTTP method, so any two anonymous callers
could read/edit/delete each other's data (they were both literally "guest").
Guest reads are still allowed (unauthenticated public content, e.g. the shared
"default" catalog); only writes now require a real login.
"""

from __future__ import annotations

from conftest import API


def test_unauthenticated_post_is_rejected(client):
    resp = client.post(f"{API}/companies", json={"name": "x", "type": "software"})
    assert resp.status_code == 401


def test_unauthenticated_delete_is_rejected(client):
    resp = client.delete(f"{API}/tasks/some-task-id")
    assert resp.status_code == 401


def test_unauthenticated_get_is_still_allowed(client):
    resp = client.get(f"{API}/staff")
    assert resp.status_code == 200
