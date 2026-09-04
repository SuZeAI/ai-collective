"""PII-redaction middleware — scrub obvious PII / secrets from tool results."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from server.share.log import get_logger

# Conservative PII patterns: emails, long digit runs (cards/phones), and common
# secret tokens. Intentionally simple — high-precision, low false-positive.
_PII_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[REDACTED_EMAIL]"),
    (re.compile(r"\b(?:\d[ -]?){13,16}\b"), "[REDACTED_CARD]"),
    (re.compile(r"\b(?:sk|pk|ghp|xox[baprs])[-_][A-Za-z0-9]{16,}\b"), "[REDACTED_SECRET]"),
]


class PIIRedactionMiddleware(AgentMiddleware):
    """Redact obvious PII / secrets from tool results before the model sees them."""

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        result = await handler(request)
        if isinstance(result, ToolMessage) and isinstance(result.content, str):
            redacted = result.content
            for pattern, replacement in _PII_PATTERNS:
                redacted = pattern.sub(replacement, redacted)
            if redacted != result.content:
                get_logger().info("PIIRedaction: redacted sensitive data in '%s' result", result.name)
                result.content = redacted
        return result
