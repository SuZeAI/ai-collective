from __future__ import annotations

from pathlib import Path

from backend.application.service.graph_context_service import GraphContextService
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.infrastructure.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from backend.infrastructure.repositories.json_store import JsonFileStore


def _build_service(tmp_path: Path) -> GraphContextService:
    repo = JsonGraphKnowledgeRepository(
        JsonFileStore(tmp_path / "graph_knowledge.json"),
        JsonFileStore(tmp_path / "graph_knowledge_events.json"),
    )
    return GraphContextService(repo)


def test_ingest_and_retrieve_lexical(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    conversation_id = "task-1"
    cfg = GraphContextConfig(retrieve_method="lexical", build_method="rule")

    service.ingest_message(
        conversation_id=conversation_id,
        message_id="m1",
        speaker="user",
        content="Build graph context retrieval for task planning and scheduling.",
        config=cfg,
    )
    service.ingest_message(
        conversation_id=conversation_id,
        message_id="m2",
        speaker="agent",
        content="Task planning depends on scheduling constraints and milestones.",
        config=cfg,
    )

    pack = service.build_graph_context(
        conversation_id=conversation_id,
        query="Need planning context",
        config=cfg,
    )

    assert pack.method == "lexical"
    assert len(pack.node_ids) > 0
    assert "Graph knowledge context" in pack.text


def test_hybrid_options_do_not_crash(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    conversation_id = "team-42"
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
        conversation_id=conversation_id,
        message_id="m1",
        speaker="user",
        content="Agent Alice needs timeline estimation and risk review.",
        config=cfg,
    )

    pack = service.build_graph_context(
        conversation_id=conversation_id,
        query="risk estimation",
        config=cfg,
    )

    assert pack.method == "hybrid"
    assert isinstance(pack.node_ids, list)
    assert isinstance(pack.edge_ids, list)
