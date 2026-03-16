from __future__ import annotations

from typing import Protocol


class LLMProvider(Protocol):
    async def generate_json(self, *, system: str, user: str) -> dict:
        """Return a JSON-like dict (already parsed)."""

    async def chat(self, *, system: str, user: str) -> str:
        ...
