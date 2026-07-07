"""Declarative middleware configuration.

Reads the optional ``middleware:`` section from ``config.yml`` (same file the
rest of the app uses) and resolves each component's knobs. Any value omitted from
that section falls back to the existing ``settings.llm.*`` defaults (which still
honour environment variables) — so adding the ``middleware:`` section is purely
additive and the stack behaves identically when it is absent.

The section is organised by component (DeerFlow-style), e.g.::

    middleware:
      loop_detection:
        enabled: true
        max_repeats: 3
      summarization:
        enabled: false
        model: gemini
        trigger_tokens: 8000
        keep_messages: 20
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import yaml

from backend.api.config_loader import config_file_path
from backend.api.settings import settings
from backend.log import get_logger


def _csv(value: Any) -> list[str]:
    """Normalise a CSV string / list into a list of trimmed strings."""
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    return [p.strip() for p in str(value).replace("\n", ",").split(",") if p.strip()]


def _section() -> dict[str, Any]:
    """Return the raw ``middleware:`` mapping from config.yml ({} when absent)."""
    path = config_file_path()
    if not path.exists():
        return {}
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:  # noqa: BLE001 — never block startup on a bad config.yml
        get_logger().warning("Could not parse %s for middleware config", path, exc_info=True)
        return {}
    section = raw.get("middleware") if isinstance(raw, dict) else None
    return section if isinstance(section, dict) else {}


def _get(section: dict[str, Any], group: str, key: str, default: Any) -> Any:
    """Look up ``middleware.<group>.<key>`` with a fallback default."""
    block = section.get(group)
    if isinstance(block, dict) and key in block and block[key] is not None:
        return block[key]
    return default


@dataclass
class MiddlewareConfig:
    """Resolved knobs for the default middleware stack."""

    loop_detection_enabled: bool
    loop_detection_max_repeats: int
    tool_retry_max: int
    tool_call_limit: int
    tool_cache_enabled: bool
    tool_cache_deny_tools: list[str] = field(default_factory=list)
    guardrail_deny_tools: list[str] = field(default_factory=list)
    guardrail_deny_patterns: list[str] = field(default_factory=list)
    pii_redaction_enabled: bool = False
    fallback_models: list[str] = field(default_factory=list)
    model_retry_max: int = 0
    context_editing_enabled: bool = False
    context_editing_trigger_tokens: int = 100000
    context_editing_keep: int = 3
    summarization_enabled: bool = False
    summarization_model: str | None = None
    summarization_trigger_tokens: int = 8000
    summarization_keep_messages: int = 20
    rolling_summary_enabled: bool = False
    rolling_summary_trigger_tokens: int = 6000
    rolling_summary_keep_messages: int = 10
    ltm_middleware_enabled: bool = False
    run_token_budget: int = 0


def get_middleware_config() -> MiddlewareConfig:
    """Build the resolved middleware config: config.yml section over settings defaults."""
    s = _section()
    llm = settings.llm
    return MiddlewareConfig(
        loop_detection_enabled=bool(_get(s, "loop_detection", "enabled", llm.loop_detection_enabled)),
        loop_detection_max_repeats=int(_get(s, "loop_detection", "max_repeats", llm.loop_detection_max_repeats)),
        tool_retry_max=int(_get(s, "tool_retry", "max", llm.tool_retry_max)),
        tool_call_limit=int(_get(s, "tool_call_limit", "limit", _get(s, "tool_call", "limit", llm.tool_call_limit))),
        tool_cache_enabled=bool(_get(s, "tool_cache", "enabled", llm.tool_cache_enabled)),
        tool_cache_deny_tools=_csv(_get(s, "tool_cache", "deny_tools", None)) or llm.tool_cache_deny_list(),
        guardrail_deny_tools=_csv(_get(s, "guardrail", "deny_tools", None)) or llm.guardrail_deny_tool_list(),
        guardrail_deny_patterns=_csv(_get(s, "guardrail", "deny_patterns", None)) or llm.guardrail_deny_pattern_list(),
        pii_redaction_enabled=bool(_get(s, "pii_redaction", "enabled", llm.pii_redaction_enabled)),
        fallback_models=_csv(_get(s, "model_fallback", "models", None)) or llm.fallback_model_list(),
        model_retry_max=int(_get(s, "model_retry", "max", llm.model_retry_max)),
        context_editing_enabled=bool(_get(s, "context_editing", "enabled", llm.context_editing_enabled)),
        context_editing_trigger_tokens=int(_get(s, "context_editing", "trigger_tokens", llm.context_editing_trigger_tokens)),
        context_editing_keep=int(_get(s, "context_editing", "keep", llm.context_editing_keep)),
        summarization_enabled=bool(_get(s, "summarization", "enabled", llm.summarization_enabled)),
        summarization_model=_get(s, "summarization", "model", llm.summarization_model) or None,
        summarization_trigger_tokens=int(_get(s, "summarization", "trigger_tokens", llm.summarization_trigger_tokens)),
        summarization_keep_messages=int(_get(s, "summarization", "keep_messages", llm.summarization_keep_messages)),
        rolling_summary_enabled=bool(_get(s, "rolling_summary", "enabled", llm.rolling_summary_enabled)),
        rolling_summary_trigger_tokens=int(_get(s, "rolling_summary", "trigger_tokens", llm.rolling_summary_trigger_tokens)),
        rolling_summary_keep_messages=int(_get(s, "rolling_summary", "keep_messages", llm.rolling_summary_keep_messages)),
        ltm_middleware_enabled=bool(_get(s, "long_term_memory", "enabled", llm.ltm_middleware_enabled)),
        run_token_budget=int(_get(s, "cost_budget", "run_token_budget", llm.run_token_budget)),
    )
