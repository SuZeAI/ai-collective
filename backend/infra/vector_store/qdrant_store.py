"""Qdrant vector store for long-term memory.

Stores scope dimensions as point payload and pushes the scope filter into the
query (a record matches when, per dimension, its value is null OR equals the
query's value). Cosine distance over the embedding vectors.

Best-effort: a missing ``qdrant_client`` dependency or an unreachable service
makes the factory skip this backend so the LTM service falls back to brute force.
"""

from __future__ import annotations

import hashlib

from backend.domain.memory.long_term_memory import MemoryScope
from backend.infra.vector_store.base import VectorHit, scope_payload
from backend.log import get_logger

logger = get_logger(__name__)


def _point_id(record_id: str) -> str:
    """Qdrant point ids must be UUIDs or unsigned ints — hash the record id to a UUID."""
    h = hashlib.blake2b(record_id.encode("utf-8"), digest_size=16).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


class QdrantVectorStore:
    def __init__(
        self,
        *,
        dim: int,
        url: str,
        api_key: str | None,
        collection: str,
        overfetch: int = 5,
    ) -> None:
        from qdrant_client import QdrantClient  # raises if not installed
        from qdrant_client import models as qmodels

        self._qm = qmodels
        self._dim = int(dim)
        self._collection = collection
        self._overfetch = max(1, overfetch)
        self._client = QdrantClient(url=url, api_key=api_key, timeout=10.0)
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            existing = {c.name for c in self._client.get_collections().collections}
            if self._collection not in existing:
                self._client.create_collection(
                    collection_name=self._collection,
                    vectors_config=self._qm.VectorParams(
                        size=self._dim, distance=self._qm.Distance.COSINE
                    ),
                )
        except Exception:  # noqa: BLE001
            logger.exception("Qdrant ensure_collection failed")
            raise

    # ── VectorStore API ──────────────────────────────────────────────────────────
    def upsert(self, record_id: str, vector: list[float], scope: MemoryScope) -> None:
        if not vector or len(vector) != self._dim:
            return
        try:
            payload = dict(scope_payload(scope))
            payload["record_id"] = record_id
            self._client.upsert(
                collection_name=self._collection,
                points=[
                    self._qm.PointStruct(id=_point_id(record_id), vector=vector, payload=payload)
                ],
            )
        except Exception:  # noqa: BLE001
            logger.exception("Qdrant upsert failed for %s", record_id)

    def _scope_filter(self, scope: MemoryScope):
        scope = scope.normalized()
        must = []
        for field_name, value in (
            ("workspace_id", scope.company_id),
            ("owner_id", scope.owner_id),
            ("agent_id", scope.staff_id),
        ):
            if value is None:
                continue
            # match value OR field is null (broad record)
            must.append(
                self._qm.Filter(
                    should=[
                        self._qm.FieldCondition(
                            key=field_name, match=self._qm.MatchValue(value=value)
                        ),
                        self._qm.IsNullCondition(is_null=self._qm.PayloadField(key=field_name)),
                    ]
                )
            )
        return self._qm.Filter(must=must) if must else None

    def search(self, vector: list[float], *, top_k: int, scope: MemoryScope) -> list[VectorHit]:
        if not vector or len(vector) != self._dim:
            return []
        try:
            # query_points is the current API (search() was removed in newer
            # qdrant-client); .points holds the ranked ScoredPoint list.
            response = self._client.query_points(
                collection_name=self._collection,
                query=vector,
                query_filter=self._scope_filter(scope),
                limit=max(top_k, 1),
                with_payload=True,
            )
            results = getattr(response, "points", response)
        except Exception:  # noqa: BLE001
            logger.exception("Qdrant search failed")
            return []
        hits: list[VectorHit] = []
        for point in results:
            rid = (getattr(point, "payload", None) or {}).get("record_id")
            if rid:
                hits.append(VectorHit(id=str(rid), score=float(point.score)))
        return hits

    def delete(self, record_id: str) -> None:
        try:
            self._client.delete(
                collection_name=self._collection,
                points_selector=self._qm.PointIdsList(points=[_point_id(record_id)]),
            )
        except Exception:  # noqa: BLE001
            logger.exception("Qdrant delete failed for %s", record_id)
