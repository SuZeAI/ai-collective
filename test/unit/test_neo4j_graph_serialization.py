"""Round-trip tests for the Neo4j graph serializer (no server required).

The live ``Neo4jGraphKnowledgeRepository`` needs the ``neo4j`` driver + a server;
the (de)serialization that guarantees lossless ``get()`` is pure and always tested.
"""

from __future__ import annotations

from server.domain.memory.knowledge_graph import (
    MeetingKnowledgeGraph,
    GraphEdge,
    GraphNode,
)
from server.infra.repositories.neo4j_graph_knowledge import _deserialize, _serialize


def _graph() -> MeetingKnowledgeGraph:
    g = MeetingKnowledgeGraph(conversation_id="conv1", last_message_index=3)
    g.nodes["n1"] = GraphNode(id="n1", type="entity", value="Acme Corp", salience_score=0.8)
    g.nodes["n2"] = GraphNode(id="n2", type="entity", value="Project X", salience_score=0.6)
    g.edges["e1"] = GraphEdge(id="e1", src="n1", dst="n2", relation="owns", weight=0.9)
    g.chunks["c1"] = "Acme Corp owns Project X."
    g.message_ids = ["m1", "m2"]
    return g


def test_serialize_deserialize_roundtrip():
    g = _graph()
    blob = _serialize(g)
    restored = _deserialize("conv1", blob)

    assert restored.conversation_id == "conv1"
    assert restored.last_message_index == 3
    assert set(restored.nodes) == {"n1", "n2"}
    assert restored.nodes["n1"].value == "Acme Corp"
    assert restored.nodes["n1"].salience_score == 0.8
    assert restored.edges["e1"].relation == "owns"
    assert restored.edges["e1"].weight == 0.9
    assert restored.chunks["c1"] == "Acme Corp owns Project X."
    assert restored.message_ids == ["m1", "m2"]
