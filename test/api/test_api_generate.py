"""API tests for the AI-generate endpoints (/departments/generate, /staff/generate,
/skills/generate).

These endpoints hand the LLM a curated roster/catalog (scoped to the requested
company) and ask it to pick staff/skill ids from it. The LLM's raw JSON is
untrusted input, so the router must filter its response down to ids that
actually exist in the requested company before returning it -- otherwise a
generated department could end up "assigned" to staff from another company,
or to an id the LLM hallucinated outright.

test_api_llm_unconfigured.py covers the "no provider configured" (503) path;
these tests override the `get_llm_service` dependency with a fake provider
that returns a canned JSON payload, so the sanitization/filtering logic can
be exercised without a real LLM call.
"""

from __future__ import annotations

import pytest

from conftest import API, make_staff, unique
from server.api.deps import get_llm_service
from server.api.main import app


class _FakeProvider:
    def __init__(self, payload: dict):
        self._payload = payload

    async def generate_json(self, *, system: str, user: str) -> dict:
        return self._payload


class _FakeLLMService:
    def __init__(self, payload: dict):
        self._provider = _FakeProvider(payload)

    def get_provider(self):
        return self._provider


@pytest.fixture
def fake_llm():
    """Override the LLM dependency for one test with a canned JSON payload.

    Restores the real (test-session-unconfigured -> None) dependency after
    the test so other tests keep exercising the 503 "not configured" path.
    """

    def _set(payload: dict) -> None:
        app.dependency_overrides[get_llm_service] = lambda: _FakeLLMService(payload)

    yield _set
    app.dependency_overrides.pop(get_llm_service, None)


def _make_company(client, headers, name_prefix: str) -> dict:
    resp = client.post(
        f"{API}/companies",
        json={"name": unique(name_prefix), "description": "", "type": "software"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _make_skill(client, headers, *, company_id: str | None = None) -> dict:
    payload = {
        "name": unique("skill"),
        "description": "d",
        "third_party": "Custom",
        "tool_name": "http",
        "config": {},
    }
    if company_id:
        payload["company_id"] = company_id
    resp = client.post(f"{API}/skills", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_department_generate_only_assigns_staff_from_requested_company(client, user_headers, fake_llm):
    company_a = _make_company(client, user_headers, "coA")
    company_b = _make_company(client, user_headers, "coB")

    staff_a1 = make_staff(client, user_headers, company_id=company_a["id"])
    staff_a2 = make_staff(client, user_headers, company_id=company_a["id"])
    staff_b1 = make_staff(client, user_headers, company_id=company_b["id"])

    fake_llm(
        {
            "name": "Support Crew",
            "description": "Handles support",
            "mode": "mesh",
            "maxSteps": 5,
            # the LLM tries to assign staff from another company AND an id
            # that doesn't exist at all -- both must be dropped.
            "staffIds": [staff_a1["id"], staff_b1["id"], "staff_does_not_exist"],
        }
    )

    resp = client.post(
        f"{API}/departments/generate",
        json={"prompt": "a support team", "company_id": company_a["id"]},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["staffIds"] == [staff_a1["id"]], (
        "department generation must only assign staff ids that belong to the "
        "requested company -- staff from another company or hallucinated ids "
        "must be filtered out"
    )
    assert staff_a2["id"] not in body["staffIds"], "must not auto-include company staff the LLM didn't pick"
    assert body["mode"] == "mesh"
    assert body["maxSteps"] == 5


def test_department_generate_sanitizes_invalid_mode_and_clamps_max_steps(client, user_headers, fake_llm):
    fake_llm({"name": "X", "description": "d", "mode": "chaos", "maxSteps": 999, "staffIds": []})

    resp = client.post(f"{API}/departments/generate", json={"prompt": "anything"}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mode"] == "sequential", "unrecognized mode from the LLM must fall back to sequential"
    assert body["maxSteps"] == 10, "maxSteps must be clamped to the 1-10 range"


def test_staff_generate_only_assigns_skills_from_requested_company(client, user_headers, fake_llm):
    company_a = _make_company(client, user_headers, "coA")
    company_b = _make_company(client, user_headers, "coB")

    skill_a = _make_skill(client, user_headers, company_id=company_a["id"])
    skill_b = _make_skill(client, user_headers, company_id=company_b["id"])

    fake_llm(
        {
            "name": "Ava",
            "role": "Support Agent",
            "description": "Handles tickets",
            "skillIds": [skill_a["id"], skill_b["id"], "skill_does_not_exist"],
        }
    )

    resp = client.post(
        f"{API}/staff/generate",
        json={"prompt": "a support agent", "company_id": company_a["id"]},
        headers=user_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["skillIds"] == [skill_a["id"]], (
        "staff generation must only equip skill ids that belong to the requested "
        "company -- skills from another company or hallucinated ids must be filtered out"
    )


def test_skill_generate_rejects_hallucinated_tool_name(client, user_headers, fake_llm):
    tools = client.get(f"{API}/skills/tools", headers=user_headers).json()

    fake_llm({"name": "Slack Poster", "description": "d", "toolName": "not_a_real_tool", "instruction": "use it"})

    resp = client.post(f"{API}/skills/generate", json={"prompt": "post to slack"}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["toolName"] != "not_a_real_tool"
    assert body["toolName"] in tools, "toolName must fall back to a real registry entry, not the hallucinated one"


def test_skill_generate_accepts_valid_tool_name(client, user_headers, fake_llm):
    tools = client.get(f"{API}/skills/tools", headers=user_headers).json()
    valid_tool = "slack_messaging" if "slack_messaging" in tools else tools[0]

    fake_llm({"name": "Slack Poster", "description": "d", "toolName": valid_tool, "instruction": "use it"})

    resp = client.post(f"{API}/skills/generate", json={"prompt": "post to slack"}, headers=user_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["toolName"] == valid_tool
