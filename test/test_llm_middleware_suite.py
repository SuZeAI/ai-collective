"""Tests for the additional middleware suite: guardrail, PII, tool cache,
rolling summary, cost budget, and LTM recall/persist.

No pytest-asyncio in this repo — async paths run via ``asyncio.run()``.
"""

from __future__ import annotations

import asyncio

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from backend.api.settings import settings
from backend.infrastructure.llm.middleware import (
    CostBudgetMiddleware,
    GuardrailMiddleware,
    LongTermMemoryMiddleware,
    PIIRedactionMiddleware,
    RollingSummaryMiddleware,
    ToolResultCacheMiddleware,
    build_default_middleware,
)
from backend.infrastructure.llm.middleware import config as middleware_config


class _Request:
    def __init__(self, tool_call: dict, messages: list) -> None:
        self.tool_call = tool_call
        self.state = {"messages": messages}


def _run(coro):
    return asyncio.run(coro)


# --------------------------------------------------------------------------- #
# Guardrail                                                                   #
# --------------------------------------------------------------------------- #

def test_guardrail_blocks_denied_tool():
    mw = GuardrailMiddleware(deny_tools=["danger"], deny_patterns=[])
    called = {"h": False}

    async def handler(_):
        called["h"] = True
        return ToolMessage(tool_call_id="1", name="danger", content="ran")

    res = _run(mw.awrap_tool_call(_Request({"name": "danger", "args": {}, "id": "1"}, []), handler))
    assert not called["h"]
    assert "Blocked by guardrail" in res.content


def test_guardrail_blocks_pattern_in_args():
    mw = GuardrailMiddleware(deny_tools=[], deny_patterns=[r"rm -rf"])

    async def handler(_):
        return ToolMessage(tool_call_id="2", name="shell", content="ran")

    res = _run(mw.awrap_tool_call(_Request({"name": "shell", "args": {"cmd": "rm -rf /"}, "id": "2"}, []), handler))
    assert "Blocked by guardrail" in res.content


def test_guardrail_allows_clean_call():
    mw = GuardrailMiddleware(deny_tools=["danger"], deny_patterns=[])

    async def handler(_):
        return ToolMessage(tool_call_id="3", name="safe", content="ok")

    res = _run(mw.awrap_tool_call(_Request({"name": "safe", "args": {}, "id": "3"}, []), handler))
    assert res.content == "ok"


# --------------------------------------------------------------------------- #
# PII redaction                                                               #
# --------------------------------------------------------------------------- #

def test_pii_redaction_scrubs_results():
    mw = PIIRedactionMiddleware()

    async def handler(_):
        return ToolMessage(
            tool_call_id="1",
            name="lookup",
            content="email a@b.com card 4111 1111 1111 1111 key sk-ABCDEFGHIJKLMNOPQR",
        )

    res = _run(mw.awrap_tool_call(_Request({"name": "lookup", "args": {}, "id": "1"}, []), handler))
    assert "[REDACTED_EMAIL]" in res.content
    assert "[REDACTED_CARD]" in res.content
    assert "[REDACTED_SECRET]" in res.content
    assert "a@b.com" not in res.content


# --------------------------------------------------------------------------- #
# Tool result cache                                                           #
# --------------------------------------------------------------------------- #

def test_tool_cache_serves_prior_result():
    mw = ToolResultCacheMiddleware(deny_tools=[])
    prior_ai = AIMessage(content="", tool_calls=[{"name": "calc", "args": {"x": 1}, "id": "callA"}])
    prior_tool = ToolMessage(tool_call_id="callA", name="calc", content="42")
    hit = {"h": False}

    async def handler(_):
        hit["h"] = True
        return ToolMessage(tool_call_id="callB", name="calc", content="recomputed")

    res = _run(
        mw.awrap_tool_call(
            _Request({"name": "calc", "args": {"x": 1}, "id": "callB"}, [prior_ai, prior_tool]),
            handler,
        )
    )
    assert not hit["h"]
    assert res.content == "42"


def test_tool_cache_skips_denied_tool():
    mw = ToolResultCacheMiddleware(deny_tools=["calc"])
    prior_ai = AIMessage(content="", tool_calls=[{"name": "calc", "args": {"x": 1}, "id": "callA"}])
    prior_tool = ToolMessage(tool_call_id="callA", name="calc", content="42")
    hit = {"h": False}

    async def handler(_):
        hit["h"] = True
        return ToolMessage(tool_call_id="callB", name="calc", content="recomputed")

    res = _run(
        mw.awrap_tool_call(
            _Request({"name": "calc", "args": {"x": 1}, "id": "callB"}, [prior_ai, prior_tool]),
            handler,
        )
    )
    assert hit["h"]
    assert res.content == "recomputed"


