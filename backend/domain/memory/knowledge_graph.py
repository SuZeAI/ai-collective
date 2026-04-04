from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal


BuildMethod = Literal["rule", "embedding", "ie"]
EntityMethod = Literal["keyword", "capitalized", "hybrid"]
RelationMethod = Literal["pattern", "cooccurrence", "dependency"]
RetrieveMethod = Literal["lexical", "embedding", "hybrid"]
PersistMode = Literal["snapshot", "snapshot_plus_log"]


@dataclass(slots=True)
class GraphContextConfig:
    build_method: BuildMethod = "rule"
    entity_method: EntityMethod = "hybrid"
    relation_method: RelationMethod = "pattern"
    retrieve_method: RetrieveMethod = "hybrid"
    expand_hops: int = 1
    top_k_nodes: int = 10
    top_k_edges: int = 12
    min_score_threshold: float = 0.05
    recency_weight: float = 0.2
    similarity_weight: float = 0.6
    edge_weight: float = 0.2
    persist_mode: PersistMode = "snapshot_plus_log"

    def normalized(self) -> "GraphContextConfig":
        hops = max(1, min(3, self.expand_hops))
        top_nodes = max(3, min(30, self.top_k_nodes))
        top_edges = max(3, min(50, self.top_k_edges))
        threshold = min(1.0, max(0.0, self.min_score_threshold))

        total = self.recency_weight + self.similarity_weight + self.edge_weight
        if total <= 0:
            recency, similarity, edge = 0.2, 0.6, 0.2
        else:
            recency = self.recency_weight / total
            similarity = self.similarity_weight / total
            edge = self.edge_weight / total

        return GraphContextConfig(
            build_method=self.build_method,
            entity_method=self.entity_method,
            relation_method=self.relation_method,
            retrieve_method=self.retrieve_method,
            expand_hops=hops,
            top_k_nodes=top_nodes,
            top_k_edges=top_edges,
            min_score_threshold=threshold,
            recency_weight=recency,
            similarity_weight=similarity,
            edge_weight=edge,
            persist_mode=self.persist_mode,
        )


@dataclass(slots=True)
class GraphNode:
    id: str
    type: str
    value: str
    aliases: list[str] = field(default_factory=list)
    source_message_ids: list[str] = field(default_factory=list)
    chunk_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    confidence: float = 0.5
    salience_score: float = 0.5


@dataclass(slots=True)
class GraphEdge:
    id: str
    src: str
    dst: str
    relation: str
    weight: float = 0.5
    source_message_ids: list[str] = field(default_factory=list)
    chunk_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass(slots=True)
class ConversationKnowledgeGraph:
    conversation_id: str
    version: int = 1
    schema_version: int = 1
    last_message_index: int = 0
    config: GraphContextConfig = field(default_factory=GraphContextConfig)
    nodes: dict[str, GraphNode] = field(default_factory=dict)
    edges: dict[str, GraphEdge] = field(default_factory=dict)
    chunks: dict[str, str] = field(default_factory=dict)  # chunk_id -> chunk_text
    message_ids: list[str] = field(default_factory=list)
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass(frozen=True, slots=True)
class GraphContextPack:
    text: str
    node_ids: list[str]
    edge_ids: list[str]
    chunk_ids: list[str] = field(default_factory=list)
    method: str = "hybrid"
