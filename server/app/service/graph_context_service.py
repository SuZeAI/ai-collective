from __future__ import annotations

import logging
import re
import json
from dataclasses import asdict
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from server.app.ports.repositories import GraphKnowledgeRepository
from server.app.service.graph_extraction import LLMGraphExtractor, StaticGraphExtractor
from server.app.service.graph_retrieval import (
    pagerank_scores,
    related_edges,
    retrieve_embedding,
    retrieve_lexical,
)
from server.domain.memory.knowledge_graph import (
    MeetingKnowledgeGraph,
    GraphContextConfig,
    GraphContextPack,
    GraphEdge,
    GraphNode,
)
from server.app.service.chunking_service import get_chunking_service
from server.share.log import get_logger

if TYPE_CHECKING:
    from server.app.ports.llm import LLMProvider


logger = get_logger(__name__)


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


def _canonical_node_id(node_type: str, value: str) -> str:
    key = re.sub(r"\s+", " ", value.strip().lower())
    return f"{node_type}:{key}"


class GraphContextService:
    def __init__(
        self,
        repo: GraphKnowledgeRepository,
        *,
        llm_provider: "LLMProvider | None" = None,
        build_mode: str = "static",
    ):
        self._repo = repo
        self._build_mode = build_mode  # "static" | "llm"
        self._static_extractor = StaticGraphExtractor()
        self._llm_extractor = LLMGraphExtractor(llm_provider) if llm_provider else None
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
        graph = self._repo.get(conversation_id) or MeetingKnowledgeGraph(
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

        entities = self._extract_entities_dispatch(content, effective_config)

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

        relations = self._extract_relations_dispatch(content, effective_config)
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

    def _rag_block(self, conversation_id: str, query: str, graph, exclude_texts: set[str]) -> str:
        """RAG 'additional information' block (bm25 / qdrant / neo4j / hybrid).

        Best-effort and additive; never raises into context assembly.
        """
        try:
            from server.infra import rag_retrieval_store

            return rag_retrieval_store.retrieve_block(
                conversation_id, query, graph, exclude_texts=exclude_texts
            )
        except Exception:  # noqa: BLE001
            return ""

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
            # Do not log the raw query (user content / PII) at INFO; only IDs.
            logger.info(
                "Graph context build snapshot | conversation_id=%s | graph=empty | query_len=%d",
                conversation_id,
                len(query or ""),
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
            seeds = retrieve_lexical(graph, query, effective_config)
        elif effective_config.retrieve_method == "embedding":
            seeds = retrieve_embedding(graph, query, effective_config)
        else:
            lexical = retrieve_lexical(graph, query, effective_config)
            embedding = retrieve_embedding(graph, query, effective_config)
            seeds = {
                nid: lexical.get(nid, 0.0) * 0.5 + embedding.get(nid, 0.0) * 0.5
                for nid in set(lexical) | set(embedding)
            }

        pagerank_result = pagerank_scores(graph, seeds)
        ranked_entity_nodes = [
            node_id
            for node_id, _ in sorted(pagerank_result.items(), key=lambda item: item[1], reverse=True)
            if graph.nodes.get(node_id) and graph.nodes[node_id].type == "entity"
        ]
        node_ids = _unique_preserve_order(ranked_entity_nodes)[:10]
        edge_ids = _unique_preserve_order(related_edges(graph, node_ids, 10))

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
            # Log only counts, never the full graph (contains verbatim message text).
            logger.info(
                "Graph context build snapshot | conversation_id=%s | method=%s | nodes=%d | edges=%d | no_relations",
                conversation_id,
                effective_config.retrieve_method,
                len(graph.nodes),
                len(graph.edges),
            )
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "Full graph dump | conversation_id=%s | graph=%s",
                    conversation_id,
                    json.dumps(asdict(graph), ensure_ascii=False),
                )
            # Even with no entity relations, RAG retrieval can still surface
            # relevant chunks as additional information.
            rag_block = self._rag_block(conversation_id, query, graph, set())
            return GraphContextPack(
                text=rag_block,
                node_ids=[],
                edge_ids=[],
                chunk_ids=[],
                method=f"rag:{'hit' if rag_block else 'empty'}",
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
        # Append RAG "additional information", excluding chunks already shown
        # above so it adds genuinely new context (never duplicates).
        already_shown = {
            _normalize_chunk_text(graph.chunks.get(cid, "")) for cid in chunk_ids
        }
        rag_block = self._rag_block(conversation_id, query, graph, already_shown)
        if rag_block:
            context_text += "\n\n" + rag_block
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

    # ------------------------------------------------------------------
    # Dispatch helpers: route to LLM or static pipeline
    # ------------------------------------------------------------------

    def _extract_entities_dispatch(
        self, content: str, config: GraphContextConfig
    ) -> list[dict[str, object]]:
        """Route entity extraction to LLM or static pipeline based on build_mode."""
        if self._build_mode == "llm" and self._llm_extractor is not None:
            try:
                return self._llm_extractor.extract_entities(content)
            except Exception:
                logger.exception(
                    "LLM entity extraction failed; falling back to static pipeline"
                )
        return self._static_extractor.extract_entities(content, config)

    def _extract_relations_dispatch(
        self, content: str, config: GraphContextConfig
    ) -> list[dict[str, str]]:
        """Route relation extraction to LLM or static pipeline based on build_mode."""
        if self._build_mode == "llm" and self._llm_extractor is not None:
            try:
                return self._llm_extractor.extract_relations(content)
            except Exception:
                logger.exception(
                    "LLM relation extraction failed; falling back to static pipeline"
                )
        return self._static_extractor.extract_relations(content, config)

    def _upsert_node(self, graph: MeetingKnowledgeGraph, candidate: GraphNode) -> GraphNode:
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

    def _upsert_edge(self, graph: MeetingKnowledgeGraph, candidate: GraphEdge) -> GraphEdge:
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
