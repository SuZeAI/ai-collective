"""Shared runtime helpers for the LangGraph multi-agent topologies.

Centralizes two cross-cutting concerns that every topology (ring, supervisor,
tree, mesh, sequential orchestrator) needs:

1. A sane ``recursion_limit`` derived from ``max_rounds`` so that long but
   legitimate runs do not trip LangGraph's default 25-superstep ceiling.
2. Driving a compiled graph to completion in a way that still returns the most
   recent accumulated state if the recursion limit is hit or a node raises,
   instead of discarding the whole run.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any
import logging

try:  # pragma: no cover - import shape differs slightly across langgraph versions
    from langgraph.errors import GraphRecursionError
except Exception:  # pragma: no cover
    class GraphRecursionError(Exception):  # type: ignore[no-redef]
        """Fallback if langgraph does not expose GraphRecursionError."""

logger = logging.getLogger(__name__)

# Per-LLM-call wall-clock timeout and transient-failure retry policy.
LLM_TIMEOUT_SECONDS = max(10, int(os.getenv("AGENT_LLM_TIMEOUT_SECONDS", "120")))
LLM_MAX_RETRIES = max(0, int(os.getenv("AGENT_LLM_MAX_RETRIES", "2")))
_LLM_RETRY_BASE_DELAY = 1.5


async def safe_chat(llm: Any, *, agent_name: str = "", **chat_kwargs: Any) -> str:
    """Call ``llm.chat`` with a bounded timeout and transient-failure retries.

    A single provider hiccup (timeout, 429, 5xx) must not abort an entire
    multi-agent run. On exhausting retries this returns a human-readable error
    string (used as the agent's turn content) instead of raising, so the graph
    can continue or terminate gracefully and still surface partial results.
    """
    last_exc: Exception | None = None
    for attempt in range(LLM_MAX_RETRIES + 1):
        try:
            async with asyncio.timeout(LLM_TIMEOUT_SECONDS):
                return await llm.chat(**chat_kwargs)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - provider errors are heterogeneous
            last_exc = exc
            if attempt < LLM_MAX_RETRIES:
                delay = _LLM_RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "llm.chat failed (agent=%s attempt=%d/%d): %s; retrying in %.1fs",
                    agent_name, attempt + 1, LLM_MAX_RETRIES + 1, exc, delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.exception(
                    "llm.chat failed permanently (agent=%s) after %d attempts",
                    agent_name, LLM_MAX_RETRIES + 1,
                )
    return f"[error] The model call failed after retries: {last_exc}"


def recursion_config(max_rounds: int) -> dict[str, Any]:
    """Build a LangGraph config whose recursion limit honors ``max_rounds``.

    LangGraph defaults to 25 supersteps. Topologies that loop until
    ``rounds >= max_rounds`` would raise ``GraphRecursionError`` mid-run for any
    ``max_rounds`` near/above that. We allow generous headroom for hub bounces
    (mesh/supervisor route back through a coordinator) and the START edge.
    """
    return {"recursion_limit": max(25, int(max_rounds) * 2 + 10)}


async def run_to_final_state(graph: Any, initial: dict, max_rounds: int) -> dict:
    """Run ``graph`` to completion and return its final state.

    Uses values-mode streaming so the latest state snapshot is retained: if the
    recursion limit is reached or a node raises, the best partial state is
    returned rather than losing every turn produced so far.
    """
    config = recursion_config(max_rounds)
    last_state: dict = initial
    try:
        async for state in graph.astream(initial, config=config, stream_mode="values"):
            if isinstance(state, dict):
                last_state = state
    except GraphRecursionError:
        logger.warning(
            "Graph hit recursion limit (max_rounds=%s); returning partial state.",
            max_rounds,
        )
    except Exception:
        logger.exception("Graph execution failed; returning partial state.")
    return last_state
