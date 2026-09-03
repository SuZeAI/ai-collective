"""Pluggable embedding backend for real (vector) RAG.

Mirrors the LLM provider pattern in this package (``factory.py`` selects a
concrete provider by name; each wraps a LangChain class). Embeddings power the
semantic-retrieval path of the knowledge graph, long-term memory and the
document-library RAG. Everything is **env-gated**: when ``EMBEDDING_ENABLED`` is
false the rest of the system falls back to the existing lexical retrieval, so
this is purely additive.

Backends:
* ``google`` / ``openai`` / ``open_weight`` — real embedding models via LangChain.
* ``hashing`` — a dependency-free deterministic bag-of-words vector. It needs no
  API key or network and is the default fallback, so semantic-shaped retrieval
  works out of the box (and in tests) without extra infra.

All providers are best-effort: a failure to embed returns ``None`` for that
text (callers treat ``None`` as "no vector" and fall back to lexical).
"""

from __future__ import annotations

import hashlib
from typing import Any, Protocol

from server.api.settings import settings
from server.domain.memory.vectors import tokenize
from server.infra.llm.config import find_model_for_provider
from server.infra.llm.usage_tracker import (
    current_usage_staff,
    current_usage_department,
    current_usage_user,
    _recorder,
)
from server.log import get_logger

logger = get_logger(__name__)


class EmbeddingProvider(Protocol):
    """Embeds text into fixed-length dense vectors."""

    @property
    def dim(self) -> int: ...

    async def embed(self, texts: list[str]) -> list[list[float] | None]: ...

    async def embed_one(self, text: str) -> list[float] | None: ...

    def embed_one_sync(self, text: str) -> list[float] | None: ...

    def embed_many_sync(self, texts: list[str]) -> list[list[float] | None]: ...


