"""Local FAISS vector store for long-term memory.

Uses an inner-product index over L2-normalised vectors (== cosine). FAISS has no
native metadata filter, so scope payloads are kept in a JSON sidecar and applied
after the ANN search (over-fetch then filter). Persisted to ``{path}/ltm.faiss``
+ ``{path}/ltm_meta.json`` and rewritten on each mutation (LTM volume is small).

Best-effort: a missing ``faiss`` dependency or any error makes the factory skip
this backend so the service falls back to brute force.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from backend.domain.memory.long_term_memory import MemoryScope
from backend.infra.vector_store.base import VectorHit, payload_matches, scope_payload
from backend.log import get_logger

logger = get_logger(__name__)


class FaissVectorStore:
    def __init__(self, *, dim: int, path: str, overfetch: int = 5) -> None:
        import faiss  # raises if not installed → factory catches

        self._faiss = faiss
        self._dim = int(dim)
        self._overfetch = max(1, overfetch)
        self._lock = threading.RLock()
        self._dir = Path(path)
        self._index_path = self._dir / "ltm.faiss"
        self._meta_path = self._dir / "ltm_meta.json"

        # id <-> contiguous int label mapping for IndexIDMap2.
        self._labels: dict[str, int] = {}
        self._payloads: dict[str, dict] = {}
        self._next_label = 0
        self._index = faiss.IndexIDMap2(faiss.IndexFlatIP(self._dim))
        self._load()

    # ── persistence ───────────────────────────────────────────────────────────
    def _load(self) -> None:
        try:
            if self._meta_path.exists():
                meta = json.loads(self._meta_path.read_text(encoding="utf-8"))
                self._labels = {str(k): int(v) for k, v in meta.get("labels", {}).items()}
                self._payloads = {str(k): dict(v) for k, v in meta.get("payloads", {}).items()}
                self._next_label = int(meta.get("next_label", 0))
            if self._index_path.exists():
                self._index = self._faiss.read_index(str(self._index_path))
        except Exception:  # noqa: BLE001 — corrupt index must not break startup
            logger.exception("FAISS load failed; starting empty")
            self._labels, self._payloads, self._next_label = {}, {}, 0
            self._index = self._faiss.IndexIDMap2(self._faiss.IndexFlatIP(self._dim))

    def _persist(self) -> None:
        try:
            self._dir.mkdir(parents=True, exist_ok=True)
            self._faiss.write_index(self._index, str(self._index_path))
            self._meta_path.write_text(
                json.dumps(
                    {
                        "labels": self._labels,
                        "payloads": self._payloads,
                        "next_label": self._next_label,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
        except Exception:  # noqa: BLE001
            logger.exception("FAISS persist failed")

    # ── helpers ─────────────────────────────────────────────────────────────────
    def _np(self, vector: list[float]):
        import numpy as np

        arr = np.asarray([vector], dtype="float32")
        norm = float((arr * arr).sum() ** 0.5)
        if norm > 0:
            arr = arr / norm
        return arr

    # ── VectorStore API ──────────────────────────────────────────────────────────
    def upsert(self, record_id: str, vector: list[float], scope: MemoryScope) -> None:
        if not vector or len(vector) != self._dim:
            return
        with self._lock:
            try:
                label = self._labels.get(record_id)
                if label is not None:
                    self._index.remove_ids(self._as_ids([label]))
                else:
                    label = self._next_label
                    self._next_label += 1
                    self._labels[record_id] = label
                self._index.add_with_ids(self._np(vector), self._as_ids([label]))
                self._payloads[record_id] = scope_payload(scope)
                self._persist()
            except Exception:  # noqa: BLE001
                logger.exception("FAISS upsert failed for %s", record_id)

    def _as_ids(self, labels: list[int]):
        import numpy as np

        return np.asarray(labels, dtype="int64")

    def search(self, vector: list[float], *, top_k: int, scope: MemoryScope) -> list[VectorHit]:
        if not vector or len(vector) != self._dim:
            return []
        with self._lock:
            if self._index.ntotal == 0:
                return []
            try:
                k = min(self._index.ntotal, max(top_k, 1) * self._overfetch)
                scores, ids = self._index.search(self._np(vector), k)
            except Exception:  # noqa: BLE001
                logger.exception("FAISS search failed")
                return []
            label_to_id = {label: rid for rid, label in self._labels.items()}
            hits: list[VectorHit] = []
            for score, label in zip(scores[0], ids[0]):
                if label < 0:
                    continue
                record_id = label_to_id.get(int(label))
                if record_id is None:
                    continue
                if not payload_matches(scope, self._payloads.get(record_id, {})):
                    continue
                hits.append(VectorHit(id=record_id, score=float(score)))
                if len(hits) >= top_k:
                    break
            return hits

    def delete(self, record_id: str) -> None:
        with self._lock:
            label = self._labels.pop(record_id, None)
            self._payloads.pop(record_id, None)
            if label is None:
                return
            try:
                self._index.remove_ids(self._as_ids([label]))
                self._persist()
            except Exception:  # noqa: BLE001
                logger.exception("FAISS delete failed for %s", record_id)
