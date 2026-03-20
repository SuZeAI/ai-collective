from __future__ import annotations

from typing import Any

from backend.application.ports.llm import LLMProvider


class LLMService:
    def __init__(self, llm: LLMProvider):
        self._llm = llm

    async def chat(self, prompt: str, system: str = "You are a helpful assistant.") -> str:
        return await self._llm.chat(system=system, user=prompt)

    def get_chat_model(self) -> Any:
        return self._llm.get_chat_model()
