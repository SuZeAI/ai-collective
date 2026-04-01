from __future__ import annotations

import math
import re
from dataclasses import asdict
from datetime import datetime, timezone
from uuid import uuid4

from backend.application.ports.repositories import GraphKnowledgeRepository
from backend.domain.memory.knowledge_graph import (
    ConversationKnowledgeGraph,
    GraphContextConfig,
    GraphContextPack,
    GraphEdge,
    GraphNode,
)

_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "for",
    "of",
    "in",
    "on",
    "with",
    "is",
    "are",
    "be",
    "as",
    "that",
    "this",
    "it",
    "at",
    "by",
    "from",
    "you",
    "we",
    "i",
    "he",
    "she",
    "they",
    "them",
    "cua",
    "la",
    "va",
    "cho",
    "voi",
    "mot",
    "nhung",
    "hay",
    "can",
    "toi",
    "ban",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9_]+", text.lower())
    return [w for w in words if len(w) >= 3 and w not in _STOPWORDS]


def _term_freq(tokens: list[str]) -> dict[str, float]:
    if not tokens:
        return {}
    out: dict[str, float] = {}
    total = float(len(tokens))
    for token in tokens:
        out[token] = out.get(token, 0.0) + (1.0 / total)
    return out


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    if dot <= 0:
        return 0.0
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _canonical_node_id(node_type: str, value: str) -> str:
    key = re.sub(r"\s+", " ", value.strip().lower())
    return f"{node_type}:{key}"