class HashingEmbeddingProvider:
    """Deterministic, dependency-free bag-of-words embedding.

    Hashes each token into one of ``dim`` buckets and accumulates a normalised
    term frequency. Not semantically aware like a trained model, but stable,
    fast and free — a safe default and a deterministic test fixture.
    """

    def __init__(self, *, dim: int = 256) -> None:
        self._dim = max(16, int(dim))

    @property
    def dim(self) -> int:
        return self._dim

    def _embed_sync(self, text: str) -> list[float]:
        vec = [0.0] * self._dim
        tokens = tokenize(text)
        if not tokens:
            return vec
        for tok in tokens:
            h = hashlib.blake2b(tok.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(h, "big") % self._dim
            vec[bucket] += 1.0
        # L2-normalise so cosine == dot and magnitudes are comparable.
        norm = sum(v * v for v in vec) ** 0.5
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    async def embed(self, texts: list[str]) -> list[list[float] | None]:
        return [self._embed_sync(t) for t in texts]

    async def embed_one(self, text: str) -> list[float] | None:
        return self._embed_sync(text)

    # Sync variants — used by the synchronous RAG retrieval path.
    def embed_one_sync(self, text: str) -> list[float] | None:
        return self._embed_sync(text)

    def embed_many_sync(self, texts: list[str]) -> list[list[float] | None]:
        return [self._embed_sync(t) for t in texts]


class LangChainEmbeddingProvider:
    """Wraps a LangChain ``Embeddings`` instance (google/openai/open_weight)."""

    def __init__(self, embeddings: Any, *, provider_name: str, model: str, dim: int) -> None:
        self._embeddings = embeddings
        self._provider_name = provider_name
        self._model = model
        self._dim = int(dim)

    @property
    def dim(self) -> int:
        return self._dim

    def _record_usage(self, texts: list[str]) -> None:
        # Best-effort: charge a rough token estimate so embedding spend shows up
        # on the monitoring page alongside chat usage.
        recorder = _recorder
        if recorder is None:
            return
        try:
            approx_tokens = sum(max(1, len(t) // 4) for t in texts)
            recorder(
                provider=self._provider_name,
                model=self._model,
                input_tokens=approx_tokens,
                output_tokens=0,
                user_id=current_usage_user.get(),
                staff_name=current_usage_staff.get(),
                department_id=current_usage_department.get(),
            )
        except Exception:  # noqa: BLE001 — usage tracking never breaks embedding
            logger.debug("Failed to record embedding usage", exc_info=True)

    async def embed(self, texts: list[str]) -> list[list[float] | None]:
        if not texts:
            return []
        try:
            vectors = await self._embeddings.aembed_documents(list(texts))
            self._record_usage(texts)
            self._dim = len(vectors[0]) if vectors and vectors[0] else self._dim
            return [list(v) for v in vectors]
        except Exception:  # noqa: BLE001 — degrade to "no vectors"
            logger.warning("Embedding batch failed (%s)", self._provider_name, exc_info=True)
            return [None] * len(texts)

    async def embed_one(self, text: str) -> list[float] | None:
        if not (text or "").strip():
            return None
        try:
            vector = await self._embeddings.aembed_query(text)
            self._record_usage([text])
            if vector:
                self._dim = len(vector)
            return list(vector) if vector else None
        except Exception:  # noqa: BLE001
            logger.warning("Embedding query failed (%s)", self._provider_name, exc_info=True)
            return None

    # Sync variants — used by the synchronous RAG retrieval path.
    def embed_one_sync(self, text: str) -> list[float] | None:
        if not (text or "").strip():
            return None
        try:
            vector = self._embeddings.embed_query(text)
            self._record_usage([text])
            if vector:
                self._dim = len(vector)
            return list(vector) if vector else None
        except Exception:  # noqa: BLE001
            logger.warning("Sync embedding query failed (%s)", self._provider_name, exc_info=True)
            return None

    def embed_many_sync(self, texts: list[str]) -> list[list[float] | None]:
        if not texts:
            return []
        try:
            vectors = self._embeddings.embed_documents(list(texts))
            self._record_usage(texts)
            self._dim = len(vectors[0]) if vectors and vectors[0] else self._dim
            return [list(v) for v in vectors]
        except Exception:  # noqa: BLE001
            logger.warning("Sync embedding batch failed (%s)", self._provider_name, exc_info=True)
            return [None] * len(texts)


# Default embedding model per provider (overridable via EMBEDDING_MODEL).
_DEFAULT_EMBEDDING_MODELS = {
    "google": "models/text-embedding-004",
    "openai": "text-embedding-3-small",
    "open_weight": "text-embedding-3-small",
}


def _build_langchain_embeddings(provider: str, model: str) -> Any | None:
    """Instantiate the LangChain embeddings class for ``provider`` (or None)."""
    import importlib

    dim = settings.embedding.dim
    try:
        entry = find_model_for_provider(provider, "supports_embedding")
        key = (getattr(entry, "api_key", None) or "").split(",")[0].strip() if entry else ""
        if not key:
            return None
        if provider == "google":
            cls = importlib.import_module("langchain_google_genai").GoogleGenerativeAIEmbeddings
            emb = cls(model=model, google_api_key=key)
            return LangChainEmbeddingProvider(emb, provider_name="google", model=model, dim=dim)
        if provider in {"openai", "open_weight"}:
            cls = importlib.import_module("langchain_openai").OpenAIEmbeddings
            kwargs: dict[str, Any] = {"model": model, "api_key": key}
            base_url = getattr(entry, "base_url", None)
            if provider == "open_weight" and base_url:
                kwargs["base_url"] = base_url
            return LangChainEmbeddingProvider(
                cls(**kwargs), provider_name=provider, model=model, dim=dim
            )
    except Exception:  # noqa: BLE001 — missing dep / bad key → fall back to hashing
        logger.warning("Could not build %s embeddings; using hashing fallback", provider, exc_info=True)
    return None


_provider_singleton: EmbeddingProvider | None = None


def create_embedding_provider() -> EmbeddingProvider:
    """Build the configured embedding provider (hashing fallback never fails)."""
    cfg = settings.embedding
    provider = (cfg.provider or "").strip().lower().replace("-", "_")
    if provider in {"gemini", "google_genai"}:
        provider = "google"
    if provider in {"openrouter", "open_router", "openweight"}:
        provider = "open_weight"

    if provider in _DEFAULT_EMBEDDING_MODELS:
        model = cfg.model or _DEFAULT_EMBEDDING_MODELS[provider]
        built = _build_langchain_embeddings(provider, model)
        if built is not None:
            logger.info("Embedding provider: %s (model=%s)", provider, model)
            return built

    logger.info("Embedding provider: hashing (dim=%s)", cfg.dim)
    return HashingEmbeddingProvider(dim=cfg.dim)


def get_embedding_provider() -> EmbeddingProvider | None:
    """Return the shared embedding provider, or None when embeddings are off."""
    global _provider_singleton
    if not settings.embedding.enabled:
        return None
    if _provider_singleton is None:
        _provider_singleton = create_embedding_provider()
    return _provider_singleton


def reset_embedding_provider_for_tests() -> None:
    global _provider_singleton
    _provider_singleton = None
