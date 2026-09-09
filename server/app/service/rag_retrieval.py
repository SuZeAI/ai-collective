"""RAG retrieval — fetches 'additional information' to augment staff context.

A single configurable retrieval mode over the conversation knowledge graph's
chunks + entities/relations:

* ``bm25``   — local Okapi BM25 over chunks. No service, no embeddings (default).
* ``qdrant`` — semantic vector search over chunk embeddings.
* ``neo4j``  — graph-relationship expansion (entities connected to query matches).
* ``hybrid`` — Qdrant vector *seeds* fused with Neo4j graph *expansion* (GraphRAG):
  vectors pick the entry chunks, the graph pulls in their connected neighbours.

The retriever operates on an already-loaded ``MeetingKnowledgeGraph`` (which
comes from whatever graph backend is configured, including Neo4j), so the
"hybrid" genuinely combines the vector DB and the graph store. Synchronous, so it
slots straight into ``graph_context_service.build_graph_context``. Best-effort:
any failure degrades to BM25 / empty and never breaks a run.
"""

from __future__ import annotations

from dataclasses import dataclass

from server.domain.memory.bm25 import bm25_rank
from server.domain.memory.long_term_memory import MemoryScope
from server.domain.memory.vectors import lexical_overlap
from server.share.log import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class RagHit:
    chunk_id: str
    text: str
    score: float


