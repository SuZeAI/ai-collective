from __future__ import annotations

import importlib

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider
from backend.infrastructure.llm.rotation import RotationConfig, build_rotating_model, normalize_api_keys


# DeepSeek exposes an OpenAI-compatible API. Docs: https://api-docs.deepseek.com/
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

DEEPSEEK_MODEL_ALIASES = {
    "deepseek": "deepseek-chat",
    "deepseek-v3": "deepseek-chat",
    "deepseek-chat": "deepseek-chat",
    "deepseek-r1": "deepseek-reasoner",
    "deepseek-reasoner": "deepseek-reasoner",
}


def resolve_deepseek_model(model: str) -> str:
    normalized = (model or "").strip()
    if not normalized:
        return normalized
    key = normalized.lower().replace(" ", "").replace("_", "")
    return DEEPSEEK_MODEL_ALIASES.get(key, normalized)


class DeepSeekLangChainProvider(LangChainLLMProvider):
    """DeepSeek as an staff LLM backend (OpenAI-compatible chat API)."""

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
            kwargs: dict[str, object] = {
                "model": resolve_deepseek_model(model),
                "api_key": key,
                "base_url": (base_url or DEEPSEEK_BASE_URL).rstrip("/"),
            }
            if default_headers:
                kwargs["default_headers"] = default_headers
            return ChatOpenAI(**kwargs)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="deepseek", config=failover)
        super().__init__(
            llm,
            provider_name="DeepSeek",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
