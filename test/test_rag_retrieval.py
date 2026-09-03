"""Tests for BM25 and the RAG retrieval modes (bm25 / qdrant / neo4j / hybrid)."""

from __future__ import annotations

import importlib.util
import tempfile

import pytest

from server.app.service.rag_retrieval import RagRetrievalService
from server.domain.memory.bm25 import bm25_rank
from server.domain.memory.knowledge_graph import (
    ConversationKnowledgeGraph,
    GraphEdge,
    GraphNode,
)
from server.infra.llm.embeddings import HashingEmbeddingProvider


def _has(mod: str) -> bool:
    return importlib.util.find_spec(mod) is not None


def _graph() -> ConversationKnowledgeGraph:
    g = ConversationKnowledgeGraph(conversation_id="c1")
    g.chunks = {
        "k1": "The launch date is September 12 for Project X",
        "k2": "Budget ceiling for Q3 is 200k dollars",
        "k3": "Acme Corp owns Project X and funds it",
    }
    g.nodes["acme"] = GraphNode(id="acme", type="entity", value="Acme Corp", chunk_ids=["k3"])
    g.nodes["px"] = GraphNode(id="px", type="entity", value="Project X", chunk_ids=["k1", "k3"])
    g.edges["e1"] = GraphEdge(id="e1", src="acme", dst="px", relation="owns")
    return g


# --------------------------------------------------------------------------- #
# BM25                                                                        #
# --------------------------------------------------------------------------- #

def test_bm25_ranks_relevant_doc_first():
    docs = [
        ("a", "the quick brown fox"),
        ("b", "launch date september project"),
        ("c", "budget ceiling dollars"),
    ]
    ranked = bm25_rank("when is the launch date", docs, top_k=2)
    assert ranked and ranked[0][0] == "b"


def test_bm25_empty_query_or_corpus():
    assert bm25_rank("", [("a", "x")], top_k=3) == []
    assert bm25_rank("hello", [], top_k=3) == []


# --------------------------------------------------------------------------- #
# RAG modes                                                                   #
# --------------------------------------------------------------------------- #

def test_rag_bm25_mode():
    svc = RagRetrievalService(mode="bm25", top_k=2)
    hits = svc.retrieve("c1", "when is the launch date", _graph())
    assert hits and hits[0].chunk_id == "k1"


def test_rag_neo4j_graph_expansion():
    # Seed by "Acme Corp" → expand the owns edge to Project X → pull their chunks.
    svc = RagRetrievalService(mode="neo4j", top_k=5, hops=1)
    ids = {h.chunk_id for h in svc.retrieve("c1", "tell me about Acme Corp", _graph())}
    assert "k3" in ids  # Acme's chunk
    assert "k1" in ids  # reached via Project X (graph expansion)


def test_rag_hybrid_combines_vector_and_graph():
    emb = HashingEmbeddingProvider(dim=64)
    from server.infra.vector_store.faiss_store import FaissVectorStore

    vs = FaissVectorStore(dim=64, path=tempfile.mkdtemp())
    svc = RagRetrievalService(
        mode="hybrid", embedding_provider_getter=lambda: emb, vector_store=vs, top_k=3, hops=1
    )
    hits = svc.retrieve("c1", "Project X launch", _graph())
    assert hits
    block = svc.render(hits)
    assert "Additional information (RAG)" in block


def test_rag_render_respects_char_budget():
    svc = RagRetrievalService(mode="bm25", top_k=5, max_chars=60)
    block = svc.render(svc.retrieve("c1", "project launch budget acme", _graph()))
    assert len(block) <= 200  # header + at least one line, bounded


def test_rag_unconfigured_vector_falls_back_to_bm25():
    # qdrant mode but no embedder/store → must not crash, falls back to BM25.
    svc = RagRetrievalService(mode="qdrant", embedding_provider_getter=lambda: None, vector_store=None)
    hits = svc.retrieve("c1", "launch date", _graph())
    assert hits and hits[0].chunk_id == "k1"


@pytest.mark.skipif(not _has("faiss"), reason="faiss not installed")
def test_rag_qdrant_mode_with_faiss_store():
    # Exercise the vector path (FAISS stands in for any ANN store).
    emb = HashingEmbeddingProvider(dim=64)
    from server.infra.vector_store.faiss_store import FaissVectorStore

    vs = FaissVectorStore(dim=64, path=tempfile.mkdtemp())
    svc = RagRetrievalService(
        mode="qdrant", embedding_provider_getter=lambda: emb, vector_store=vs, top_k=2
    )
    hits = svc.retrieve("c1", "budget ceiling dollars", _graph())
    assert any(h.chunk_id == "k2" for h in hits)