# --------------------------------------------------------------------------- #
# Rolling summary                                                             #
# --------------------------------------------------------------------------- #

def test_rolling_summary_folds_old_messages():
    mw = RollingSummaryMiddleware(trigger_tokens=10, keep_messages=2)
    msgs = [HumanMessage(content="x" * 400, id=f"m{i}") for i in range(6)]
    upd = mw.before_model({"messages": msgs}, None)
    removed = [u for u in upd["messages"] if u.__class__.__name__ == "RemoveMessage"]
    summaries = [u for u in upd["messages"] if isinstance(u, SystemMessage)]
    assert len(removed) == 4
    assert len(summaries) == 1
    assert "CONVERSATION SUMMARY" in summaries[0].content


def test_rolling_summary_noop_under_trigger():
    mw = RollingSummaryMiddleware(trigger_tokens=100000, keep_messages=2)
    msgs = [HumanMessage(content="short", id=f"m{i}") for i in range(6)]
    assert mw.before_model({"messages": msgs}, None) is None


# --------------------------------------------------------------------------- #
# Cost budget                                                                 #
# --------------------------------------------------------------------------- #

def test_cost_budget_nudges_over_budget():
    mw = CostBudgetMiddleware(budget=10)
    upd = mw.before_model({"messages": [HumanMessage(content="y" * 400, id="a")]}, None)
    assert "TOKEN BUDGET REACHED" in upd["messages"][0].content


def test_cost_budget_disabled_when_zero():
    mw = CostBudgetMiddleware(budget=0)
    assert mw.before_model({"messages": [HumanMessage(content="y" * 4000, id="a")]}, None) is None


# --------------------------------------------------------------------------- #
# Build gating                                                                #
# --------------------------------------------------------------------------- #

def test_new_middleware_off_by_default(monkeypatch):
    monkeypatch.setattr(settings.llm, "rolling_summary_enabled", False)
    monkeypatch.setattr(settings.llm, "ltm_middleware_enabled", False)
    monkeypatch.setattr(settings.llm, "tool_cache_enabled", False)
    monkeypatch.setattr(settings.llm, "pii_redaction_enabled", False)
    monkeypatch.setattr(settings.llm, "run_token_budget", 0)
    monkeypatch.setattr(settings.llm, "guardrail_deny_tools", None)
    monkeypatch.setattr(settings.llm, "guardrail_deny_patterns", None)
    names = {type(m).__name__ for m in build_default_middleware(max_tool_rounds=6)}
    for absent in {
        "RollingSummaryMiddleware",
        "LongTermMemoryMiddleware",
        "ToolResultCacheMiddleware",
        "PIIRedactionMiddleware",
        "CostBudgetMiddleware",
        "GuardrailMiddleware",
    }:
        assert absent not in names


def test_new_middleware_enabled_when_configured(monkeypatch):
    # config.yml's `middleware:` section takes precedence over settings.llm.*
    # when it declares a value; empty it out so the settings.llm fallback below
    # is what's actually under test.
    monkeypatch.setattr(middleware_config, "_section", lambda: {})
    monkeypatch.setattr(settings.llm, "rolling_summary_enabled", True)
    monkeypatch.setattr(settings.llm, "ltm_middleware_enabled", True)
    monkeypatch.setattr(settings.llm, "tool_cache_enabled", True)
    monkeypatch.setattr(settings.llm, "pii_redaction_enabled", True)
    monkeypatch.setattr(settings.llm, "run_token_budget", 5000)
    monkeypatch.setattr(settings.llm, "guardrail_deny_tools", "danger")
    names = {type(m).__name__ for m in build_default_middleware(max_tool_rounds=6)}
    for present in {
        "RollingSummaryMiddleware",
        "LongTermMemoryMiddleware",
        "ToolResultCacheMiddleware",
        "PIIRedactionMiddleware",
        "CostBudgetMiddleware",
        "GuardrailMiddleware",
    }:
        assert present in names


# --------------------------------------------------------------------------- #
# LTM middleware (recall + persist)                                           #
# --------------------------------------------------------------------------- #

def test_ltm_middleware_noop_without_scope():
    from backend.infrastructure import long_term_memory_store as ltm

    mw = LongTermMemoryMiddleware()
    # No scope bound → no-op regardless of enablement.
    ltm.current_memory_scope.set(None)
    assert _run(mw.abefore_model({"messages": [HumanMessage(content="hi")]}, None)) is None
