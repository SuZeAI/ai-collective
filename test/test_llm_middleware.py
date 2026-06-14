"""Tests for the LLM agent middleware stack.

Covers the custom ``LoopDetectionMiddleware`` (repeated-identical-tool-call
short-circuit) and the gating in ``build_default_middleware``.

No pytest-asyncio in this repo, so async paths are driven via ``asyncio.run()``.
"""

from __future__ import annotations

import asyncio

from langchain_core.messages import AIMessage, ToolMessage

from backend.api.settings import settings
from backend.infrastructure.llm.middleware import (
    ContextEditingMiddleware,
    LoopDetectionMiddleware,
    ModelRetryMiddleware,
    ToolCallLimitMiddleware,
    ToolRetryMiddleware,
    ToolTimeoutMiddleware,
    build_default_middleware,
)


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

class _Request:
    """Minimal stand-in for ``ToolCallRequest`` (only the attrs we read)."""

    def __init__(self, tool_call: dict, messages: list) -> None:
        self.tool_call = tool_call
        self.state = {"messages": messages}


def _ai_with_call(name: str, args: dict, call_id: str = "x") -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[{"name": name, "args": args, "id": call_id, "type": "tool_call"}],
    )


def _run(coro):
    return asyncio.run(coro)


# --------------------------------------------------------------------------- #
# LoopDetectionMiddleware                                                      #
# --------------------------------------------------------------------------- #

def test_loop_short_circuits_at_threshold():
    mw = LoopDetectionMiddleware(max_repeats=3)
    call = {"name": "search", "args": {"q": "x"}, "id": "now"}
    history = [_ai_with_call("search", {"q": "x"}, f"prev{i}") for i in range(3)]
    request = _Request(call, history)

    awaited = False

    async def handler(_req):
        nonlocal awaited
        awaited = True
        return ToolMessage(tool_call_id="now", name="search", content="real result")

    result = _run(mw.awrap_tool_call(request, handler))

    assert awaited is False, "handler must NOT run once the loop threshold is hit"
    assert isinstance(result, ToolMessage)
    assert result.tool_call_id == "now"
    assert result.name == "search"
    assert "Loop detected" in result.content


def test_loop_passes_through_below_threshold():
    mw = LoopDetectionMiddleware(max_repeats=3)
    call = {"name": "search", "args": {"q": "x"}, "id": "now"}
    history = [_ai_with_call("search", {"q": "x"}, f"prev{i}") for i in range(2)]
    request = _Request(call, history)

    async def handler(_req):
        return ToolMessage(tool_call_id="now", name="search", content="real result")

    result = _run(mw.awrap_tool_call(request, handler))

    assert isinstance(result, ToolMessage)
    assert result.content == "real result"


def test_loop_distinguishes_differing_args():
    mw = LoopDetectionMiddleware(max_repeats=2)
    call = {"name": "search", "args": {"q": "current"}, "id": "now"}
    # Same tool name but different args earlier — must not count toward the loop.
    history = [_ai_with_call("search", {"q": f"other{i}"}, f"p{i}") for i in range(5)]
    request = _Request(call, history)

    async def handler(_req):
        return ToolMessage(tool_call_id="now", name="search", content="real result")

    result = _run(mw.awrap_tool_call(request, handler))

    assert result.content == "real result"


def test_loop_disabled_when_max_repeats_zero():
    mw = LoopDetectionMiddleware(max_repeats=0)
    call = {"name": "search", "args": {"q": "x"}, "id": "now"}
    history = [_ai_with_call("search", {"q": "x"}, f"p{i}") for i in range(10)]
    request = _Request(call, history)

    async def handler(_req):
        return ToolMessage(tool_call_id="now", name="search", content="real result")

    result = _run(mw.awrap_tool_call(request, handler))
    assert result.content == "real result"


# --------------------------------------------------------------------------- #
# build_default_middleware composition                                         #
# --------------------------------------------------------------------------- #

def _types(stack):
    return [type(m) for m in stack]


def test_build_default_includes_loop_detection_by_default():
    stack = build_default_middleware(max_tool_rounds=6)
    types = _types(stack)
    assert LoopDetectionMiddleware in types
    # Loop detection must precede retry + timeout wrappers.
    idx_loop = types.index(LoopDetectionMiddleware)
    if ToolRetryMiddleware in types:
        assert idx_loop < types.index(ToolRetryMiddleware)
    assert idx_loop < types.index(ToolTimeoutMiddleware)


def test_build_default_gates_optional_middleware(monkeypatch):
    monkeypatch.setattr(settings.llm, "loop_detection_enabled", False)
    monkeypatch.setattr(settings.llm, "tool_call_limit", 0)
    monkeypatch.setattr(settings.llm, "model_retry_max", 0)
    monkeypatch.setattr(settings.llm, "context_editing_enabled", False)

    types = _types(build_default_middleware(max_tool_rounds=6))
    assert LoopDetectionMiddleware not in types
    assert ToolCallLimitMiddleware not in types
    assert ModelRetryMiddleware not in types
    assert ContextEditingMiddleware not in types


def test_build_default_enables_optional_middleware(monkeypatch):
    monkeypatch.setattr(settings.llm, "tool_call_limit", 20)
    monkeypatch.setattr(settings.llm, "model_retry_max", 2)
    monkeypatch.setattr(settings.llm, "context_editing_enabled", True)

    types = _types(build_default_middleware(max_tool_rounds=6))
    assert ToolCallLimitMiddleware in types
    assert ModelRetryMiddleware in types
    assert ContextEditingMiddleware in types
