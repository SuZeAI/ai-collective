from __future__ import annotations

from backend.application.ports.llm import LLMProvider
from backend.infrastructure.llm.anthropic_langchain import AnthropicLangChainProvider
from backend.infrastructure.llm.google_langchain import GoogleLangChainProvider
from backend.infrastructure.llm.open_weight_langchain import OpenWeightLangChainProvider
from backend.infrastructure.llm.openai_langchain import OpenAILangChainProvider
from backend.infrastructure.llm.kimi_langchain import KimiLangChainProvider
from backend.infrastructure.llm.deepseek_langchain import DeepSeekLangChainProvider
from backend.infrastructure.llm.glm_langchain import GLMLangChainProvider


DEFAULT_PROVIDER_MODELS = {
    "anthropic": "claude-sonnet-4",
    "openai": "gpt-4o",
    "google": "gemini-3-flash-preview",
    "open_weight": "qwen3.5-397B-A17B",
    "kimi": "kimi-k2-0711-preview",
    "deepseek": "deepseek-chat",
    "glm": "glm-4.6",
}

SUPPORTED_PROVIDERS = {"anthropic", "openai", "google", "open_weight", "kimi", "deepseek", "glm"}


def _normalize_provider(provider: str | None) -> str:
    normalized = (provider or "google").strip().lower().replace("-", "_")
    if normalized in {"gemini", "google_genai"}:
        return "google"
    if normalized in {"openrouter", "open_router", "open_weight", "openweight"}:
        return "open_weight"
    if normalized in {"moonshot", "moonshotai", "kimi"}:
        return "kimi"
    if normalized in {"deepseek", "deep_seek"}:
        return "deepseek"
    if normalized in {"glm", "zhipu", "zhipuai", "z_ai", "bigmodel"}:
        return "glm"
    return normalized


def create_llm_provider(
    *,
    provider: str | None = None,
    model: str | None = None,
    google_api_key: str | list[str] | None = None,
    anthropic_api_key: str | list[str] | None = None,
    openai_api_key: str | list[str] | None = None,
    open_weight_api_key: str | list[str] | None = None,
    kimi_api_key: str | list[str] | None = None,
    deepseek_api_key: str | list[str] | None = None,
    glm_api_key: str | list[str] | None = None,
    max_tool_rounds: int = 6,
    tool_timeout_seconds: int | None = None,
    base_url: str | None = None,
) -> LLMProvider | None:
    resolved_provider = _normalize_provider(provider)
    if resolved_provider not in SUPPORTED_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_PROVIDERS))
        raise ValueError(f"Unsupported LLM provider '{provider}'. Supported providers: {supported}")

    resolved_model = model or DEFAULT_PROVIDER_MODELS[resolved_provider]

    if resolved_provider == "anthropic":
        if not anthropic_api_key:
            return None
        return AnthropicLangChainProvider(
            model=resolved_model,
            api_key=anthropic_api_key,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
    if resolved_provider == "openai":
        if not openai_api_key:
            return None
        return OpenAILangChainProvider(
            model=resolved_model,
            api_key=openai_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
    if resolved_provider == "open_weight":
        if not open_weight_api_key:
            return None
        return OpenWeightLangChainProvider(
            model=resolved_model,
            api_key=open_weight_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
    if resolved_provider == "kimi":
        if not kimi_api_key:
            return None
        return KimiLangChainProvider(
            model=resolved_model,
            api_key=kimi_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
    if not google_api_key:
        return None
    return GoogleLangChainProvider(
        model=resolved_model,
        api_key=google_api_key,
        max_tool_rounds=max_tool_rounds,
        tool_timeout_seconds=tool_timeout_seconds,
    )