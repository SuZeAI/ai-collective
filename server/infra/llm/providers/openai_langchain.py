from __future__ import annotations

import importlib

from server.infra.llm.providers.base_langchain import LangChainLLMProvider
from server.infra.llm.providers.rotation import RotationConfig, build_rotating_model, normalize_api_keys


class OpenAILangChainProvider(LangChainLLMProvider):
    def __init__(
        self,
        *,
        model: str,
        api_key: str | list[str],
        base_url: str | None = None,
        default_headers: dict[str, str] | None = None,
        max_tool_rounds: int = 6,
        tool_timeout_seconds: int | None = None,
        failover: RotationConfig | None = None,
    ):
        try:
            ChatOpenAI = importlib.import_module("langchain_openai").ChatOpenAI
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-openai. Install backend deps first."
            ) from e

        def build_one(key: str):
            kwargs: dict[str, object] = {"model": model, "api_key": key}
            if base_url:
                kwargs["base_url"] = base_url
            if default_headers:
                kwargs["default_headers"] = default_headers
            return ChatOpenAI(**kwargs)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="openai", config=failover)
        super().__init__(
            llm,
            provider_name="OpenAI",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )