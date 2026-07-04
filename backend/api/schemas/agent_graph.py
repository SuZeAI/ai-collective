from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from backend.application.ports.agent_graph import GraphRunResult


class CustomGraphEdge(BaseModel):
    source: str = Field(min_length=1)  # agent id
    target: str = Field(min_length=1)  # agent id


class CustomGraphSchema(BaseModel):
    """User-drawn directed graph for mode == "custom".

    Node ids equal agent ids (one node per agent). Edges define routing; a node
    with several outgoing edges fans out (runs successors in parallel), several
    incoming edges fan in (merge), and a cycle loops until max_rounds.
    """

    edges: list[CustomGraphEdge] = Field(default_factory=list)
    entry: list[str] | None = None  # agent ids to start at; None => infer roots


class GraphRunRequest(BaseModel):
    user_input: str = Field(min_length=1)
    max_rounds: int = Field(default=6, ge=1, le=20)
    agents: list[str] = Field(min_length=1)
    mode: Literal["mesh", "sequential", "ring", "supervisor", "tree", "custom"] = Field(default="sequential")
    conversation_id: str | None = Field(default=None, min_length=1)
    # Department/team this run belongs to; used to attribute token spend per team
    # on the cost-monitoring page. Optional — left blank for ad-hoc runs.
    team_id: str | None = Field(default=None, min_length=1)
    graph_config: "GraphConfigSchema | None" = None
    custom_graph: "CustomGraphSchema | None" = None

    @model_validator(mode="after")
    def validate_unique_agent_ids(self) -> "GraphRunRequest":
        if len(self.agents) != len(set(self.agents)):
            raise ValueError("Agent IDs must be unique")
        return self

    @model_validator(mode="after")
    def validate_custom_graph(self) -> "GraphRunRequest":
        if self.mode != "custom":
            return self
        if self.custom_graph is None:
            raise ValueError("custom_graph is required when mode is 'custom'")
        agent_set = set(self.agents)
        for edge in self.custom_graph.edges:
            if edge.source not in agent_set or edge.target not in agent_set:
                raise ValueError("custom_graph edges must reference agents in the agents list")
        for node_id in self.custom_graph.entry or []:
            if node_id not in agent_set:
                raise ValueError("custom_graph entry must reference agents in the agents list")
        return self


class GraphTurnSchema(BaseModel):
    turn: int
    agent_id: str
    agent_name: str
    agent_role: str
    content: str


class GraphRunResponse(BaseModel):
    rounds: int
    final_agent: str | None = None
    final_response: str
    turns: list[GraphTurnSchema]
    error: str | None = None

    @staticmethod
    def from_result(result: GraphRunResult) -> "GraphRunResponse":
        return GraphRunResponse(
            rounds=result.rounds,
            final_agent=result.final_agent,
            final_response=result.final_response,
            error=result.error,
            turns=[
                GraphTurnSchema(
                    turn=t.turn,
                    agent_id=t.agent_name,
                    agent_name=t.agent_name,
                    agent_role=t.agent_role,
                    content=t.content,
                )
                for t in result.turns
            ],
        )


class GraphConfigSchema(BaseModel):
    build_method: Literal["rule", "embedding", "ie"] = "rule"
    entity_method: Literal["keyword", "capitalized", "hybrid"] = "hybrid"
    relation_method: Literal["pattern", "cooccurrence", "dependency"] = "pattern"
    retrieve_method: Literal["lexical", "embedding", "hybrid"] = "hybrid"
    expand_hops: int = Field(default=1, ge=1, le=3)
    top_k_nodes: int = Field(default=10, ge=3, le=30)
    top_k_edges: int = Field(default=12, ge=3, le=50)
    min_score_threshold: float = Field(default=0.05, ge=0.0, le=1.0)
    recency_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    similarity_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    edge_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    persist_mode: Literal["snapshot", "snapshot_plus_log"] = "snapshot_plus_log"


GraphRunRequest.model_rebuild()
