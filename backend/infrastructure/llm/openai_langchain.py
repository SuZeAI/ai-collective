from __future__ import annotations

import importlib

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider


class OpenAILangChainProvider(LangChainLLMProvider):
    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str | None = None,
        default_headers: dict[str, str] | None = None,
        max_tool_rounds: int = 6,
    ):
        try:
            ChatOpenAI = importlib.import_module("langchain_openai").ChatOpenAI
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-openai. Install backend deps first."
            ) from e

        kwargs: dict[str, object] = {"model": model, "api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        if default_headers:
            kwargs["default_headers"] = default_headers

        super().__init__(
            ChatOpenAI(**kwargs),
            provider_name="OpenAI",
            max_tool_rounds=max_tool_rounds,
        )