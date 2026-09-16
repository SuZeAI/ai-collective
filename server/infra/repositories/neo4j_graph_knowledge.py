"""Neo4j-backed knowledge-graph repository.

Implements ``GraphKnowledgeRepository`` (get/upsert/delete/append_event). Two
representations are kept per meeting:

1. A lossless JSON blob on a ``(:Meeting {id})`` node — the authoritative
   source for ``get()`` so reconstruction is exact (same shape the JSON/Mongo
   repos use).
2. A native projection — each entity as an ``(:Entity)`` node and each relation
   as a ``[:RELATES]`` relationship — so the graph is browsable/queryable in
   Neo4j directly.

Best-effort and optional: the ``neo4j`` driver and a reachable server are only
required when ``GRAPH_DB_BACKEND=neo4j``; the factory in ``deps`` falls back to
the STORAGE_BACKEND repo if construction fails.
"""

from __future__ import annotations

import json
from dataclasses import asdict

from server.domain.memory.knowledge_graph import (
    MeetingKnowledgeGraph,
    GraphContextConfig,
    GraphEdge,
    GraphNode,
)
from server.share.log import get_logger

logger = get_logger(__name__)


def _serialize(graph: MeetingKnowledgeGraph) -> dict:
    return {
        "meeting_id": graph.meeting_id,
        "version": graph.version,
        "schema_version": graph.schema_version,
        "last_message_index": graph.last_message_index,
        "config": asdict(graph.config),
        "nodes": [asdict(n) for n in graph.nodes.values()],
        "edges": [asdict(e) for e in graph.edges.values()],
        "chunks": graph.chunks,
        "message_ids": list(graph.message_ids),
        "updated_at": graph.updated_at,
    }


def _deserialize(meeting_id: str, raw: dict) -> MeetingKnowledgeGraph:
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
    chunks = raw.get("chunks")
    if isinstance(chunks, dict):
        graph.chunks = {str(k): str(v) for k, v in chunks.items()}
    for raw_node in raw.get("nodes") or []:
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
    for raw_edge in raw.get("edges") or []:
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


class Neo4jGraphKnowledgeRepository:
    def __init__(self, *, uri: str, user: str, password: str | None, database: str = "neo4j") -> None:
        from neo4j import GraphDatabase  # raises if not installed → factory catches

        self._driver = GraphDatabase.driver(uri, auth=(user, password or ""))
        self._database = database
        # Fail fast so the factory can fall back when the server is unreachable.
        self._driver.verify_connectivity()
        with self._driver.session(database=self._database) as s:
            s.run("CREATE CONSTRAINT meeting_id IF NOT EXISTS FOR (c:Meeting) REQUIRE c.id IS UNIQUE")

    def get(self, meeting_id: str) -> MeetingKnowledgeGraph | None:
        try:
            with self._driver.session(database=self._database) as s:
                rec = s.run(
                    "MATCH (c:Meeting {id: $id}) RETURN c.data AS data",
                    id=meeting_id,
                ).single()
        except Exception:  # noqa: BLE001
            logger.exception("Neo4j get failed for %s", meeting_id)
            return None
        if not rec or not rec.get("data"):
            return None
        try:
            return _deserialize(meeting_id, json.loads(rec["data"]))
        except Exception:  # noqa: BLE001
            logger.exception("Neo4j graph deserialize failed for %s", meeting_id)
            return None

    def upsert(self, graph: MeetingKnowledgeGraph) -> MeetingKnowledgeGraph:
        cid = graph.meeting_id
        blob = json.dumps(_serialize(graph), ensure_ascii=False)
        try:
            with self._driver.session(database=self._database) as s:
                s.execute_write(self._write_graph, cid, blob, graph)
        except Exception:  # noqa: BLE001 — persistence is best-effort
            logger.exception("Neo4j upsert failed for %s", cid)
        return graph

    @staticmethod
    def _write_graph(tx, cid: str, blob: str, graph: MeetingKnowledgeGraph) -> None:
        # Authoritative blob + reset the native projection for this conversation.
        tx.run("MERGE (c:Meeting {id: $id}) SET c.data = $data", id=cid, data=blob)
        tx.run("MATCH (e:Entity {meeting_id: $id}) DETACH DELETE e", id=cid)
        nodes = [
            {"key": f"{cid}:{n.id}", "id": n.id, "value": n.value, "type": n.type,
             "salience": n.salience_score}
            for n in graph.nodes.values()
        ]
        if nodes:
            tx.run(
                """
                UNWIND $nodes AS n
                MERGE (e:Entity {key: n.key})
                SET e.meeting_id = $id, e.node_id = n.id, e.value = n.value,
                    e.type = n.type, e.salience = n.salience
                """,
                nodes=nodes, id=cid,
            )
        edges = [
            {"src": f"{cid}:{e.src}", "dst": f"{cid}:{e.dst}", "relation": e.relation,
             "weight": e.weight, "id": e.id}
            for e in graph.edges.values()
        ]
        if edges:
            tx.run(
                """
                UNWIND $edges AS r
                MATCH (a:Entity {key: r.src}), (b:Entity {key: r.dst})
                MERGE (a)-[rel:RELATES {id: r.id}]->(b)
                SET rel.relation = r.relation, rel.weight = r.weight
                """,
                edges=edges,
            )

    def delete(self, meeting_id: str) -> None:
        try:
            with self._driver.session(database=self._database) as s:
                s.run("MATCH (e:Entity {meeting_id: $id}) DETACH DELETE e", id=meeting_id)
                s.run("MATCH (c:Meeting {id: $id}) DETACH DELETE c", id=meeting_id)
        except Exception:  # noqa: BLE001
            logger.exception("Neo4j delete failed for %s", meeting_id)

    def append_event(self, meeting_id: str, event: dict[str, object]) -> None:
        try:
            with self._driver.session(database=self._database) as s:
                s.run(
                    """
                    MERGE (c:Meeting {id: $id})
                    CREATE (c)-[:HAS_EVENT]->(:GraphEvent {data: $data})
                    """,
                    id=meeting_id, data=json.dumps(event, ensure_ascii=False, default=str),
                )
        except Exception:  # noqa: BLE001
            logger.exception("Neo4j append_event failed for %s", meeting_id)
