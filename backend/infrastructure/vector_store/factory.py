from __future__ import annotations

from pathlib import Path

from backend.api.settings import settings
from backend.infrastructure.vector_store.base import VectorStore
from backend.log import get_logger

logger = get_logger(__name__)


def create_vector_store(
    *,
    dim: int,
    backend_override: str | None = None,
    path_override: str | None = None,
    collection_override: str | None = None,
) -> VectorStore | None:
    """Build the configured vector store, or None for brute-force fallback.

    Reads ``settings.vector_store`` by default; ``*_override`` args let a caller
    (e.g. the RAG retrieval store, which needs a separate namespace from the
    long-term-memory store) point at a different backend/path/collection
    without touching ``os.environ`` — settings are only ever read once at
    process start, so mutating env afterwards would silently have no effect.

    Never raises: a missing optional dependency or an unreachable service logs a
    warning and returns None so the LTM service keeps working without an index.
    """
    cfg = settings.vector_store
    backend = (backend_override or cfg.backend or "none").strip().lower()
    if backend in {"none", "", "off"}:
        return None

    try:
        if backend == "faiss":
            from backend.infrastructure.vector_store.faiss_store import FaissVectorStore

            base = path_override or cfg.faiss_path or (
                str(Path(settings.storage_dir or "storage/runtime") / "vector_store")
            )
            store = FaissVectorStore(dim=dim, path=base, overfetch=cfg.overfetch)
            logger.info("Vector store: FAISS (path=%s, dim=%d)", base, dim)
            return store

        if backend == "qdrant":
            if not cfg.qdrant_url:
                logger.warning("VECTOR_STORE_BACKEND=qdrant but QDRANT_URL is empty; using brute force")
                return None
            from backend.infrastructure.vector_store.qdrant_store import QdrantVectorStore

            collection = collection_override or cfg.qdrant_collection
            store = QdrantVectorStore(
                dim=dim,
                url=cfg.qdrant_url,
                api_key=cfg.qdrant_api_key,
                collection=collection,
                overfetch=cfg.overfetch,
            )
            logger.info("Vector store: Qdrant (collection=%s, dim=%d)", collection, dim)
            return store

        logger.warning("Unknown VECTOR_STORE_BACKEND=%r; using brute force", backend)
    except Exception:  # noqa: BLE001 — optional dep / unreachable service
        logger.warning("Vector store '%s' unavailable; using brute force", backend, exc_info=True)
    return None
