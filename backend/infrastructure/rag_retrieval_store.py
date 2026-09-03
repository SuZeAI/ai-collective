"""Process-wide accessor for the RAG retrieval service.

Builds a ``RagRetrievalService`` from ``settings.retrieval.mode`` lazily and
exposes a best-effort ``retrieve_block`` that ``graph_context_service`` calls to
append an "additional information" block to the graph context.

For the ``qdrant``/``hybrid`` modes the chunk vectors live in a **separate**
vector-store namespace (FAISS sub-dir / Qdrant collection ``rag_chunks``) so they
never mix with long-term-memory vectors. ``bm25`` (default) needs no service.
"""

from __future__ import annotations

import threading

from backend.api.settings import settings
from backend.application.service.rag_retrieval import RagRetrievalService
from backend.log import get_logger

logger = get_logger(__name__)

_lock = threading.RLock()
_service: RagRetrievalService | None = None


def _build_vector_store():
    """A vector store scoped to RAG chunks (only for qdrant/hybrid modes)."""
    if not settings.embedding.enabled:
        return None
    from backend.infrastructure.llm.embeddings import get_embedding_provider

    provider = get_embedding_provider()
    if provider is None:
        return None
    # Reuse the FAISS/Qdrant factory but point it at a RAG-specific namespace
    # (via explicit overrides, not os.environ — settings.vector_store is read
    # once at process start, so mutating env afterward would be a no-op) so
    # graph chunks and LTM records stay in separate indexes/collections.
    from backend.infrastructure.vector_store import create_vector_store

    base = settings.vector_store.faiss_path or f"{settings.storage_dir or 'storage/runtime'}/vector_store"
    # Force qdrant/faiss even if VECTOR_STORE_BACKEND=none, because the RAG
    # mode itself selects the backend (qdrant) — map mode → store backend.
    backend = "qdrant" if settings.retrieval.mode in {"qdrant", "hybrid"} else settings.vector_store.backend
    return create_vector_store(
        dim=provider.dim,
        backend_override=backend,
        path_override=f"{base}/rag_chunks",
        collection_override=f"{settings.vector_store.qdrant_collection}_rag",
    )


def _get_service() -> RagRetrievalService | None:
    global _service
    mode = (settings.retrieval.mode or "bm25").strip().lower()
    if mode not in {"bm25", "qdrant", "neo4j", "hybrid"}:
        mode = "bm25"
    with _lock:
        if _service is None:
            from backend.infrastructure.llm.embeddings import get_embedding_provider

            vector_store = _build_vector_store() if mode in {"qdrant", "hybrid"} else None
            _service = RagRetrievalService(
                mode=mode,
                embedding_provider_getter=get_embedding_provider,
                vector_store=vector_store,
                top_k=settings.retrieval.top_k,
                hops=settings.retrieval.hops,
                max_chars=settings.retrieval.max_chars,
            )
            logger.info("RAG retrieval mode: %s", mode)
        return _service


def retrieve_block(
    conversation_id: str, query: str, graph, *, exclude_texts: set[str] | None = None
) -> str:
    """Return an 'additional information' block ('' on any failure/empty)."""
    try:
        service = _get_service()
        if service is None:
            return ""
        hits = service.retrieve(conversation_id, query, graph, exclude_texts=exclude_texts)
        return service.render(hits)
    except Exception:  # noqa: BLE001 — never break graph-context assembly
        logger.debug("RAG retrieve_block failed", exc_info=True)
        return ""


def reset_for_tests() -> None:
    global _service
    with _lock:
        _service = None
