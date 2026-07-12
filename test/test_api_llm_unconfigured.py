"""API tests for the "no LLM provider configured" path.

This test session forces every provider API key empty (see conftest.py) so
the suite never depends on network access or a real key. That means every
LLM-backed endpoint must take its documented graceful-degradation branch
(HTTP 503) instead of raising -- this is itself a real behavior worth
locking down, since it's what a fresh clone / CI run looks like before any
key is configured.
"""

from __future__ import annotations

from conftest import API, unique


def test_chat_returns_503_when_no_provider_configured(client, user_headers):
    resp = client.post(f"{API}/llm/chat", json={"prompt": "hello"}, headers=user_headers)
    assert resp.status_code == 503


def test_staff_graph_run_returns_503_when_no_provider_configured(client, user_headers):
    staff = client.post(
        f"{API}/staff",
        json={"name": unique("staff"), "role": "Tester", "description": "", "skill_ids": []},
        headers=user_headers,
    ).json()

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
