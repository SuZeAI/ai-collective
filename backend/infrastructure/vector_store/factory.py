from __future__ import annotations

from pathlib import Path

from backend.api.settings import settings
from backend.infrastructure.vector_store.base import VectorStore
from backend.log import get_logger

logger = get_logger(__name__)


def create_vector_store(*, dim: int) -> VectorStore | None:
    """Build the configured vector store, or None for brute-force fallback.

    Never raises: a missing optional dependency or an unreachable service logs a
    warning and returns None so the LTM service keeps working without an index.
    """
    cfg = settings.vector_store
    backend = (cfg.backend or "none").strip().lower()
    if backend in {"none", "", "off"}:
        return None

    try:
        if backend == "faiss":
            from backend.infrastructure.vector_store.faiss_store import FaissVectorStore

            base = cfg.faiss_path or (str(Path(settings.storage_dir or "storage") / "vector_store"))
            store = FaissVectorStore(dim=dim, path=base, overfetch=cfg.overfetch)
            logger.info("Vector store: FAISS (path=%s, dim=%d)", base, dim)
            return store

        if backend == "qdrant":
            if not cfg.qdrant_url:
                logger.warning("VECTOR_STORE_BACKEND=qdrant but QDRANT_URL is empty; using brute force")
                return None
            from backend.infrastructure.vector_store.qdrant_store import QdrantVectorStore

            store = QdrantVectorStore(
                dim=dim,
                url=cfg.qdrant_url,
                api_key=cfg.qdrant_api_key,
                collection=cfg.qdrant_collection,
                overfetch=cfg.overfetch,
            )
            logger.info("Vector store: Qdrant (collection=%s, dim=%d)", cfg.qdrant_collection, dim)
            return store

        logger.warning("Unknown VECTOR_STORE_BACKEND=%r; using brute force", backend)
    except Exception:  # noqa: BLE001 — optional dep / unreachable service
        logger.warning("Vector store '%s' unavailable; using brute force", backend, exc_info=True)
    return None
