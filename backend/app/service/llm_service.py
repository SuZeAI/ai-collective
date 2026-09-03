from __future__ import annotations

from typing import Any

from backend.app.ports.llm import LLMProvider


class LLMService:
    def __init__(self, llm: LLMProvider):
        self._llm = llm

    async def chat(
        self,
        prompt: str,
        system: str = "You are a helpful assistant.",
        tools: list[Any] | None = None,
        parallel_tools: bool = False,
        max_tool_rounds: int | None = None,
    ) -> str:
        return await self._llm.chat(
            system=system,
            user=prompt,
            tools=tools,
            parallel_tools=parallel_tools,
            max_tool_rounds=max_tool_rounds,
        )

    def get_provider(self) -> LLMProvider:
        return self._llm

    def get_chat_model(self) -> Any:
        return self._llm.get_chat_model()
