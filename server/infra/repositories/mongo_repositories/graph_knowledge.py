from __future__ import annotations

from dataclasses import asdict
from typing import Any

import pymongo

from server.domain.memory.knowledge_graph import (
    MeetingKnowledgeGraph,
    GraphContextConfig,
    GraphEdge,
    GraphNode,
)


class MongoGraphKnowledgeRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._graphs_col = db["graph_knowledge"]
        self._events_col = db["graph_knowledge_events"]
        # Pre-rename ("Conversation" -> "Meeting") databases may still carry a
        # unique index on the old, now-unused conversation_id field. Every
        # document lacks that field today, so its "unique" constraint on
        # all-null values blocks every upsert past the first. Self-heal by
        # dropping it if present, rather than requiring a manual migration.
        try:
            existing_indexes = {idx["name"] for idx in self._graphs_col.list_indexes()}
            if "conversation_id_1" in existing_indexes:
                self._graphs_col.drop_index("conversation_id_1")
        except Exception:  # noqa: BLE001 — best-effort cleanup, never block startup
            pass
        self._graphs_col.create_index("meeting_id", unique=True, background=True)
        self._events_col.create_index("meeting_id", background=True)

    # ---- Graphs ----

    def get(self, meeting_id: str) -> MeetingKnowledgeGraph | None:
        doc = self._graphs_col.find_one({"meeting_id": meeting_id})
        if not doc:
            return None
        return self._deserialize_graph(meeting_id, doc)

    def upsert(self, graph: MeetingKnowledgeGraph) -> MeetingKnowledgeGraph:
        payload = self._serialize_graph(graph)
        self._graphs_col.replace_one(
            {"meeting_id": graph.meeting_id}, payload, upsert=True
        )
        return graph

    def delete(self, meeting_id: str) -> None:
        self._graphs_col.delete_one({"meeting_id": meeting_id})
        self._events_col.delete_many({"meeting_id": meeting_id})

    # ---- Events ----

    def append_event(self, meeting_id: str, event: dict[str, object]) -> None:
        self._events_col.insert_one({"meeting_id": meeting_id, **event})

    # ---- Serialization ----

    def _serialize_graph(self, graph: MeetingKnowledgeGraph) -> dict[str, Any]:
        return {
            "_id": graph.meeting_id,
            "meeting_id": graph.meeting_id,
            "version": graph.version,
            "schema_version": graph.schema_version,
            "last_message_index": graph.last_message_index,
            "config": asdict(graph.config),
            "nodes": [asdict(node) for node in graph.nodes.values()],
            "edges": [asdict(edge) for edge in graph.edges.values()],
            "chunks": graph.chunks,
            "message_ids": list(graph.message_ids),
            "updated_at": graph.updated_at,
        }

    def _deserialize_graph(self, meeting_id: str, raw: dict[str, Any]) -> MeetingKnowledgeGraph | None:
        raw_config = raw.get("config")
        config = GraphContextConfig()
        if isinstance(raw_config, dict):
            try:
                config = GraphContextConfig(**raw_config).normalized()
            except TypeError:
                config = GraphContextConfig()

        graph = MeetingKnowledgeGraph(
            meeting_id=str(raw.get("meeting_id") or meeting_id),
            version=int(raw.get("version") or 1),
            schema_version=int(raw.get("schema_version") or 1),
            last_message_index=int(raw.get("last_message_index") or 0),
            config=config,
            message_ids=[str(m) for m in (raw.get("message_ids") or [])],
            updated_at=str(raw.get("updated_at") or ""),
        )

        raw_chunks = raw.get("chunks")
        if isinstance(raw_chunks, dict):
            graph.chunks = {str(k): str(v) for k, v in raw_chunks.items()}

        for raw_node in (raw.get("nodes") or []):
            if not isinstance(raw_node, dict):
                continue
            node = GraphNode(
                id=str(raw_node.get("id") or ""),
                type=str(raw_node.get("type") or "topic"),
                value=str(raw_node.get("value") or ""),
                aliases=[str(x) for x in (raw_node.get("aliases") or [])],
                source_message_ids=[str(x) for x in (raw_node.get("source_message_ids") or [])],
                chunk_ids=[str(x) for x in (raw_node.get("chunk_ids") or [])],
                created_at=str(raw_node.get("created_at") or ""),
                updated_at=str(raw_node.get("updated_at") or ""),
                confidence=float(raw_node.get("confidence") or 0.5),
                salience_score=float(raw_node.get("salience_score") or 0.5),
            )
            if node.id:
                graph.nodes[node.id] = node

        for raw_edge in (raw.get("edges") or []):
            if not isinstance(raw_edge, dict):
                continue
            edge = GraphEdge(
                id=str(raw_edge.get("id") or ""),
                src=str(raw_edge.get("src") or ""),
                dst=str(raw_edge.get("dst") or ""),
                relation=str(raw_edge.get("relation") or "related"),
                weight=float(raw_edge.get("weight") or 0.5),
                source_message_ids=[str(x) for x in (raw_edge.get("source_message_ids") or [])],
                chunk_ids=[str(x) for x in (raw_edge.get("chunk_ids") or [])],
                created_at=str(raw_edge.get("created_at") or ""),
                updated_at=str(raw_edge.get("updated_at") or ""),
            )
            if edge.id:
                graph.edges[edge.id] = edge

        return graph
