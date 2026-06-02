from __future__ import annotations

import importlib

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider


class AnthropicLangChainProvider(LangChainLLMProvider):
    def __init__(self, *, model: str, api_key: str, max_tool_rounds: int = 6, tool_timeout_seconds: int | None = None):
        try:
            ChatAnthropic = importlib.import_module("langchain_anthropic").ChatAnthropic
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-anthropic. Install backend deps first."
            ) from e

        super().__init__(
            ChatAnthropic(model=model, anthropic_api_key=api_key),
            provider_name="Anthropic",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )