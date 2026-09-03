from __future__ import annotations

import contextvars
from typing import Any, Protocol

from langchain_core.callbacks import BaseCallbackHandler

from server.log import get_logger

# Who triggered the current LLM call. Set per-request by the API middleware in
# main.py; background work (task queue) that has no request context records as
# "system".
current_usage_user: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_usage_user", default="system"
)

# Which AI staff member (staff) and department (team) the current LLM call belongs
# to. current_usage_staff is set per-staff-turn in the graph runtime's safe_chat();
# current_usage_department is set per-run in the staff-graph API routes. Empty => the call
# could not be attributed (e.g. background work, single-staff chat).
current_usage_staff: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_usage_staff", default=""
)
current_usage_department: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_usage_department", default=""
)


class UsageRecorder(Protocol):
    def __call__(
        self,
        *,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: str,
        staff_name: str,
        department_id: str,
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0,
    ) -> None: ...


_recorder: UsageRecorder | None = None


def set_usage_recorder(recorder: UsageRecorder | None) -> None:
    """Register the global sink that persists token usage records.

    Wired up in deps.py to the configured TokenUsageRepository. Kept as a
    module-level registry so the infrastructure LLM layer never has to import
    the API/deps layer.
    """
    global _recorder
    _recorder = recorder


def _extract_usage(response: Any, default_model: str) -> tuple[int, int, int, int, str]:
    """Pull (input_tokens, output_tokens, cache_read, cache_creation, model)
    out of a LangChain LLMResult.

    Prefers the standardized AIMessage.usage_metadata (whose
    ``input_token_details.cache_read``/``cache_creation`` are populated by
    both langchain_anthropic and langchain_openai when the provider reports
    cache usage); falls back to provider-specific llm_output keys, which don't
    carry cache detail.
    """
    input_tokens = 0
    output_tokens = 0
    cache_read = 0
    cache_creation = 0
    model = default_model

    for generations in getattr(response, "generations", None) or []:
        for generation in generations:
            message = getattr(generation, "message", None)
            if message is None:
                continue
            usage = getattr(message, "usage_metadata", None)
            if usage:
                input_tokens += int(usage.get("input_tokens", 0) or 0)
                output_tokens += int(usage.get("output_tokens", 0) or 0)
                details = usage.get("input_token_details") or {}
                cache_read += int(details.get("cache_read", 0) or 0)
                cache_creation += int(details.get("cache_creation", 0) or 0)
            meta = getattr(message, "response_metadata", None)
            if isinstance(meta, dict):
                model = str(meta.get("model_name") or meta.get("model") or model)

    if input_tokens == 0 and output_tokens == 0:
        llm_output = getattr(response, "llm_output", None) or {}
        token_usage = llm_output.get("token_usage") or llm_output.get("usage") or {}
        input_tokens = int(token_usage.get("prompt_tokens") or token_usage.get("input_tokens") or 0)
        output_tokens = int(
            token_usage.get("completion_tokens") or token_usage.get("output_tokens") or 0
        )
        model = str(llm_output.get("model_name") or model)

    return input_tokens, output_tokens, cache_read, cache_creation, model


class UsageTrackingCallback(BaseCallbackHandler):
    """Records token usage for every invocation of the chat model it's attached to.

    Attached at model construction in LangChainLLMProvider, so it covers both
    provider.chat() and direct get_chat_model() callers (orchestrators,
    office builder, ...). Never raises into the LLM call path.
    """

    raise_error = False

    def __init__(self, *, provider: str, model: str):
        self._provider = provider
        self._model = model

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:  # noqa: ANN401
        recorder = _recorder
        if recorder is None:
            return
        try:
            input_tokens, output_tokens, cache_read, cache_creation, model = _extract_usage(
                response, self._model
            )
            if input_tokens == 0 and output_tokens == 0:
                return
            recorder(
                provider=self._provider,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                user_id=current_usage_user.get(),
                staff_name=current_usage_staff.get(),
                department_id=current_usage_department.get(),
                cache_read_tokens=cache_read,
                cache_creation_tokens=cache_creation,
            )
        except Exception:
            get_logger().exception("Failed to record LLM token usage")
