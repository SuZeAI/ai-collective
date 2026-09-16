from __future__ import annotations

import importlib

from server.infra.llm.providers.base_langchain import LangChainLLMProvider
from server.infra.llm.providers.rotation import RotationConfig, build_rotating_model, normalize_api_keys


class AnthropicLangChainProvider(LangChainLLMProvider):
    def __init__(
        self,
        *,
        model: str,
        api_key: str | list[str],
        max_tool_rounds: int = 6,
        tool_timeout_seconds: int | None = None,
        failover: RotationConfig | None = None,
    ):
        try:
            ChatAnthropic = importlib.import_module("langchain_anthropic").ChatAnthropic
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-anthropic. Install backend deps first."
            ) from e

        def build_one(key: str):
            return ChatAnthropic(model=model, anthropic_api_key=key)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="anthropic", config=failover)
        super().__init__(
            llm,
            provider_name="Anthropic",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
