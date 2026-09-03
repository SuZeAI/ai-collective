"""Pluggable ANN vector stores for long-term memory recall.

``none`` (no store) keeps the repository's brute-force cosine. ``faiss`` builds a
local on-disk index; ``qdrant`` uses an external service. All are optional and
degrade to brute-force if their dependency/service is unavailable.
"""

from backend.infra.vector_store.base import VectorHit, VectorStore
from backend.infra.vector_store.factory import create_vector_store

__all__ = ["VectorHit", "VectorStore", "create_vector_store"]
