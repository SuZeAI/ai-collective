from __future__ import annotations

from dataclasses import asdict

from backend.domain.memory.knowledge_graph import (
    ConversationKnowledgeGraph,
    GraphContextConfig,
    GraphEdge,
    GraphNode,
)
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonGraphKnowledgeRepository:
    def __init__(self, store: JsonFileStore, event_store: JsonFileStore):
        self._store = store
        self._event_store = event_store

        data = store.read()
        self._graphs: dict[str, ConversationKnowledgeGraph] = {}
        if isinstance(data, dict):
            for conversation_id, raw_graph in data.items():
                graph = self._deserialize_graph(conversation_id, raw_graph)
                if graph:
                    self._graphs[conversation_id] = graph

        events = event_store.read()
        self._events: dict[str, list[dict[str, object]]] = {}
        if isinstance(events, dict):
            for conversation_id, items in events.items():
                if isinstance(items, list):
                    self._events[conversation_id] = [
                        item for item in items if isinstance(item, dict)
                    ]

    def get(self, conversation_id: str) -> ConversationKnowledgeGraph | None:
        return self._graphs.get(conversation_id)

    def upsert(self, graph: ConversationKnowledgeGraph) -> ConversationKnowledgeGraph:
        self._graphs[graph.conversation_id] = graph
        self._persist_graphs()
        return graph

    def delete(self, conversation_id: str) -> None:
        removed_graph = self._graphs.pop(conversation_id, None)
        removed_events = self._events.pop(conversation_id, None)
        if removed_graph is not None:
            self._persist_graphs()
        if removed_events is not None:
            self._persist_events()

    def append_event(self, conversation_id: str, event: dict[str, object]) -> None:
        self._events.setdefault(conversation_id, []).append(event)
        self._persist_events()

    def _persist_graphs(self) -> None:
        payload: dict[str, object] = {}
        for conversation_id, graph in self._graphs.items():
            payload[conversation_id] = {
                "conversation_id": graph.conversation_id,
                "version": graph.version,
                "schema_version": graph.schema_version,
                "last_message_index": graph.last_message_index,
                "config": asdict(graph.config),
                "nodes": [asdict(node) for node in graph.nodes.values()],
                "edges": [asdict(edge) for edge in graph.edges.values()],
                "chunks": graph.chunks,  # NEW: Persist chunks dict
                "message_ids": list(graph.message_ids),
                "updated_at": graph.updated_at,
            }
        self._store.write(payload)

    def _persist_events(self) -> None:
        self._event_store.write(self._events)

    def _deserialize_graph(self, conversation_id: str, raw_graph: object) -> ConversationKnowledgeGraph | None:
        if not isinstance(raw_graph, dict):
            return None

        raw_config = raw_graph.get("config")
        config = GraphContextConfig()
        if isinstance(raw_config, dict):
            try:
                config = GraphContextConfig(**raw_config).normalized()
            except TypeError:
                config = GraphContextConfig()

        graph = ConversationKnowledgeGraph(
            conversation_id=str(raw_graph.get("conversation_id") or conversation_id),
            version=int(raw_graph.get("version") or 1),
            schema_version=int(raw_graph.get("schema_version") or 1),
            last_message_index=int(raw_graph.get("last_message_index") or 0),
            config=config,
            message_ids=[str(m) for m in (raw_graph.get("message_ids") or [])],
            updated_at=str(raw_graph.get("updated_at") or ""),
        )

        # NEW: Deserialize chunks dict
        raw_chunks = raw_graph.get("chunks")
        if isinstance(raw_chunks, dict):
            graph.chunks = {str(k): str(v) for k, v in raw_chunks.items()}

        raw_nodes = raw_graph.get("nodes")
        if isinstance(raw_nodes, list):
            for raw_node in raw_nodes:
                if not isinstance(raw_node, dict):
                    continue
                node = GraphNode(
                    id=str(raw_node.get("id") or ""),
                    type=str(raw_node.get("type") or "topic"),
                    value=str(raw_node.get("value") or ""),
                    aliases=[str(x) for x in (raw_node.get("aliases") or [])],
                    source_message_ids=[str(x) for x in (raw_node.get("source_message_ids") or [])],
                    chunk_ids=[str(x) for x in (raw_node.get("chunk_ids") or [])],  # NEW: Deserialize chunk_ids
                    created_at=str(raw_node.get("created_at") or ""),
                    updated_at=str(raw_node.get("updated_at") or ""),
                    confidence=float(raw_node.get("confidence") or 0.5),
                    salience_score=float(raw_node.get("salience_score") or 0.5),
                )
                if node.id:
                    graph.nodes[node.id] = node

        raw_edges = raw_graph.get("edges")
        if isinstance(raw_edges, list):
            for raw_edge in raw_edges:
                if not isinstance(raw_edge, dict):
                    continue
                edge = GraphEdge(
                    id=str(raw_edge.get("id") or ""),
                    src=str(raw_edge.get("src") or ""),
                    dst=str(raw_edge.get("dst") or ""),
                    relation=str(raw_edge.get("relation") or "related"),
                    weight=float(raw_edge.get("weight") or 0.5),
                    source_message_ids=[str(x) for x in (raw_edge.get("source_message_ids") or [])],
                    chunk_ids=[str(x) for x in (raw_edge.get("chunk_ids") or [])],  # NEW: Deserialize chunk_ids
                    created_at=str(raw_edge.get("created_at") or ""),
                    updated_at=str(raw_edge.get("updated_at") or ""),
                )
                if edge.id:
                    graph.edges[edge.id] = edge

        return graph
