"""API-key rotation / failover for LangChain chat models.

Many providers (Google Gemini free tier especially) impose per-key request and
token limits. Instead of failing the moment one key is throttled, we keep a
pool of equivalent chat models — one per API key — and transparently rotate to
the next healthy key when the current one returns a rate-limit / quota / server
error.

The rotation lives at the *chat-model* level (``RotatingChatModel``) rather than
the provider level, so it covers BOTH call paths in this codebase with a single
implementation:

* ``LangChainLLMProvider.chat()`` → ``self._llm.bind_tools(...).ainvoke(...)``
* ``LLMProvider.get_chat_model()`` → returns ``self._llm`` directly (used by the
  office-builder streamer, token-budget probing, etc.)

A failed key is put on a short cooldown so the next request skips it instead of
re-hitting the wall. When every key is cooling down we still try the
least-recently-failed one (better to attempt than to hard-fail).
"""

from __future__ import annotations

import os
import time
from typing import Any, Callable

from backend.log import get_logger


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# How long (seconds) a key is skipped after it returns a rate-limit/quota error.
ROTATION_COOLDOWN_SECONDS = _env_float("LLM_KEY_COOLDOWN_SECONDS", 60.0)


def is_rate_limit_error(exc: BaseException) -> bool:
    """Best-effort detection of a throttling / quota error across providers."""
    for attr in ("status_code", "code", "http_status", "status"):
        value = getattr(exc, attr, None)
        if value in (429, "429"):
            return True

    name = type(exc).__name__.lower()
    if any(token in name for token in ("ratelimit", "resourceexhausted", "quota")):
        return True

    msg = str(exc).lower()
    needles = (
        "429",
        "rate limit",
        "ratelimit",
        "quota",
        "resource has been exhausted",
        "resource_exhausted",
        "too many requests",
        "exceeded your current quota",
        "insufficient_quota",
    )
    return any(n in msg for n in needles)


def should_rotate(exc: BaseException) -> bool:
    """Whether ``exc`` warrants trying the next API key.

    Covers throttling (the primary use case) plus the failure modes where a
    *different* key is likely to succeed: a dead/invalid/revoked key (401/403)
    and transient upstream errors (5xx / overloaded).
    """
    if is_rate_limit_error(exc):
        return True

    for attr in ("status_code", "code", "http_status", "status"):
        value = getattr(exc, attr, None)
        try:
            code = int(value)
        except (TypeError, ValueError):
            continue
        if code in (401, 403) or 500 <= code <= 599:
            return True

    msg = str(exc).lower()
    needles = (
        "permission denied",
        "api key not valid",
        "invalid api key",
        "invalid_api_key",
        "unauthorized",
        "overloaded",
        "internal server error",
        "service unavailable",
        "bad gateway",
    )
    return any(n in msg for n in needles)


class _KeyState:
    """Mutable cooldown bookkeeping for one key, shared across bound clones."""

    __slots__ = ("disabled_until", "last_error")

    def __init__(self) -> None:
        self.disabled_until: float = 0.0
        self.last_error: str = ""


