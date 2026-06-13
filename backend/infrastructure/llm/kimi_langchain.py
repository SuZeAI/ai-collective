from __future__ import annotations

import importlib

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider
from backend.infrastructure.llm.rotation import build_rotating_model, normalize_api_keys


# Moonshot AI (Kimi) exposes an OpenAI-compatible API.
# International platform: https://api.moonshot.ai/v1  — China platform: https://api.moonshot.cn/v1
MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1"

KIMI_MODEL_ALIASES = {
    "kimi-k2": "kimi-k2-0711-preview",
    "kimi-k2-turbo": "kimi-k2-turbo-preview",
    "moonshot-v1": "moonshot-v1-8k",
}


def resolve_kimi_model(model: str) -> str:
    normalized = (model or "").strip()
    if not normalized:
        return normalized
    key = normalized.lower().replace(" ", "").replace("_", "")
    return KIMI_MODEL_ALIASES.get(key, normalized)


class KimiLangChainProvider(LangChainLLMProvider):
    """Moonshot AI Kimi as an agent LLM backend (OpenAI-compatible chat API)."""

    def __init__(
        self,
        *,
        model: str,
        api_key: str | list[str],
        base_url: str | None = None,
        default_headers: dict[str, str] | None = None,
        max_tool_rounds: int = 6,
        tool_timeout_seconds: int | None = None,
    ):
        try:
            ChatOpenAI = importlib.import_module("langchain_openai").ChatOpenAI
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-openai. Install backend deps first."
            ) from e

        def build_one(key: str):
            kwargs: dict[str, object] = {
                "model": resolve_kimi_model(model),
                "api_key": key,
                "base_url": (base_url or MOONSHOT_BASE_URL).rstrip("/"),
            }
            if default_headers:
                kwargs["default_headers"] = default_headers
            return ChatOpenAI(**kwargs)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="kimi")
        super().__init__(
            llm,
            provider_name="Kimi",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
