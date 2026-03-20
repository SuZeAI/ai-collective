from __future__ import annotations

from typing import Any
from typing import Protocol


class LLMProvider(Protocol):
    async def generate_json(self, *, system: str, user: str) -> dict:
        """Return a JSON-like dict (already parsed)."""

    async def chat(self, *, system: str, user: str) -> str:
        ...

    def get_chat_model(self) -> Any:
        """Return provider-native chat model instance for advanced orchestration."""
