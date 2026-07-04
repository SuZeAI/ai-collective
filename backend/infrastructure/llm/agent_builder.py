"""Build LangChain ``create_agent`` instances for the provider chat path.

See https://docs.langchain.com/oss/python/langchain/agents . ``create_agent``
natively runs the ReAct loop (model → tools → model …) that the provider used
to hand-roll. We feed it the (possibly rotating) chat model directly, the
caller-supplied tools, the system prompt, and the default middleware stack.

Compiled agents are memoized per (model, tools, system prompt, round/timeout
config) so repeated turns within a run don't recompile the graph. The model is
fixed for a provider's lifetime, and skill tools are cached by the
``SkillToolManager``, so identity-based keys stay stable.
"""

from __future__ import annotations

from typing import Any

from langchain.agents import create_agent

from backend.infrastructure.llm.middleware import build_default_middleware

# Bounded memo of compiled agents. Keyed on identities/values that fully
# determine the compiled graph; capped to avoid unbounded growth.
_AGENT_CACHE: dict[tuple, Any] = {}
_AGENT_CACHE_MAX = 256


def _cache_key(
    model: Any,
    tools: list[Any],
    system_prompt: str | None,
    max_tool_rounds: int,
    tool_timeout: int | None,
) -> tuple:
    return (
        id(model),
        tuple(sorted(id(tool) for tool in tools)),
        system_prompt,
        max_tool_rounds,
        tool_timeout,
    )


def build_chat_agent(
    model: Any,
    *,
    tools: list[Any] | None = None,
    system_prompt: str | None = None,
    max_tool_rounds: int = 6,
    tool_timeout: int | None = None,
    extra_middleware: list[Any] | None = None,
) -> Any:
    """Return a compiled ``create_agent`` graph for one chat turn.

    ``model`` may be a ``BaseChatModel`` or the ``RotatingChatModel`` proxy;
    ``create_agent`` uses it directly (it only calls ``init_chat_model`` for
    string models), so key rotation is preserved.
    """
    resolved_tools = list(tools or [])

    # Only cache the common path (no per-call extra middleware) to keep the key
    # simple and correct.
    cache_key = (
        _cache_key(model, resolved_tools, system_prompt, max_tool_rounds, tool_timeout)
        if not extra_middleware
        else None
    )
    if cache_key is not None:
        cached = _AGENT_CACHE.get(cache_key)
        if cached is not None:
            return cached

    middleware = build_default_middleware(
        max_tool_rounds=max_tool_rounds,
        tool_timeout=tool_timeout,
    )
    if extra_middleware:
        middleware = middleware + list(extra_middleware)

    staff = create_agent(
        model=model,
        tools=resolved_tools,
        system_prompt=system_prompt,
        middleware=middleware,
    )

    if cache_key is not None:
        if len(_AGENT_CACHE) >= _AGENT_CACHE_MAX:
            _AGENT_CACHE.clear()
        _AGENT_CACHE[cache_key] = staff

    return staff
