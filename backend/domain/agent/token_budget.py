from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

try:
    import tiktoken
except Exception:  # pragma: no cover
    tiktoken = None


@dataclass(slots=True)
class TokenBudgetResult:
    text: str
    input_tokens: int
    max_input_tokens: int
    truncated: bool
    tokenizer_family: str
    provider: str
    model: str


def _safe_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def resolve_llm_identity(llm: Any) -> tuple[str, str]:
    provider = _safe_lower(getattr(llm, "_provider_name", ""))
    model = ""

    chat_model = None
    try:
        chat_model = llm.get_chat_model()
    except Exception:
        chat_model = None

    if chat_model is not None:
        for attr in ("model_name", "model", "model_id", "_model"):
            value = getattr(chat_model, attr, None)
            if isinstance(value, str) and value.strip():
                model = value.strip()
                break

        if not provider:
            chat_cls = chat_model.__class__.__name__.lower()
            if "anthropic" in chat_cls or "claude" in chat_cls:
                provider = "anthropic"
            elif "openai" in chat_cls or "gpt" in chat_cls:
                provider = "openai"
            elif "google" in chat_cls or "gemini" in chat_cls:
                provider = "google"

    return provider, model


def _resolve_tokenizer_family(provider: str, model: str) -> str:
    p = _safe_lower(provider)
    m = _safe_lower(model)

    if "openai" in p or "gpt" in m or "o1" in m or "o3" in m or "o4" in m:
        return "gpt"
    if "anthropic" in p or "claude" in m:
        return "claude"
    return "generic"


def _estimate_tokens(text: str, *, tokenizer_family: str, model: str) -> int:
    content = text or ""
    if not content:
        return 0

    if tokenizer_family == "gpt" and tiktoken is not None:
        try:
            enc = tiktoken.encoding_for_model(model) if model else tiktoken.get_encoding("cl100k_base")
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")
        try:
            return len(enc.encode(content))
        except Exception:
            pass

    # Conservative approximation so we truncate a bit early and avoid limit hits.
    if tokenizer_family == "claude":
        return max(1, math.ceil(len(content) / 3.2))
    return max(1, math.ceil(len(content) / 4.0))


def _truncate_by_token_budget(
    text: str,
    *,
    max_tokens: int,
    tokenizer_family: str,
    model: str,
) -> str:
    if max_tokens <= 0:
        return ""

    content = text or ""
    if not content:
        return ""

    if tokenizer_family == "gpt" and tiktoken is not None:
        try:
            enc = tiktoken.encoding_for_model(model) if model else tiktoken.get_encoding("cl100k_base")
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")
        try:
            encoded = enc.encode(content)
            if len(encoded) <= max_tokens:
                return content
            return enc.decode(encoded[:max_tokens]).rstrip()
        except Exception:
            pass

    approx_chars_per_token = 3.2 if tokenizer_family == "claude" else 4.0
    char_budget = int(max_tokens * approx_chars_per_token)
    if len(content) <= char_budget:
        return content
    return content[:char_budget].rstrip()


def apply_context_token_budget(
    *,
    llm: Any,
    system_prompt: str,
    user_input: str,
    max_context_tokens: int,
    reserved_output_tokens: int,
) -> TokenBudgetResult:
    provider, model = resolve_llm_identity(llm)
    tokenizer_family = _resolve_tokenizer_family(provider, model)

    system_tokens = _estimate_tokens(system_prompt, tokenizer_family=tokenizer_family, model=model)
    available_for_input = max(256, max_context_tokens - reserved_output_tokens - system_tokens)

    estimated_input_tokens = _estimate_tokens(user_input, tokenizer_family=tokenizer_family, model=model)
    if estimated_input_tokens <= available_for_input:
        return TokenBudgetResult(
            text=user_input,
            input_tokens=estimated_input_tokens,
            max_input_tokens=available_for_input,
            truncated=False,
            tokenizer_family=tokenizer_family,
            provider=provider,
            model=model,
        )

    truncated_text = _truncate_by_token_budget(
        user_input,
        max_tokens=available_for_input,
        tokenizer_family=tokenizer_family,
        model=model,
    )
    truncated_tokens = _estimate_tokens(truncated_text, tokenizer_family=tokenizer_family, model=model)
    return TokenBudgetResult(
        text=truncated_text,
        input_tokens=truncated_tokens,
        max_input_tokens=available_for_input,
        truncated=True,
        tokenizer_family=tokenizer_family,
        provider=provider,
        model=model,
    )