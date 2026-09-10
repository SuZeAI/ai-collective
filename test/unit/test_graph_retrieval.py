from __future__ import annotations

from server.app.service.graph_retrieval import (
    cosine,
    pagerank_scores,
    related_edges,
    retrieve_embedding,
    retrieve_lexical,
    term_freq,
)
from server.domain.memory.knowledge_graph import (
    GraphContextConfig,
    GraphEdge,
    GraphNode,
    MeetingKnowledgeGraph,
)


def _graph() -> MeetingKnowledgeGraph:
    g = MeetingKnowledgeGraph(conversation_id="c1", last_message_index=10)
    g.nodes["acme"] = GraphNode(
        id="acme", type="entity", value="Acme Corp", salience_score=0.9, source_message_ids=["m1", "m2"]
    )
    g.nodes["px"] = GraphNode(
        id="px", type="entity", value="Project X", salience_score=0.6, source_message_ids=["m1"]
    )
    g.nodes["unrelated"] = GraphNode(
        id="unrelated", type="entity", value="Weather Forecast", salience_score=0.1, source_message_ids=[]
    )
    g.edges["e1"] = GraphEdge(id="e1", src="acme", dst="px", relation="owns", weight=0.8)
    return g


def test_term_freq_empty_tokens():
    assert term_freq([]) == {}


def test_term_freq_distributes_evenly():
    freqs = term_freq(["a", "a", "b"])
    assert freqs["a"] == 2 / 3
    assert freqs["b"] == 1 / 3


def test_cosine_identical_vectors_is_one():
    v = {"a": 1.0, "b": 1.0}
    assert abs(cosine(v, v) - 1.0) < 1e-9


def test_cosine_empty_vector_is_zero():
    assert cosine({}, {"a": 1.0}) == 0.0
    assert cosine({"a": 1.0}, {}) == 0.0


def test_cosine_orthogonal_vectors_is_zero():
    assert cosine({"a": 1.0}, {"b": 1.0}) == 0.0


def test_pagerank_scores_empty_graph_returns_empty():
    g = MeetingKnowledgeGraph(conversation_id="empty")
    assert pagerank_scores(g, seeds={}) == {}


def test_pagerank_scores_seeded_node_scores_higher_than_isolated_node():
    g = _graph()
    scores = pagerank_scores(g, seeds={"acme": 1.0})

    assert set(scores.keys()) == {"acme", "px", "unrelated"}
    assert scores["acme"] > scores["unrelated"]
    # px is directly connected to the seeded node, so it should outrank the fully isolated node
    assert scores["px"] > scores["unrelated"]


def test_pagerank_scores_without_seeds_uses_uniform_personalization():
    g = _graph()
    scores = pagerank_scores(g, seeds={})

    total = sum(scores.values())
    assert total == 1.0 or abs(total - 1.0) < 1e-9


def test_retrieve_lexical_ranks_matching_node_and_excludes_unrelated():
    g = _graph()
    config = GraphContextConfig(min_score_threshold=0.0, top_k_nodes=10)

    scores = retrieve_lexical(g, "tell me about acme corp", config)

    assert "acme" in scores
    assert "unrelated" not in scores


def test_retrieve_lexical_empty_query_returns_empty():
    g = _graph()
    config = GraphContextConfig()
    assert retrieve_lexical(g, "", config) == {}


def test_retrieve_lexical_respects_top_k_nodes():
    g = _graph()
    config = GraphContextConfig(min_score_threshold=0.0, top_k_nodes=1)

    scores = retrieve_lexical(g, "acme project weather", config)

    assert len(scores) <= 1


def test_retrieve_embedding_ranks_matching_node_above_unrelated_node():
    # retrieve_embedding filters on raw cosine similarity against min_score_threshold, but the
    # final score also folds in node.salience_score -- so a 0-similarity node can still appear
    # in the result (with a low score) as long as min_score_threshold is <= 0. Assert ranking,
    # not membership.
    g = _graph()
    config = GraphContextConfig(min_score_threshold=0.0, top_k_nodes=10)

    scores = retrieve_embedding(g, "acme corp", config)

    assert "acme" in scores
    assert scores["acme"] > scores["unrelated"]


def test_retrieve_embedding_threshold_excludes_zero_similarity_node():
    g = _graph()
    config = GraphContextConfig(min_score_threshold=0.5, top_k_nodes=10)

    scores = retrieve_embedding(g, "acme corp", config)

    assert "acme" in scores
    assert "unrelated" not in scores


def test_retrieve_embedding_empty_query_returns_empty():
    g = _graph()
    config = GraphContextConfig()
    assert retrieve_embedding(g, "", config) == {}


def test_related_edges_includes_edge_between_selected_entity_nodes():
    g = _graph()
    edges = related_edges(g, ["acme", "px"], top_k_edges=5)
    assert edges == ["e1"]


def test_related_edges_excludes_edge_when_endpoint_not_selected():
    g = _graph()
    edges = related_edges(g, ["acme"], top_k_edges=5)
    assert edges == []


def test_related_edges_respects_top_k_edges():
    g = _graph()
    g.edges["e2"] = GraphEdge(id="e2", src="px", dst="acme", relation="related_to", weight=0.5)
    edges = related_edges(g, ["acme", "px"], top_k_edges=1)
    assert len(edges) == 1
    assert edges[0] == "e1"  # higher weight (0.8) sorts first
