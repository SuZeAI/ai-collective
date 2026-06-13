"""API-key rotation / failover for LangChain chat models.

Many providers (Google Gemini free tier especially) impose per-key request and
token limits. Instead of failing the moment one key is throttled, we keep a
pool of equivalent chat models — one per API key — and switch keys both:

* **Reactively** — when the current key returns a rate-limit / quota / 5xx /
  invalid-key error, fail over to the next key and put the failed one on a short
  cooldown.
* **Proactively** — before a key crosses a configured per-minute request (RPM)
  or token (TPM) budget, skip it so we never *hit* the provider's hard limit in
  the first place. Each key keeps a 60-second sliding window of its own request
  count and token usage.

This is an *alternative* to delegating failover to the **9router** gateway
(decolua/9router, docker ``--profile router``): an OpenAI-compatible proxy that
itself routes / falls back across 40+ providers. Which one is active is chosen
by ``LLM_FAILOVER_STRATEGY``:

* ``rotate``  → local multi-key rotation (this module). [default]
* ``9router`` → local rotation OFF; failover delegated to the 9router gateway.
                Point the backend at it via ``LLM_PROVIDER=openai`` +
                ``LLM_API_BASE=http://nine-router:20128/v1`` + the dashboard key.
                (aliases: ``router``, ``nine-router``, ``off``, ``none``)

Note: 9router is NOT openrouter.ai — the latter is the separate ``open_weight``
provider in this codebase.

Tuning env vars (all optional):
* ``LLM_KEY_COOLDOWN_SECONDS``        — cooldown after an error (default 60)
* ``LLM_ROTATE_MAX_REQUESTS_PER_MIN`` — per-key RPM budget, 0 = unlimited
* ``LLM_ROTATE_MAX_TOKENS_PER_MIN``   — per-key TPM budget, 0 = unlimited

The rotation lives at the *chat-model* level (``RotatingChatModel``) rather than
the provider level, so it covers BOTH call paths in this codebase with a single
implementation:

* ``LangChainLLMProvider.chat()`` → ``self._llm.bind_tools(...).ainvoke(...)``
* ``LLMProvider.get_chat_model()`` → returns ``self._llm`` directly (used by the
  office-builder streamer, token-budget probing, etc.)
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable

from backend.api.settings import settings
from backend.log import get_logger

_WINDOW_SECONDS = 60.0


@dataclass(frozen=True)
class RotationConfig:
    """Runtime knobs for key rotation, sourced from environment variables."""

    strategy: str = "rotate"
    cooldown_seconds: float = 60.0
    max_requests_per_min: int = 0  # 0 = unlimited
    max_tokens_per_min: int = 0  # 0 = unlimited

    @classmethod
    def from_env(cls) -> "RotationConfig":
        fo = settings.llm_failover
        return cls(
            strategy=(fo.strategy or "rotate").strip().lower(),
            cooldown_seconds=fo.key_cooldown_seconds,
            max_requests_per_min=max(0, fo.rotate_max_requests_per_min),
            max_tokens_per_min=max(0, fo.rotate_max_tokens_per_min),
        )

    @property
    def rotation_enabled(self) -> bool:
        # Only the explicit rotate-family enables local key rotation. Everything
        # else (9router / router / off / none) delegates failover or disables it.
        return self.strategy in ("rotate", "rotation", "local", "key", "keys")


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


def extract_total_tokens(result: Any) -> int:
    """Pull a total-token count from a LangChain response, 0 if unknown."""
    usage = getattr(result, "usage_metadata", None)
    if isinstance(usage, dict):
        total = usage.get("total_tokens")
        if total:
            return int(total)
        got = int(usage.get("input_tokens", 0) or 0) + int(usage.get("output_tokens", 0) or 0)
        if got:
            return got

    meta = getattr(result, "response_metadata", None)
    if isinstance(meta, dict):
        block = meta.get("token_usage") or meta.get("usage") or {}
        if isinstance(block, dict):
            total = block.get("total_tokens")
            if total:
                return int(total)
            got = int(block.get("prompt_tokens", 0) or 0) + int(block.get("completion_tokens", 0) or 0)
            if got:
                return got
    return 0


class _KeyState:
    """Mutable per-key bookkeeping, shared across bound clones by reference."""

    __slots__ = ("disabled_until", "last_error", "requests", "tokens")

    def __init__(self) -> None:
        self.disabled_until: float = 0.0
        self.last_error: str = ""
        # 60s sliding windows: request timestamps and (timestamp, token) pairs.
        self.requests: deque[float] = deque()
        self.tokens: deque[tuple[float, int]] = deque()

    def prune(self, now: float) -> None:
        cutoff = now - _WINDOW_SECONDS
        while self.requests and self.requests[0] <= cutoff:
            self.requests.popleft()
        while self.tokens and self.tokens[0][0] <= cutoff:
            self.tokens.popleft()

    def tokens_in_window(self) -> int:
        return sum(count for _, count in self.tokens)


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
        config: RotationConfig | None = None,
        labels: list[str] | None = None,
        _states: list[_KeyState] | None = None,
        _index: list[int] | None = None,
    ):
        if not models:
            raise ValueError("RotatingChatModel requires at least one underlying model")
        self._models = models
        self._config = config or RotationConfig.from_env()
        self._labels = labels or [f"key#{i + 1}" for i in range(len(models))]
        # Cooldown/window state and the current cursor are shared by reference so
        # that bind_tools()/with_*() clones rotate in lock-step with the original.
        self._states = _states if _states is not None else [_KeyState() for _ in models]
        self._index = _index if _index is not None else [0]

    # ── pool selection ──────────────────────────────────────────────────────
    def _saturated(self, idx: int, now: float) -> bool:
        """True if key ``idx`` has hit its proactive RPM/TPM budget this minute."""
        cfg = self._config
        if not cfg.max_requests_per_min and not cfg.max_tokens_per_min:
            return False
        state = self._states[idx]
        state.prune(now)
        if cfg.max_requests_per_min and len(state.requests) >= cfg.max_requests_per_min:
            return True
        if cfg.max_tokens_per_min and state.tokens_in_window() >= cfg.max_tokens_per_min:
            return True
        return False

    def _order(self) -> list[int]:
        """Indices to try, current first.

        Preference tiers: (1) keys that are neither cooling down nor over budget,
        (2) keys merely over their soft RPM/TPM budget, (3) the cooling-down key
        whose cooldown expires soonest. Trying *something* always beats failing.
        """
        now = time.monotonic()
        n = len(self._models)
        start = self._index[0] % n
        rotated = [(start + offset) % n for offset in range(n)]

        cooling = {i for i in rotated if self._states[i].disabled_until > now}
        not_cooling = [i for i in rotated if i not in cooling]

        ready = [i for i in not_cooling if not self._saturated(i, now)]
        if ready:
            return ready
        if not_cooling:  # over budget but not erroring — still preferable to a tripped key
            return not_cooling
        return sorted(rotated, key=lambda i: self._states[i].disabled_until)

    def _trip(self, idx: int, exc: BaseException) -> None:
        self._states[idx].disabled_until = time.monotonic() + self._config.cooldown_seconds
        self._states[idx].last_error = str(exc)[:200]

    def _promote(self, idx: int) -> None:
        self._index[0] = idx

    def _record(self, idx: int, tokens: int) -> None:
        now = time.monotonic()
        state = self._states[idx]
        state.requests.append(now)
        if tokens > 0:
            state.tokens.append((now, tokens))
        state.prune(now)

    def _log_rotate(self, idx: int, exc: BaseException) -> None:
        get_logger().warning(
            "LLM key %s failed (%s); rotating to next key",
            self._labels[idx], type(exc).__name__,
        )

    # ── wrapped entry points ────────────────────────────────────────────────
    async def ainvoke(self, *args: Any, **kwargs: Any) -> Any:
        order = self._order()
        last_exc: BaseException | None = None
        for pos, idx in enumerate(order):
            try:
                result = await self._models[idx].ainvoke(*args, **kwargs)
                self._promote(idx)
                self._record(idx, extract_total_tokens(result))
                return result
            except Exception as exc:  # noqa: BLE001 - provider errors are heterogeneous
                last_exc = exc
                if should_rotate(exc) and pos < len(order) - 1:
                    self._trip(idx, exc)
                    self._log_rotate(idx, exc)
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    def invoke(self, *args: Any, **kwargs: Any) -> Any:
        order = self._order()
        last_exc: BaseException | None = None
        for pos, idx in enumerate(order):
            try:
                result = self._models[idx].invoke(*args, **kwargs)
                self._promote(idx)
                self._record(idx, extract_total_tokens(result))
                return result
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if should_rotate(exc) and pos < len(order) - 1:
                    self._trip(idx, exc)
                    self._log_rotate(idx, exc)
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    async def astream(self, *args: Any, **kwargs: Any):
        # Rotate on the error raised before the first chunk; mid-stream failures
        # cannot be retried transparently and propagate as-is.
        order = self._order()
        last_exc: BaseException | None = None
        for pos, idx in enumerate(order):
            try:
                agen = self._models[idx].astream(*args, **kwargs)
                first = await agen.__anext__()
            except StopAsyncIteration:
                self._promote(idx)
                self._record(idx, 0)
                return
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if should_rotate(exc) and pos < len(order) - 1:
                    self._trip(idx, exc)
                    self._log_rotate(idx, exc)
                    continue
                raise
            self._promote(idx)
            tokens = extract_total_tokens(first)
            yield first
            async for chunk in agen:
                tokens = extract_total_tokens(chunk) or tokens
                yield chunk
            self._record(idx, tokens)
            return
        if last_exc is not None:
            raise last_exc

    # ── proxied builders that must stay rotating ────────────────────────────
    def _clone(self, models: list[Any]) -> "RotatingChatModel":
        return RotatingChatModel(
            models,
            config=self._config,
            labels=self._labels,
            _states=self._states,
            _index=self._index,
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
    config: RotationConfig | None = None,
) -> Any:
    """Build one chat model per key; wrap in ``RotatingChatModel`` when active.

    Returns the bare model (zero overhead, identical to pre-rotation behaviour)
    when there is a single key, or when ``LLM_FAILOVER_STRATEGY`` is not
    ``rotate`` (failover is delegated to a router service / disabled).
    """
    cfg = config or RotationConfig.from_env()
    keys = [k.strip() for k in api_keys if k and k.strip()]
    seen: set[str] = set()
    keys = [k for k in keys if not (k in seen or seen.add(k))]
    if not keys:
        raise ValueError("build_rotating_model requires at least one non-empty API key")

    if len(keys) == 1:
        return build_one(keys[0])

    if not cfg.rotation_enabled:
        get_logger().info(
            "LLM key rotation disabled (LLM_FAILOVER_STRATEGY=%s); using a single %s key, "
            "failover delegated elsewhere",
            cfg.strategy, label_prefix,
        )
        return build_one(keys[0])

    models = [build_one(key) for key in keys]
    labels = [f"{label_prefix}#{i + 1}…{k[-4:]}" for i, k in enumerate(keys)]
    get_logger().info(
        "LLM key rotation enabled across %d keys (%s) — RPM/key=%s TPM/key=%s cooldown=%ss",
        len(keys), label_prefix,
        cfg.max_requests_per_min or "∞",
        cfg.max_tokens_per_min or "∞",
        cfg.cooldown_seconds,
    )
    return RotatingChatModel(models, config=cfg, labels=labels)


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
