from __future__ import annotations

import math
import re
import json
from dataclasses import asdict
from datetime import datetime, timezone
from uuid import uuid4

try:
    import spacy
except Exception:  # pragma: no cover - fallback if spacy is not installed
    spacy = None

from backend.application.ports.repositories import GraphKnowledgeRepository
from backend.domain.memory.knowledge_graph import (
    ConversationKnowledgeGraph,
    GraphContextConfig,
    GraphContextPack,
    GraphEdge,
    GraphNode,
)
from backend.application.service.chunking_service import get_chunking_service
from backend.log import get_logger


logger = get_logger(__name__)
_NLP = None
_NLP_INIT_ATTEMPTED = False

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
    "task",
    "title",
    "description",
    "history",
    "mesage",
    "message",
    "graph_context",
    "agent",
    "ask",
}

_GENERIC_ENTITY_TERMS = {
    "task",
    "title",
    "description",
    "history",
    "message",
    "mesage",
    "graph",
    "context",
    "agent",
}

_CONTROL_BLOCK_RE = re.compile(
    r"<\s*(NEXT_AGENT|DISCUSSION_END|ASK_NEXT_AGENT)\s*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)


def _sanitize_graph_text(content: str) -> str:
    cleaned = _CONTROL_BLOCK_RE.sub(" ", content)
    cleaned = re.sub(r"<\s*/?\s*[A-Z_]+\s*>", " ", cleaned)
    cleaned = re.sub(r"\bagent\s+[^\n:]+\s+ask\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bhistory\s+mesage\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bhistory\s+message\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bgraph_context\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _is_generic_entity(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in _GENERIC_ENTITY_TERMS


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _merge_unique(existing: list[str], new_items: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for item in existing + new_items:
        if item and item not in seen:
            seen.add(item)
            merged.append(item)
    return merged


def _unique_preserve_order(items: list[str]) -> list[str]:
    return _merge_unique([], items)


def _normalize_chunk_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


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


def _get_nlp_pipeline():
    global _NLP, _NLP_INIT_ATTEMPTED
    if _NLP_INIT_ATTEMPTED:
        return _NLP

    _NLP_INIT_ATTEMPTED = True
    if spacy is None:
        logger.warning("spaCy is not installed; fallback to rule-based extraction")
        return None

    for model_name in ("xx_ent_wiki_sm", "en_core_web_sm"):
        try:
            _NLP = spacy.load(model_name)
            logger.info("Loaded spaCy model for graph extraction: %s", model_name)
            return _NLP
        except Exception:
            continue

    logger.warning(
        "No spaCy model found (tried xx_ent_wiki_sm, en_core_web_sm); fallback to rule-based extraction"
    )
    return None


class GraphContextService:
    def __init__(self, repo: GraphKnowledgeRepository):
        self._repo = repo
        self._chunking_service = get_chunking_service(
            chunk_size=1200,
            overlap_size=100,
        )

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

        chunks, entity_to_chunks = self._chunking_service.chunk_and_map_entities(
            content,
            entities,
            chunk_id_prefix=f"msg_{message_id}",
        )

        for chunk in chunks:
            graph.chunks[chunk.id] = chunk.text

        message_chunk_ids = [chunk.id for chunk in chunks]
        if message_chunk_ids:
            message_node.chunk_ids = _merge_unique(message_node.chunk_ids, message_chunk_ids)
        
        for entity in entities:
            entity_key = f"{entity.get('type', 'entity')}:{entity.get('value', '').lower()}"
            chunk_ids = list(dict.fromkeys(entity_to_chunks.get(entity_key, [])))
            
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
                    chunk_ids=chunk_ids,
                ),
            )
            node.chunk_ids = _merge_unique(node.chunk_ids, chunk_ids)
            self._upsert_edge(
                graph,
                GraphEdge(
                    id=f"mentions:{message_node.id}->{node.id}",
                    src=message_node.id,
                    dst=node.id,
                    relation="mentions",
                    weight=0.55,
                    source_message_ids=[message_id],
                    chunk_ids=chunk_ids,
                ),
            )

        relations = self._extract_relations(content, effective_config)
        for rel in relations:
            src_id = _canonical_node_id(rel["src_type"], rel["src"])
            dst_id = _canonical_node_id(rel["dst_type"], rel["dst"])
            src_key = f"{rel['src_type']}:{rel['src'].lower()}"
            dst_key = f"{rel['dst_type']}:{rel['dst'].lower()}"
            rel_chunks = _merge_unique(
                list(dict.fromkeys(entity_to_chunks.get(src_key, []))),
                list(dict.fromkeys(entity_to_chunks.get(dst_key, []))),
            )
            
            src_node = self._upsert_node(
                graph,
                GraphNode(
                    id=src_id,
                    type=rel["src_type"],
                    value=rel["src"],
                    source_message_ids=[message_id],
                    confidence=0.6,
                    salience_score=0.6,
                    chunk_ids=rel_chunks,
                ),
            )
            src_node.chunk_ids = _merge_unique(src_node.chunk_ids, rel_chunks)
            dst_node = self._upsert_node(
                graph,
                GraphNode(
                    id=dst_id,
                    type=rel["dst_type"],
                    value=rel["dst"],
                    source_message_ids=[message_id],
                    confidence=0.6,
                    salience_score=0.6,
                    chunk_ids=rel_chunks,
                ),
            )
            dst_node.chunk_ids = _merge_unique(dst_node.chunk_ids, rel_chunks)
            edge = self._upsert_edge(
                graph,
                GraphEdge(
                    id=f"{rel['relation']}:{src_node.id}->{dst_node.id}",
                    src=src_node.id,
                    dst=dst_node.id,
                    relation=rel["relation"],
                    weight=0.7,
                    source_message_ids=[message_id],
                    chunk_ids=rel_chunks,
                ),
            )
            edge.chunk_ids = _merge_unique(edge.chunk_ids, rel_chunks)

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

    def reset_conversation(self, *, conversation_id: str) -> None:
        """Drop graph knowledge for a conversation so a restart starts from a clean context."""
        self._repo.delete(conversation_id)

    def get_graph_snapshot(self, *, conversation_id: str) -> dict[str, object]:
        graph = self._repo.get(conversation_id)
        if not graph:
            return {
                "conversation_id": conversation_id,
                "version": 1,
                "schema_version": 1,
                "last_message_index": 0,
                "config": asdict(GraphContextConfig().normalized()),
                "nodes": [],
                "edges": [],
                "chunks": {},
                "message_ids": [],
                "updated_at": None,
            }

        return {
            "conversation_id": graph.conversation_id,
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

    def build_graph_context(
        self,
        *,
        conversation_id: str,
        query: str,
        config: GraphContextConfig | None = None,
    ) -> GraphContextPack:
        graph = self._repo.get(conversation_id)
        if not graph:
            logger.info(
                "Graph context build snapshot | conversation_id=%s | graph=empty | query=%s",
                conversation_id,
                query,
            )
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
            seeds = {
                nid: lexical.get(nid, 0.0) * 0.5 + embedding.get(nid, 0.0) * 0.5
                for nid in set(lexical) | set(embedding)
            }

        pagerank_scores = self._pagerank_scores(graph, seeds)
        ranked_entity_nodes = [
            node_id
            for node_id, _ in sorted(pagerank_scores.items(), key=lambda item: item[1], reverse=True)
            if graph.nodes.get(node_id) and graph.nodes[node_id].type == "entity"
        ]
        node_ids = _unique_preserve_order(ranked_entity_nodes)[:10]
        edge_ids = _unique_preserve_order(self._related_edges(graph, node_ids, 10))

        lines: list[str] = []
        seen_relation_lines: set[str] = set()
        for edge_id in edge_ids:
            edge = graph.edges.get(edge_id)
            if not edge:
                continue
            src_node = graph.nodes.get(edge.src)
            dst_node = graph.nodes.get(edge.dst)
            if not src_node or not dst_node:
                continue
            if src_node.type != "entity" or dst_node.type != "entity":
                continue
            relation_name = (edge.relation or "unknown").strip() or "unknown"
            relation_line = f"{src_node.value} -> {relation_name} -> {dst_node.value}"
            if relation_line in seen_relation_lines:
                continue
            seen_relation_lines.add(relation_line)
            lines.append(relation_line)

        if not lines:
            logger.info(
                "Graph context build snapshot | conversation_id=%s | method=%s | graph=%s",
                conversation_id,
                effective_config.retrieve_method,
                json.dumps(asdict(graph), ensure_ascii=False),
            )
            return GraphContextPack(
                text="",
                node_ids=[],
                edge_ids=[],
                chunk_ids=[],
                method="pagerank",
            )

        chunk_signature_to_id: dict[str, str] = {}
        chunk_signature_to_text: dict[str, str] = {}
        chunk_signature_to_nodes: dict[str, set[str]] = {}
        chunk_signatures_ordered: list[str] = []
        for node_id in node_ids:
            node = graph.nodes.get(node_id)
            if not node:
                continue
            for chunk_id in node.chunk_ids:
                chunk_content = graph.chunks.get(chunk_id, "")
                if not chunk_content.strip():
                    continue
                signature = _normalize_chunk_text(chunk_content)
                if signature not in chunk_signature_to_id:
                    chunk_signature_to_id[signature] = chunk_id
                    chunk_signature_to_text[signature] = chunk_content.strip()
                    chunk_signatures_ordered.append(signature)
                chunk_signature_to_nodes.setdefault(signature, set()).add(node.value)

        chunk_lines: list[str] = []
        chunk_ids: list[str] = []
        for signature in chunk_signatures_ordered:
            if len(chunk_ids) >= 10:
                break
            chunk_id = chunk_signature_to_id.get(signature, "")
            chunk_content = chunk_signature_to_text.get(signature, "")
            if not chunk_id or not chunk_content:
                continue
            node_names = sorted(chunk_signature_to_nodes.get(signature, set()))
            if not node_names:
                continue
            chunk_ids.append(chunk_id)
            chunk_lines.append(f"{', '.join(node_names)}: {chunk_content}")

        context_text = "Graph knowledge context:\n" + "\n".join(lines)
        if chunk_lines:
            context_text += "\n" + "\n".join(chunk_lines)
        logger.info(
            "Graph context build snapshot | conversation_id=%s | method=%s | selected_nodes=%s | selected_edges=%s | chunks=%s",
            conversation_id,
            "pagerank",
            node_ids,
            edge_ids,
            chunk_ids,
        )
        return GraphContextPack(
            text=context_text,
            node_ids=node_ids,
            edge_ids=edge_ids,
            chunk_ids=chunk_ids,
            method="pagerank",
        )

    def _extract_entities(self, content: str, config: GraphContextConfig) -> list[dict[str, object]]:
        content = _sanitize_graph_text(content)
        if not content:
            return []

        entities: list[dict[str, object]] = []
        nlp = _get_nlp_pipeline()

        if nlp is not None:
            try:
                doc = nlp(content)
                for ent in doc.ents:
                    value = ent.text.strip()
                    if len(value) < 3:
                        continue
                    if _is_generic_entity(value):
                        continue
                    entities.append(
                        {
                            "type": "entity",
                            "value": value,
                            "confidence": 0.82,
                            "salience": 0.72,
                        }
                    )
            except Exception:
                logger.exception("spaCy entity extraction failed; using fallback")

        tokens = _tokenize(content)
        ranked = sorted(
            {t: tokens.count(t) for t in set(tokens)}.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        if config.entity_method in {"keyword", "hybrid"}:
            for token, freq in ranked[:6]:
                entities.append(
                    {
                        "type": "entity",
                        "value": token,
                        "confidence": min(0.95, 0.45 + 0.1 * freq),
                        "salience": min(1.0, 0.4 + 0.08 * freq),
                    }
                )

        if config.entity_method in {"capitalized", "hybrid"}:
            for phrase in re.findall(r"\b(?:[A-Z][a-zA-Z0-9_]{1,}(?:\s+[A-Z][a-zA-Z0-9_]{1,})+)\b", content):
                value = phrase.strip()
                if _is_generic_entity(value):
                    continue
                entities.append(
                    {
                        "type": "entity",
                        "value": value,
                        "confidence": 0.76,
                        "salience": 0.7,
                    }
                )
            for cap in re.findall(r"\b[A-Z][a-zA-Z0-9_]{2,}\b", content):
                if _is_generic_entity(cap):
                    continue
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
        content = _sanitize_graph_text(content)
        if not content:
            return []

        relations: list[dict[str, str]] = []
        nlp = _get_nlp_pipeline()
        if nlp is not None:
            try:
                doc = nlp(content)
                verb_objects: dict[int, str] = {}
                for token in doc:
                    if token.dep_ in {"dobj", "obj", "attr"} and token.head.pos_ == "VERB":
                        verb_objects[token.head.i] = token.text.strip()

                for token in doc:
                    if token.dep_ in {"nsubj", "nsubjpass"} and token.head.pos_ == "VERB":
                        src = token.text.strip()
                        dst = verb_objects.get(token.head.i)
                        relation = "unknown"
                        if not dst or len(src) < 3 or len(dst) < 3:
                            continue
                        relations.append(
                            {
                                "src": src,
                                "dst": dst,
                                "src_type": "entity",
                                "dst_type": "entity",
                                "relation": relation,
                            }
                        )
            except Exception:
                logger.exception("spaCy relation extraction failed; using fallback")

        if config.relation_method == "pattern":
            patterns = [
                (r"([\wÀ-ỹ][\wÀ-ỹ\s\-]{1,})\s+là\s+([\wÀ-ỹ][\wÀ-ỹ\s\-]{1,})\s+của\s+([\wÀ-ỹ][\wÀ-ỹ\s\-]{1,})", "vi_is_of"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+is\s+([A-Za-z0-9_\-\s]{3,})", "about"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+needs\s+([A-Za-z0-9_\-\s]{3,})", "depends_on"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+cần\s+([A-Za-z0-9_\-\s]{3,})", "depends_on"),
            ]
            for regex, relation in patterns:
                for match in re.finditer(regex, content, flags=re.IGNORECASE):
                    if relation == "vi_is_of" and len(match.groups()) == 3:
                        left = re.sub(r"\s+", " ", match.group(1).strip())
                        role = re.sub(r"\s+", " ", match.group(2).strip())
                        right = re.sub(r"\s+", " ", match.group(3).strip())
                        if len(left) < 2 or len(role) < 2 or len(right) < 2:
                            continue
                        relations.append(
                            {
                                "src": left,
                                "dst": right,
                                "src_type": "entity",
                                "dst_type": "entity",
                                "relation": "unknown",
                            }
                        )
                        continue

                    left = re.sub(r"\s+", " ", match.group(1).strip())
                    right = re.sub(r"\s+", " ", match.group(2).strip())
                    if len(left) < 3 or len(right) < 3:
                        continue
                    relations.append(
                        {
                            "src": left,
                            "dst": right,
                            "src_type": "entity",
                            "dst_type": "entity",
                            "relation": "unknown",
                        }
                    )
            if not relations:
                tokens = _tokenize(content)
                for i in range(min(len(tokens) - 1, 6)):
                    relations.append(
                        {
                            "src": tokens[i],
                            "dst": tokens[i + 1],
                            "src_type": "entity",
                            "dst_type": "entity",
                            "relation": "unknown",
                        }
                    )
        else:
            tokens = _tokenize(content)
            for i in range(min(len(tokens) - 1, 6)):
                relations.append(
                    {
                        "src": tokens[i],
                        "dst": tokens[i + 1],
                        "src_type": "entity",
                        "dst_type": "entity",
                        "relation": "unknown",
                    }
                )
        return relations

    def _pagerank_scores(
        self,
        graph: ConversationKnowledgeGraph,
        seeds: dict[str, float],
        *,
        damping: float = 0.85,
        iterations: int = 20,
    ) -> dict[str, float]:
        node_ids = list(graph.nodes.keys())
        if not node_ids:
            return {}

        n = len(node_ids)
        adjacency: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
        for edge in graph.edges.values():
            if edge.src in adjacency and edge.dst in adjacency:
                adjacency[edge.src].add(edge.dst)
                adjacency[edge.dst].add(edge.src)

        seed_values = {node_id: max(0.0, seeds.get(node_id, 0.0)) for node_id in node_ids}
        total_seed = sum(seed_values.values())
        if total_seed > 0:
            personalization = {node_id: seed_values[node_id] / total_seed for node_id in node_ids}
        else:
            uniform = 1.0 / float(n)
            personalization = {node_id: uniform for node_id in node_ids}

        scores = dict(personalization)
        for _ in range(iterations):
            next_scores = {node_id: (1.0 - damping) * personalization[node_id] for node_id in node_ids}
            for node_id in node_ids:
                neighbors = adjacency[node_id]
                if not neighbors:
                    share = damping * scores[node_id] / float(n)
                    for target in node_ids:
                        next_scores[target] += share
                    continue
                share = damping * scores[node_id] / float(len(neighbors))
                for target in neighbors:
                    next_scores[target] += share
            scores = next_scores

        return scores

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
            and graph.nodes.get(edge.src)
            and graph.nodes.get(edge.dst)
            and graph.nodes[edge.src].type == "entity"
            and graph.nodes[edge.dst].type == "entity"
        ]
        candidates.sort(key=lambda edge: edge.weight, reverse=True)
        return [edge.id for edge in candidates[:top_k_edges]]