class RotatingChatModel:
    """A LangChain-compatible chat model that rotates over a pool of keys.

    It is intentionally a thin proxy (not a ``BaseChatModel`` subclass): it
    forwards every attribute it does not handle to the *current* underlying
    model, and wraps the small set of entry points the app actually uses
    (``ainvoke`` / ``invoke`` / ``astream`` / ``bind_tools``) with rotation.
    """

    def __init__(
        self,
        models: list[Any],
        *,
        labels: list[str] | None = None,
        _states: list[_KeyState] | None = None,
        _index: list[int] | None = None,
    ):
        if not models:
            raise ValueError("RotatingChatModel requires at least one underlying model")
        self._models = models
        self._labels = labels or [f"key#{i + 1}" for i in range(len(models))]
        # Cooldown state and the current cursor are shared by reference so that
        # bind_tools()/with_*() clones rotate in lock-step with the original.
        self._states = _states if _states is not None else [_KeyState() for _ in models]
        self._index = _index if _index is not None else [0]

    # ── pool selection ──────────────────────────────────────────────────────
    def _order(self) -> list[int]:
        """Indices to try, current first, skipping cooled-down keys."""
        now = time.monotonic()
        start = self._index[0] % len(self._models)
        rotated = [(start + offset) % len(self._models) for offset in range(len(self._models))]
        ready = [i for i in rotated if self._states[i].disabled_until <= now]
        if ready:
            return ready
        # Everything is cooling down — try the one whose cooldown expires soonest.
        return sorted(rotated, key=lambda i: self._states[i].disabled_until)

    def _trip(self, idx: int, exc: BaseException) -> None:
        self._states[idx].disabled_until = time.monotonic() + ROTATION_COOLDOWN_SECONDS
        self._states[idx].last_error = str(exc)[:200]

    def _promote(self, idx: int) -> None:
        self._index[0] = idx

    # ── wrapped entry points ────────────────────────────────────────────────
    async def ainvoke(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_async("ainvoke", *args, **kwargs)

    async def astream(self, *args: Any, **kwargs: Any):
        # Rotate on the error raised before the first chunk; mid-stream failures
        # cannot be retried transparently and propagate as-is.
        order = self._order()
        last_exc: BaseException | None = None
        for pos, idx in enumerate(order):
            model = self._models[idx]
            try:
                agen = model.astream(*args, **kwargs)
                first = await agen.__anext__()
            except StopAsyncIteration:
                self._promote(idx)
                return
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if should_rotate(exc) and pos < len(order) - 1:
                    self._trip(idx, exc)
                    get_logger().warning(
                        "LLM key %s failed (%s); rotating to next key",
                        self._labels[idx], type(exc).__name__,
                    )
                    continue
                raise
            self._promote(idx)
            yield first
            async for chunk in agen:
                yield chunk
            return
        if last_exc is not None:
            raise last_exc

    def invoke(self, *args: Any, **kwargs: Any) -> Any:
        return self._run_sync("invoke", *args, **kwargs)

    async def _run_async(self, method: str, *args: Any, **kwargs: Any) -> Any:
        order = self._order()
        last_exc: BaseException | None = None
        for pos, idx in enumerate(order):
            try:
                result = await getattr(self._models[idx], method)(*args, **kwargs)
                self._promote(idx)
                return result
            except Exception as exc:  # noqa: BLE001 - provider errors are heterogeneous
                last_exc = exc
                if should_rotate(exc) and pos < len(order) - 1:
                    self._trip(idx, exc)
                    get_logger().warning(
                        "LLM key %s failed (%s); rotating to next key",
                        self._labels[idx], type(exc).__name__,
                    )
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    def _run_sync(self, method: str, *args: Any, **kwargs: Any) -> Any:
        order = self._order()
        last_exc: BaseException | None = None
        for pos, idx in enumerate(order):
            try:
                result = getattr(self._models[idx], method)(*args, **kwargs)
                self._promote(idx)
                return result
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if should_rotate(exc) and pos < len(order) - 1:
                    self._trip(idx, exc)
                    get_logger().warning(
                        "LLM key %s failed (%s); rotating to next key",
                        self._labels[idx], type(exc).__name__,
                    )
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    # ── proxied builders that must stay rotating ────────────────────────────
    def _clone(self, models: list[Any]) -> "RotatingChatModel":
        return RotatingChatModel(
            models, labels=self._labels, _states=self._states, _index=self._index
        )

    def bind_tools(self, *args: Any, **kwargs: Any) -> "RotatingChatModel":
        return self._clone([m.bind_tools(*args, **kwargs) for m in self._models])

    def bind(self, *args: Any, **kwargs: Any) -> "RotatingChatModel":
        return self._clone([m.bind(*args, **kwargs) for m in self._models])

    def with_structured_output(self, *args: Any, **kwargs: Any) -> "RotatingChatModel":
        return self._clone([m.with_structured_output(*args, **kwargs) for m in self._models])

    def with_config(self, *args: Any, **kwargs: Any) -> "RotatingChatModel":
        return self._clone([m.with_config(*args, **kwargs) for m in self._models])

    def with_retry(self, *args: Any, **kwargs: Any) -> "RotatingChatModel":
        return self._clone([m.with_retry(*args, **kwargs) for m in self._models])

    # ── callbacks must fan out to every key so usage tracking always fires ──
    @property
    def callbacks(self) -> Any:
        return getattr(self._models[self._index[0]], "callbacks", None)

    @callbacks.setter
    def callbacks(self, value: Any) -> None:
        for model in self._models:
            try:
                model.callbacks = value
            except Exception:  # noqa: BLE001
                pass

    # ── everything else delegates to the current model ─────────────────────
    def __getattr__(self, name: str) -> Any:
        # __getattr__ only fires for names not found normally, so this never
        # shadows the wrapped methods above.
        return getattr(self._models[self._index[0]], name)


def build_rotating_model(
    build_one: Callable[[str], Any],
    api_keys: list[str],
    *,
    label_prefix: str = "key",
) -> Any:
    """Build one chat model per key; wrap in ``RotatingChatModel`` if >1.

    A single key returns the bare model (zero overhead, identical behaviour to
    before this feature existed).
    """
    keys = [k.strip() for k in api_keys if k and k.strip()]
    # De-duplicate while preserving order.
    seen: set[str] = set()
    keys = [k for k in keys if not (k in seen or seen.add(k))]
    if not keys:
        raise ValueError("build_rotating_model requires at least one non-empty API key")

    models = [build_one(key) for key in keys]
    if len(models) == 1:
        return models[0]
    labels = [f"{label_prefix}#{i + 1}…{k[-4:]}" for i, k in enumerate(keys)]
    get_logger().info("LLM key rotation enabled across %d keys (%s)", len(keys), label_prefix)
    return RotatingChatModel(models, labels=labels)


def normalize_api_keys(value: str | list[str] | None) -> list[str]:
    """Accept a single key, a comma/whitespace-separated string, or a list."""
    if value is None:
        return []
    if isinstance(value, str):
        raw = value.replace("\n", ",").replace(" ", ",")
        return [part.strip() for part in raw.split(",") if part.strip()]
    out: list[str] = []
    for item in value:
        out.extend(normalize_api_keys(item))
    return out
