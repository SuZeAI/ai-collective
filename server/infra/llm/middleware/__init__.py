"""Staff middleware for the LangChain ``create_staff`` chat path.

The provider's ``chat()`` delegates to ``create_staff`` (see ``agent_builder.py``);
the cross-cutting behaviours that loop used to implement inline are expressed here
as middleware, following
https://docs.langchain.com/oss/python/langchain/middleware/overview .

This package splits the former single ``middleware.py`` into one module per
component plus a config loader and the stack builder:

  * ``helpers``            — shared message/token helpers.
  * ``tool_timeout``       — ToolTimeoutMiddleware
  * ``loop_detection``     — LoopDetectionMiddleware
  * ``rolling_summary``    — RollingSummaryMiddleware
  * ``long_term_memory``   — LongTermMemoryMiddleware
  * ``tool_result_cache``  — ToolResultCacheMiddleware
  * ``cost_budget``        — CostBudgetMiddleware
  * ``guardrail``          — GuardrailMiddleware
  * ``pii_redaction``      — PIIRedactionMiddleware
  * ``config``             — MiddlewareConfig + get_middleware_config (reads the
                             ``middleware:`` section of config.yml)
  * ``builder``            — build_default_middleware (assembles the stack)

All public names are re-exported here so existing imports keep working.
"""

from server.infra.llm.middleware.builder import build_default_middleware
from server.infra.llm.middleware.config import (
    MiddlewareConfig,
    get_middleware_config,
)
from server.infra.llm.middleware.cost_budget import CostBudgetMiddleware
from server.infra.llm.middleware.guardrail import GuardrailMiddleware
from server.infra.llm.middleware.helpers import (
    _default_tool_timeout,
    _estimate_tokens,
    _loop_signature,
    _message_text,
    _state_messages,
    default_tool_timeout,
)
from server.infra.llm.middleware.long_term_memory import LongTermMemoryMiddleware
from server.infra.llm.middleware.loop_detection import LoopDetectionMiddleware
from server.infra.llm.middleware.pii_redaction import PIIRedactionMiddleware
from server.infra.llm.middleware.rolling_summary import RollingSummaryMiddleware
from server.infra.llm.middleware.tool_result_cache import ToolResultCacheMiddleware
from server.infra.llm.middleware.tool_timeout import ToolTimeoutMiddleware

__all__ = [
    "build_default_middleware",
    "MiddlewareConfig",
    "get_middleware_config",
    "ToolTimeoutMiddleware",
    "LoopDetectionMiddleware",
    "RollingSummaryMiddleware",
    "LongTermMemoryMiddleware",
    "ToolResultCacheMiddleware",
    "CostBudgetMiddleware",
    "GuardrailMiddleware",
    "PIIRedactionMiddleware",
    # Helpers (and backwards-compatible private aliases).
    "default_tool_timeout",
    "_default_tool_timeout",
    "_message_text",
    "_estimate_tokens",
    "_state_messages",
    "_loop_signature",
]