class GraphContextService:
    def __init__(self, repo: GraphKnowledgeRepository):
        self._repo = repo

    def ingest_message(
        self,
        *,
        conversation_id: str,
        message_id: str,
        speaker: str,
        content: str,
        config: GraphContextConfig | None = None,
    ) -> None:
        graph = self._repo.get(conversation_id) or ConversationKnowledgeGraph(
            conversation_id=conversation_id
        )
        effective_config = (config or graph.config).normalized()
        graph.config = effective_config

        message_node = self._upsert_node(
            graph,
            GraphNode(
                id=_canonical_node_id("event", f"{speaker}:{message_id}"),
                type="event",
                value=f"{speaker}: {content[:160]}",
                source_message_ids=[message_id],
                confidence=1.0,
                salience_score=0.7,
            ),
        )

        entities = self._extract_entities(content, effective_config)
        for entity in entities:
            node = self._upsert_node(
                graph,
                GraphNode(
                    id=_canonical_node_id(entity["type"], entity["value"]),
                    type=entity["type"],
                    value=entity["value"],
                    aliases=[],
                    source_message_ids=[message_id],
                    confidence=entity["confidence"],
                    salience_score=entity["salience"],
                ),
            )
            self._upsert_edge(
                graph,
                GraphEdge(
                    id=f"mentions:{message_node.id}->{node.id}",
                    src=message_node.id,
                    dst=node.id,
                    relation="mentions",
                    weight=0.55,
                    source_message_ids=[message_id],
                ),
            )

        relations = self._extract_relations(content, effective_config)
        for rel in relations:
            src_id = _canonical_node_id(rel["src_type"], rel["src"])
            dst_id = _canonical_node_id(rel["dst_type"], rel["dst"])
            src_node = self._upsert_node(
                graph,
                GraphNode(
                    id=src_id,
                    type=rel["src_type"],
                    value=rel["src"],
                    source_message_ids=[message_id],
                    confidence=0.6,
                    salience_score=0.6,
                ),
            )
            dst_node = self._upsert_node(
                graph,
                GraphNode(
                    id=dst_id,
                    type=rel["dst_type"],
                    value=rel["dst"],
                    source_message_ids=[message_id],
                    confidence=0.6,
                    salience_score=0.6,
                ),
            )
            self._upsert_edge(
                graph,
                GraphEdge(
                    id=f"{rel['relation']}:{src_node.id}->{dst_node.id}",
                    src=src_node.id,
                    dst=dst_node.id,
                    relation=rel["relation"],
                    weight=0.7,
                    source_message_ids=[message_id],
                ),
            )

        if message_id not in graph.message_ids:
            graph.message_ids.append(message_id)
        graph.last_message_index = len(graph.message_ids)
        graph.updated_at = _now_iso()

        self._repo.upsert(graph)
        if graph.config.persist_mode == "snapshot_plus_log":
            self._repo.append_event(
                conversation_id,
                {
                    "type": "ingest_message",
                    "message_id": message_id,
                    "speaker": speaker,
                    "created_at": _now_iso(),
                    "config": asdict(graph.config),
                },
            )

    def build_graph_context(
        self,
        *,
        conversation_id: str,
        query: str,
        config: GraphContextConfig | None = None,
    ) -> GraphContextPack:
        graph = self._repo.get(conversation_id)
        if not graph:
            return GraphContextPack(
                text="",
                node_ids=[],
                edge_ids=[],
                method="empty",
            )

        effective_config = (config or graph.config).normalized()
        graph.config = effective_config
        self._repo.upsert(graph)

        if effective_config.retrieve_method == "lexical":
            seeds = self._retrieve_lexical(graph, query, effective_config)
        elif effective_config.retrieve_method == "embedding":
            seeds = self._retrieve_embedding(graph, query, effective_config)
        else:
            lexical = self._retrieve_lexical(graph, query, effective_config)
            embedding = self._retrieve_embedding(graph, query, effective_config)
            combined = {nid: lexical.get(nid, 0.0) * 0.5 + embedding.get(nid, 0.0) * 0.5 for nid in set(lexical) | set(embedding)}
            seeds = combined

        node_ids = self._expand_nodes(graph, seeds, effective_config)
        edge_ids = self._related_edges(graph, node_ids, effective_config.top_k_edges)

        lines = []
        for node_id in node_ids:
            node = graph.nodes.get(node_id)
            if not node:
                continue
            lines.append(f"- [{node.type}] {node.value}")

        if not lines:
            return GraphContextPack(text="", node_ids=[], edge_ids=[], method=effective_config.retrieve_method)

        context_text = "Graph knowledge context:\n" + "\n".join(lines)
        return GraphContextPack(
            text=context_text,
            node_ids=node_ids,
            edge_ids=edge_ids,
            method=effective_config.retrieve_method,
        )

    def _extract_entities(self, content: str, config: GraphContextConfig) -> list[dict[str, object]]:
        tokens = _tokenize(content)
        ranked = sorted({t: tokens.count(t) for t in set(tokens)}.items(), key=lambda x: x[1], reverse=True)
        entities: list[dict[str, object]] = []

        if config.entity_method in {"keyword", "hybrid"}:
            for token, freq in ranked[:6]:
                entities.append(
                    {
                        "type": "topic",
                        "value": token,
                        "confidence": min(0.95, 0.45 + 0.1 * freq),
                        "salience": min(1.0, 0.4 + 0.08 * freq),
                    }
                )

        if config.entity_method in {"capitalized", "hybrid"}:
            for cap in re.findall(r"\b[A-Z][a-zA-Z0-9_]{2,}\b", content):
                entities.append(
                    {
                        "type": "entity",
                        "value": cap,
                        "confidence": 0.7,
                        "salience": 0.65,
                    }
                )

        dedup: dict[str, dict[str, object]] = {}
        for ent in entities:
            key = f"{ent['type']}:{str(ent['value']).lower()}"
            if key not in dedup:
                dedup[key] = ent
        return list(dedup.values())

    def _extract_relations(self, content: str, config: GraphContextConfig) -> list[dict[str, str]]:
        relations: list[dict[str, str]] = []
        if config.relation_method == "pattern":
            patterns = [
                (r"([A-Za-z0-9_\-\s]{3,})\s+is\s+([A-Za-z0-9_\-\s]{3,})", "about"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+needs\s+([A-Za-z0-9_\-\s]{3,})", "depends_on"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+cần\s+([A-Za-z0-9_\-\s]{3,})", "depends_on"),
            ]
            for regex, relation in patterns:
                for match in re.finditer(regex, content, flags=re.IGNORECASE):
                    left = re.sub(r"\s+", " ", match.group(1).strip())
                    right = re.sub(r"\s+", " ", match.group(2).strip())
                    if len(left) < 3 or len(right) < 3:
                        continue
                    relations.append(
                        {
                            "src": left,
                            "dst": right,
                            "src_type": "claim",
                            "dst_type": "topic",
                            "relation": relation,
                        }
                    )
        else:
            tokens = _tokenize(content)
            for i in range(min(len(tokens) - 1, 6)):
                relations.append(
                    {
                        "src": tokens[i],
                        "dst": tokens[i + 1],
                        "src_type": "topic",
                        "dst_type": "topic",
                        "relation": "cooccurrence",
                    }
                )
        return relations

    def _upsert_node(self, graph: ConversationKnowledgeGraph, candidate: GraphNode) -> GraphNode:
        now = _now_iso()
        existing = graph.nodes.get(candidate.id)
        if not existing:
            candidate.created_at = now
            candidate.updated_at = now
            graph.nodes[candidate.id] = candidate
            return candidate

        for msg_id in candidate.source_message_ids:
            if msg_id not in existing.source_message_ids:
                existing.source_message_ids.append(msg_id)
        existing.salience_score = min(1.0, existing.salience_score + 0.03)
        existing.confidence = min(1.0, max(existing.confidence, candidate.confidence))
        existing.updated_at = now
        return existing

    def _upsert_edge(self, graph: ConversationKnowledgeGraph, candidate: GraphEdge) -> GraphEdge:
        now = _now_iso()
        existing = graph.edges.get(candidate.id)
        if not existing:
            candidate.created_at = now
            candidate.updated_at = now
            graph.edges[candidate.id] = candidate
            return candidate

        for msg_id in candidate.source_message_ids:
            if msg_id not in existing.source_message_ids:
                existing.source_message_ids.append(msg_id)
        existing.weight = min(1.0, existing.weight + 0.05)
        existing.updated_at = now
        return existing

    def _retrieve_lexical(
        self,
        graph: ConversationKnowledgeGraph,
        query: str,
        config: GraphContextConfig,
    ) -> dict[str, float]:
        query_tokens = set(_tokenize(query))
        if not query_tokens:
            return {}

        scores: dict[str, float] = {}
        recency_bias = max(1.0, float(graph.last_message_index))
        for node_id, node in graph.nodes.items():
            node_tokens = set(_tokenize(node.value))
            if not node_tokens:
                continue
            overlap = len(query_tokens & node_tokens) / len(query_tokens | node_tokens)
            if overlap <= 0:
                continue
            recency = min(1.0, len(node.source_message_ids) / recency_bias)
            score = overlap * config.similarity_weight + recency * config.recency_weight + node.salience_score * config.edge_weight
            if score >= config.min_score_threshold:
                scores[node_id] = score

        return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[: config.top_k_nodes])

    def _retrieve_embedding(
        self,
        graph: ConversationKnowledgeGraph,
        query: str,
        config: GraphContextConfig,
    ) -> dict[str, float]:
        query_vec = _term_freq(_tokenize(query))
        if not query_vec:
            return {}

        scores: dict[str, float] = {}
        for node_id, node in graph.nodes.items():
            node_vec = _term_freq(_tokenize(node.value))
            similarity = _cosine(query_vec, node_vec)
            if similarity < config.min_score_threshold:
                continue
            score = similarity * config.similarity_weight + node.salience_score * config.edge_weight
            scores[node_id] = score

        return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[: config.top_k_nodes])

    def _expand_nodes(
        self,
        graph: ConversationKnowledgeGraph,
        seeds: dict[str, float],
        config: GraphContextConfig,
    ) -> list[str]:
        if not seeds:
            return []

        selected = set(list(seeds.keys())[: config.top_k_nodes])
        frontier = set(selected)

        for _ in range(config.expand_hops):
            next_frontier: set[str] = set()
            for edge in graph.edges.values():
                if edge.src in frontier and edge.dst not in selected:
                    next_frontier.add(edge.dst)
                if edge.dst in frontier and edge.src not in selected:
                    next_frontier.add(edge.src)
            if not next_frontier:
                break
            selected.update(next_frontier)
            frontier = next_frontier
            if len(selected) >= config.top_k_nodes:
                break

        ranked = sorted(selected, key=lambda node_id: seeds.get(node_id, 0.0), reverse=True)
        return ranked[: config.top_k_nodes]

    def _related_edges(
        self,
        graph: ConversationKnowledgeGraph,
        node_ids: list[str],
        top_k_edges: int,
    ) -> list[str]:
        node_set = set(node_ids)
        candidates = [
            edge
            for edge in graph.edges.values()
            if edge.src in node_set and edge.dst in node_set
        ]
        candidates.sort(key=lambda edge: edge.weight, reverse=True)
        return [edge.id for edge in candidates[:top_k_edges]]
