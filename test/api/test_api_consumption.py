"""API tests for GET /consumption (the personal Cost Monitoring page).

Regression coverage for a bug found during a manual full-system pass
(2026-07-12): the endpoint filtered `token_usage` records by `owner_id`, but
`current_owner_id_dep` collapses admin/system accounts to the shared
`"default"` scope while every token_usage record is always keyed by the real
authenticated user id -- so /consumption permanently returned all-zero totals
for the admin account (the account most likely to be used for this exact
page). Fixed by switching the endpoint to `current_user_dep` / `user.id` in
server/api/routers/consumption.py.

The regression is seeded at the repository layer (bypassing the LLM) so this
test has no dependency on a configured LLM provider or network access.
"""

from __future__ import annotations

from datetime import datetime, timezone

from conftest import API
from server.api.deps import _monitoring_stores
from server.domain.models import TokenUsageRecord


def _seed_usage_record(user_id: str, input_tokens: int, output_tokens: int) -> None:
    usage_repo, _pricing_repo = _monitoring_stores()
    usage_repo.add(
        TokenUsageRecord(
            id=f"usage_test_{user_id}_{input_tokens}_{output_tokens}",
            provider="google",
            model="gemini-3-flash-preview",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
        )
    )


def test_consumption_reports_admins_own_usage(client, admin_headers):
    me = client.get(f"{API}/auth/me", headers=admin_headers).json()
    assert me["role"] == "admin"

    _seed_usage_record(me["id"], input_tokens=111, output_tokens=222)

    resp = client.get(f"{API}/consumption", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    totals = resp.json()["totals"]
    assert totals["inputTokens"] >= 111
    assert totals["outputTokens"] >= 222
    assert totals["requests"] >= 1


def test_consumption_does_not_leak_between_users(client, user_headers, second_user_headers):
    user_a = client.get(f"{API}/auth/me", headers=user_headers).json()

    _seed_usage_record(user_a["id"], input_tokens=50, output_tokens=60)

    resp_b = client.get(f"{API}/consumption", headers=second_user_headers)
    assert resp_b.status_code == 200
    assert resp_b.json()["totals"]["requests"] == 0

    resp_a = client.get(f"{API}/consumption", headers=user_headers)
    assert resp_a.status_code == 200
    assert resp_a.json()["totals"]["inputTokens"] >= 50
