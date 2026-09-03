"""Shared helpers for the staff middleware components."""

from __future__ import annotations

import json
from typing import Any

from server.api.settings import settings


def message_text(message: Any) -> str:
    """Best-effort plain text of a LangChain message (handles block content)."""
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return " ".join(parts)
    return str(content)


def estimate_tokens(text: str) -> int:
    """Cheap, provider-agnostic token estimate (~4 chars/token)."""
    return max(1, len(text or "") // 4)


def state_messages(state: Any) -> list:
    if isinstance(state, dict):
        return state.get("messages") or []
    return getattr(state, "messages", None) or []


def default_tool_timeout() -> int:
    """Per-tool timeout in seconds (0 disables)."""
    return max(0, settings.staff.tool_timeout_seconds)


def loop_signature(name: str, args: object) -> tuple[str, str]:
    """Stable signature for a tool call (name + canonicalized args)."""
    try:
        encoded = json.dumps(args, sort_keys=True, default=str)
    except Exception:  # noqa: BLE001 — args should always encode, but never break a run
        encoded = repr(args)
    return name, encoded


# Backwards-compatible private aliases (the original module exposed these names).
_message_text = message_text
_estimate_tokens = estimate_tokens
_state_messages = state_messages
_default_tool_timeout = default_tool_timeout
_loop_signature = loop_signature
