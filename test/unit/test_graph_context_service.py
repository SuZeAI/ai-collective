from __future__ import annotations

from pathlib import Path

from server.app.service.graph_context_service import GraphContextService
from server.app.service.graph_context_service import _canonical_node_id
from server.domain.memory.knowledge_graph import GraphContextConfig
from server.infra.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from server.infra.repositories.json_store import JsonFileStore


def _build_service(tmp_path: Path) -> GraphContextService:
    repo = JsonGraphKnowledgeRepository(
        JsonFileStore(tmp_path / "graph_knowledge.json"),
        JsonFileStore(tmp_path / "graph_knowledge_events.json"),
    )
    return GraphContextService(repo)


def test_ingest_and_retrieve_lexical(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    meeting_id = "task-1"
    cfg = GraphContextConfig(retrieve_method="lexical", build_method="rule")

    service.ingest_message(
        meeting_id=meeting_id,
        message_id="m1",
        speaker="user",
        content="Build graph context retrieval for task planning and scheduling.",
        config=cfg,
    )
    service.ingest_message(
        meeting_id=meeting_id,
        message_id="m2",
        speaker="agent",
        content="Task planning depends on scheduling constraints and milestones.",
        config=cfg,
    )

    pack = service.build_graph_context(
        meeting_id=meeting_id,
        query="Need planning context",
        config=cfg,
    )

    assert pack.method == "pagerank"
    assert len(pack.node_ids) > 0
    assert "Graph knowledge context" in pack.text


def test_hybrid_options_do_not_crash(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    meeting_id = "team-42"
    cfg = GraphContextConfig(
        build_method="embedding",
        entity_method="hybrid",
        relation_method="cooccurrence",
        retrieve_method="hybrid",
        expand_hops=2,
        top_k_nodes=8,
        top_k_edges=8,
    )

    service.ingest_message(
        meeting_id=meeting_id,
        message_id="m1",
        speaker="user",
        content="Agent Alice needs timeline estimation and risk review.",
        config=cfg,
    )

    pack = service.build_graph_context(
        meeting_id=meeting_id,
        query="risk estimation",
        config=cfg,
    )

    assert pack.method == "pagerank"
    assert isinstance(pack.node_ids, list)
    assert isinstance(pack.edge_ids, list)


def test_build_graph_context_deduplicates_overlapping_chunk_text(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    meeting_id = "task-overlap"
    cfg = GraphContextConfig(retrieve_method="lexical", build_method="rule")

    service.ingest_message(
        meeting_id=meeting_id,
        message_id="m1",
        speaker="user",
        content="Bao Tin Minh Chau gold price today.",
        config=cfg,
    )

    graph = service._repo.get(meeting_id)
    assert graph is not None

    entity_node = graph.nodes[_canonical_node_id("entity", "Bao Tin Minh Chau")]
    duplicated_chunk_text = "Overlap sample chunk for Bao Tin Minh Chau."
    graph.chunks["dup_a"] = duplicated_chunk_text
    graph.chunks["dup_b"] = duplicated_chunk_text
    entity_node.chunk_ids = ["dup_a", "dup_b"]
    service._repo.upsert(graph)

    pack = service.build_graph_context(
        meeting_id=meeting_id,
        query="Bao Tin Minh Chau gold price",
        config=cfg,
    )

    assert pack.chunk_ids.count("dup_a") == 1
    assert "dup_b" not in pack.chunk_ids
    assert len(pack.chunk_ids) == len(set(pack.chunk_ids))
    assert pack.text.count(duplicated_chunk_text) == 1
    assert "Bao Tin Minh Chau: Overlap sample chunk for Bao Tin Minh Chau." in pack.text


def test_repeated_message_merges_chunk_links_without_dup_nodes_edges(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    meeting_id = "task-repeat"
    cfg = GraphContextConfig(retrieve_method="lexical", build_method="rule")

    content = "Bao Tin Minh Chau needs price analysis."

    service.ingest_message(
        meeting_id=meeting_id,
        message_id="m1",
        speaker="user",
        content=content,
        config=cfg,
    )
    service.ingest_message(
        meeting_id=meeting_id,
        message_id="m2",
        speaker="user",
        content=content,
        config=cfg,
    )

    graph = service._repo.get(meeting_id)
    assert graph is not None

    entity_node = graph.nodes[_canonical_node_id("entity", "Bao Tin Minh Chau")]
    relation_edges = [
        edge
        for edge in graph.edges.values()
        if edge.src == _canonical_node_id("entity", "Bao Tin Minh Chau")
        and edge.dst == _canonical_node_id("entity", "price analysis")
        and edge.relation == "depends_on"
    ]
    assert len(relation_edges) == 1
    relation_edge = relation_edges[0]

    assert len(entity_node.source_message_ids) == 2
    assert len(entity_node.chunk_ids) >= 2
    assert len(entity_node.chunk_ids) == len(set(entity_node.chunk_ids))

    assert len(relation_edge.source_message_ids) == 2
    assert len(relation_edge.chunk_ids) >= 2
    assert len(relation_edge.chunk_ids) == len(set(relation_edge.chunk_ids))

    mentions_edges = [edge for edge in graph.edges.values() if edge.relation == "mentions"]
    assert len(mentions_edges) >= 2


def test_reset_conversation_clears_only_target_graph(tmp_path: Path) -> None:
    service = _build_service(tmp_path)

    service.ingest_message(
        meeting_id="task-a",
        message_id="m1",
        speaker="user",
        content="AI engineer la chu cong ty Suzenith.",
    )
    service.ingest_message(
        meeting_id="task-b",
        message_id="m1",
        speaker="user",
        content="Bao Tin Minh Chau gold price in Hanoi today.",
    )

    assert service._repo.get("task-a") is not None
    assert service._repo.get("task-b") is not None

    service.reset_conversation(meeting_id="task-a")

    assert service._repo.get("task-a") is None
    assert service._repo.get("task-b") is not None
