from __future__ import annotations

import importlib

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider
from backend.infrastructure.llm.rotation import build_rotating_model, normalize_api_keys


# Zhipu AI GLM exposes an OpenAI-compatible API.
# International platform (Z.ai): https://api.z.ai/api/paas/v4
# China platform (BigModel):    https://open.bigmodel.cn/api/paas/v4
GLM_BASE_URL = "https://api.z.ai/api/paas/v4"

GLM_MODEL_ALIASES = {
    "glm": "glm-4.6",
    "glm-4": "glm-4.6",
    "glm-4.5": "glm-4.5",
    "glm-4.5-air": "glm-4.5-air",
    "glm-4.6": "glm-4.6",
}


def resolve_glm_model(model: str) -> str:
    normalized = (model or "").strip()
    if not normalized:
        return normalized
    key = normalized.lower().replace(" ", "").replace("_", "")
    return GLM_MODEL_ALIASES.get(key, normalized)


class GLMLangChainProvider(LangChainLLMProvider):
    """Zhipu AI GLM as an staff LLM backend (OpenAI-compatible chat API)."""

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
                "model": resolve_glm_model(model),
                "api_key": key,
                "base_url": (base_url or GLM_BASE_URL).rstrip("/"),
            }
            if default_headers:
                kwargs["default_headers"] = default_headers
            return ChatOpenAI(**kwargs)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="glm")
        super().__init__(
            llm,
            provider_name="GLM",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