class RagRetrievalService:
    def __init__(
        self,
        *,
        mode: str = "bm25",
        embedding_provider_getter=None,
        vector_store=None,
        top_k: int = 5,
        hops: int = 1,
        max_chars: int = 1500,
    ) -> None:
        self._mode = (mode or "bm25").strip().lower()
        self._get_embedder = embedding_provider_getter
        self._vector_store = vector_store
        self._top_k = max(1, top_k)
        self._hops = max(1, hops)
        self._max_chars = max(200, max_chars)
        # Per-conversation set of chunk ids already pushed to the vector store.
        self._indexed: dict[str, set[str]] = {}

    @property
    def mode(self) -> str:
        return self._mode

    @staticmethod
    def _norm(text: str) -> str:
        return " ".join((text or "").split()).lower()

    # ── public API ────────────────────────────────────────────────────────────
    def retrieve(
        self,
        conversation_id: str,
        query: str,
        graph,
        *,
        exclude_texts: set[str] | None = None,
    ) -> list[RagHit]:
        chunks: dict[str, str] = dict(getattr(graph, "chunks", {}) or {})
        if exclude_texts:
            # Drop chunks whose text is already shown elsewhere in the context so
            # the RAG block adds genuinely *additional* information (and never
            # duplicates a chunk the graph already surfaced).
            chunks = {cid: t for cid, t in chunks.items() if self._norm(t) not in exclude_texts}
        if not query.strip() or not chunks:
            return []
        try:
            if self._mode == "qdrant":
                return self._retrieve_vector(conversation_id, query, chunks)
            if self._mode == "neo4j":
                return self._retrieve_graph(query, graph, chunks)
            if self._mode == "hybrid":
                return self._retrieve_hybrid(conversation_id, query, graph, chunks)
            return self._retrieve_bm25(query, chunks)
        except Exception:  # noqa: BLE001 — never break context assembly
            logger.warning("RAG retrieve failed (mode=%s); falling back to BM25", self._mode, exc_info=True)
            try:
                return self._retrieve_bm25(query, chunks)
            except Exception:  # noqa: BLE001
                return []

    def render(self, hits: list[RagHit]) -> str:
        if not hits:
            return ""
        lines = ["Additional information (RAG):"]
        used = len(lines[0])
        for hit in hits:
            text = " ".join(hit.text.split())
            line = f"- {text}"
            if used + len(line) > self._max_chars and len(lines) > 1:
                break
            lines.append(line)
            used += len(line) + 1
        return "\n".join(lines) if len(lines) > 1 else ""

    # ── modes ─────────────────────────────────────────────────────────────────
    def _retrieve_bm25(self, query: str, chunks: dict[str, str]) -> list[RagHit]:
        ranked = bm25_rank(query, list(chunks.items()), top_k=self._top_k)
        return [RagHit(cid, chunks[cid], score) for cid, score in ranked if cid in chunks]

    def _embedder(self):
        getter = self._get_embedder
        return getter() if getter else None

    def _index_chunks(self, conversation_id: str, chunks: dict[str, str], embedder) -> None:
        """Lazily push not-yet-indexed chunk vectors into the vector store."""
        seen = self._indexed.setdefault(conversation_id, set())
        pending = {cid: text for cid, text in chunks.items() if cid not in seen}
        if not pending:
            return
        ids = list(pending)
        vectors = embedder.embed_many_sync([pending[c] for c in ids])
        scope = MemoryScope(company_id=conversation_id)  # per-conversation namespace
        for cid, vec in zip(ids, vectors):
            if vec is not None:
                self._vector_store.upsert(f"{conversation_id}::{cid}", vec, scope)
            seen.add(cid)

    def _retrieve_vector(self, conversation_id: str, query: str, chunks: dict[str, str]) -> list[RagHit]:
        embedder = self._embedder()
        if embedder is None or self._vector_store is None:
            return self._retrieve_bm25(query, chunks)  # not configured → fall back
        self._index_chunks(conversation_id, chunks, embedder)
        qvec = embedder.embed_one_sync(query)
        if qvec is None:
            return self._retrieve_bm25(query, chunks)
        hits = self._vector_store.search(
            qvec, top_k=self._top_k, scope=MemoryScope(company_id=conversation_id)
        )
        out: list[RagHit] = []
        for hit in hits:
            cid = hit.id.split("::", 1)[-1]
            if cid in chunks:
                out.append(RagHit(cid, chunks[cid], hit.score))
        return out or self._retrieve_bm25(query, chunks)

    # graph helpers — work over the loaded graph (sourced from Neo4j when that
    # backend is active), so this is the graph half of the hybrid.
    def _entity_nodes(self, graph) -> list:
        return [n for n in getattr(graph, "nodes", {}).values() if getattr(n, "type", "") == "entity"]

    def _seed_entities_by_query(self, query: str, graph) -> list:
        scored = []
        for node in self._entity_nodes(graph):
            ov = lexical_overlap(query, node.value)
            if ov > 0:
                scored.append((ov, node))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [n for _, n in scored[: self._top_k]]

    def _expand(self, seeds: list, graph) -> set[str]:
        """Entity-id set reachable from ``seeds`` within ``hops`` over edges."""
        node_ids = {n.id for n in seeds}
        frontier = set(node_ids)
        edges = list(getattr(graph, "edges", {}).values())
        for _ in range(self._hops):
            nxt: set[str] = set()
            for e in edges:
                if e.src in frontier and e.dst not in node_ids:
                    nxt.add(e.dst)
                if e.dst in frontier and e.src not in node_ids:
                    nxt.add(e.src)
            if not nxt:
                break
            node_ids |= nxt
            frontier = nxt
        return node_ids

    def _chunks_for_entities(self, entity_ids: set[str], graph, chunks: dict[str, str]) -> list[str]:
        out: list[str] = []
        nodes = getattr(graph, "nodes", {})
        for nid in entity_ids:
            node = nodes.get(nid)
            if not node:
                continue
            for cid in getattr(node, "chunk_ids", []) or []:
                if cid in chunks and cid not in out:
                    out.append(cid)
        return out

    def _retrieve_graph(self, query: str, graph, chunks: dict[str, str]) -> list[RagHit]:
        seeds = self._seed_entities_by_query(query, graph)
        if not seeds:
            return self._retrieve_bm25(query, chunks)
        entity_ids = self._expand(seeds, graph)
        cids = self._chunks_for_entities(entity_ids, graph, chunks)[: self._top_k]
        # Score graph-pulled chunks by lexical relevance for a stable order.
        hits = [RagHit(cid, chunks[cid], lexical_overlap(query, chunks[cid])) for cid in cids]
        hits.sort(key=lambda h: h.score, reverse=True)
        return hits

    def _retrieve_hybrid(self, conversation_id: str, query: str, graph, chunks: dict[str, str]) -> list[RagHit]:
        # Vector seeds (Qdrant) → their entities → graph expansion (Neo4j) → chunks.
        vector_hits = self._retrieve_vector(conversation_id, query, chunks)
        seed_chunk_ids = {h.chunk_id for h in vector_hits}
        seed_entities = [
            n for n in self._entity_nodes(graph)
            if any(cid in seed_chunk_ids for cid in (getattr(n, "chunk_ids", []) or []))
        ]
        # Also fold in query-matched entities so the graph half stands on its own.
        seed_entities += self._seed_entities_by_query(query, graph)
        merged: dict[str, RagHit] = {h.chunk_id: h for h in vector_hits}
        if seed_entities:
            entity_ids = self._expand(seed_entities, graph)
            for cid in self._chunks_for_entities(entity_ids, graph, chunks):
                if cid not in merged:
                    merged[cid] = RagHit(cid, chunks[cid], lexical_overlap(query, chunks[cid]) * 0.5)
        ranked = sorted(merged.values(), key=lambda h: h.score, reverse=True)
        return ranked[: self._top_k] or self._retrieve_bm25(query, chunks)
