"""API tests for the "no LLM provider configured" path.

This test session forces every provider API key empty (see conftest.py) so
the suite never depends on network access or a real key. That means every
LLM-backed endpoint must take its documented graceful-degradation branch
(HTTP 503) instead of raising -- this is itself a real behavior worth
locking down, since it's what a fresh clone / CI run looks like before any
key is configured.
"""

from __future__ import annotations

from conftest import API, make_staff, unique


def test_chat_returns_503_when_no_provider_configured(client, user_headers):
    resp = client.post(f"{API}/llm/chat", json={"prompt": "hello"}, headers=user_headers)
    assert resp.status_code == 503


def test_staff_graph_run_returns_503_when_no_provider_configured(client, user_headers):
    staff = make_staff(client, user_headers)

    resp = client.post(
        f"{API}/llm/staff-graph/run",
        json={"user_input": "hello", "staff": [staff["id"]], "mode": "sequential"},
        headers=user_headers,
    )
    assert resp.status_code == 503


def test_planner_decompose_returns_503_when_no_provider_configured(client, user_headers):
    key = unique("DEC").upper()[:10]
    project = client.post(f"{API}/projects", json={"key": key, "name": "P"}, headers=user_headers).json()

    resp = client.post(
        f"{API}/planner/decompose",
        json={"projectId": project["id"], "description": "Plan something"},
        headers=user_headers,
    )
    assert resp.status_code == 503


def test_department_generate_returns_503_when_no_provider_configured(client, user_headers):
    make_staff(client, user_headers)

    resp = client.post(
        f"{API}/departments/generate",
        json={"prompt": "A support department"},
        headers=user_headers,
    )
    assert resp.status_code == 503


def test_staff_generate_returns_503_when_no_provider_configured(client, user_headers):
    resp = client.post(
        f"{API}/staff/generate",
        json={"prompt": "A staff member who searches the web"},
        headers=user_headers,
    )
    assert resp.status_code == 503


def test_skill_generate_returns_503_when_no_provider_configured(client, user_headers):
    resp = client.post(
        f"{API}/skills/generate",
        json={"prompt": "Something that can send Slack messages"},
        headers=user_headers,
    )
    assert resp.status_code == 503
