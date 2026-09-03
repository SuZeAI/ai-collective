"""API smoke tests for health, task queue status, analytics, and the admin
monitoring endpoints."""

from __future__ import annotations

from conftest import API


def test_health_endpoint(client):
    resp = client.get(f"{API}/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_task_queue_status(client, user_headers):
    resp = client.get(f"{API}/tasks/queue/status", headers=user_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["backend"] == "memory"
    assert isinstance(body["running"], list)


def test_analytics_endpoint(client, user_headers):
    resp = client.get(f"{API}/analytics", headers=user_headers)
    assert resp.status_code == 200
    assert "tasksCompleted" in resp.json()


def test_admin_monitoring_requires_no_special_role_but_returns_global_data(client, admin_headers):
    for path in (
        "/admin/monitoring/usage",
        "/admin/monitoring/pricing",
        "/admin/monitoring/users",
        "/admin/monitoring/file-storage",
        "/admin/monitoring/health",
    ):
        resp = client.get(f"{API}{path}", headers=admin_headers)
        assert resp.status_code == 200, f"{path} -> {resp.status_code}: {resp.text}"


def test_activity_feed_and_office_builder_sessions_are_listable(client, user_headers):
    feed = client.get(f"{API}/activity-feed", headers=user_headers)
    assert feed.status_code == 200
    assert isinstance(feed.json(), list)

    sessions = client.get(f"{API}/office-builder/sessions", headers=user_headers)
    assert sessions.status_code == 200
    assert isinstance(sessions.json(), list)


def test_library_documents_listable(client, user_headers):
    resp = client.get(f"{API}/library/documents", headers=user_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
