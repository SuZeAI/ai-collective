from __future__ import annotations

import importlib

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider
from backend.infrastructure.llm.rotation import RotationConfig, build_rotating_model, normalize_api_keys


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_DEFAULT_HEADERS = {
    "HTTP-Referer": "https://github.com/SuZeAI/ai-collective",
    "X-OpenRouter-Title": "ai-collective",
    "X-Title": "ai-collective",
}

OPEN_WEIGHT_MODEL_ALIASES = {
    "glm-5": "z-ai/glm-5",
    "kimi-k2.5": "moonshotai/kimi-k2.5",
    "minimax-m2.5": "minimax/minimax-m2.5",
    "qwen3.5-397b-a17b": "qwen/qwen3.5-397b-a17b",
    "devstral-2-123b": "mistralai/devstral-2-123b",
}


def resolve_open_weight_model(model: str) -> str:
    normalized = model.strip()
    if not normalized:
        return normalized
    if "/" in normalized:
        return normalized
    key = normalized.lower().replace(" ", "").replace("_", "")
    return OPEN_WEIGHT_MODEL_ALIASES.get(key, normalized)


class OpenWeightLangChainProvider(LangChainLLMProvider):
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

        resolved_base_url = (base_url or OPENROUTER_BASE_URL).rstrip("/")
        resolved_headers = dict(OPENROUTER_DEFAULT_HEADERS)
        if default_headers:
            resolved_headers.update(default_headers)

        def build_one(key: str):
            kwargs: dict[str, object] = {
                "model": resolve_open_weight_model(model),
                "api_key": key,
                "base_url": resolved_base_url,
            }
            if resolved_headers:
                kwargs["default_headers"] = resolved_headers
            return ChatOpenAI(**kwargs)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="open_weight", config=failover)
        super().__init__(
            llm,
            provider_name="Open-weight",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )