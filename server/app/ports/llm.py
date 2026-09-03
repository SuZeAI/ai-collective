from __future__ import annotations

from typing import Any
from typing import Protocol


class LLMProvider(Protocol):
    async def generate_json(self, *, system: str, user: str) -> dict:
        """Return a JSON-like dict (already parsed)."""

    async def chat(
        self,
        *,
        system: str,
        user: str = "",
        messages: list[dict[str, Any]] | None = None,
        tools: list[Any] | None = None,
        parallel_tools: bool = False,
        max_tool_rounds: int | None = None,
    ) -> str:
        """``messages``, if given, is the full state (role/content dicts) sent to
        the graph as-is instead of a single ``[{"role": "user", "content": user}]``
        turn; ``system`` still goes to the agent as its system prompt either way."""
        ...

    def get_chat_model(self) -> Any:
        """Return provider-native chat model instance for advanced orchestration."""
