from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from backend.application.ports.agent_graph import GraphRunResult


class GraphRunRequest(BaseModel):
    user_input: str = Field(min_length=1)
    max_rounds: int = Field(default=6, ge=1, le=20)
    agents: list[str] = Field(min_length=1)
    mode: Literal["mesh", "sequential"] = Field(default="sequential")

    @model_validator(mode="after")
    def validate_unique_agent_ids(self) -> "GraphRunRequest":
        if len(self.agents) != len(set(self.agents)):
            raise ValueError("Agent IDs must be unique")
        return self


class GraphTurnSchema(BaseModel):
    turn: int
    agent_name: str
    agent_role: str
    content: str


class GraphRunResponse(BaseModel):
    rounds: int
    final_agent: str | None = None
    final_response: str
    turns: list[GraphTurnSchema]

    @staticmethod
    def from_result(result: GraphRunResult) -> "GraphRunResponse":
        return GraphRunResponse(
            rounds=result.rounds,
            final_agent=result.final_agent,
            final_response=result.final_response,
            turns=[
                GraphTurnSchema(
                    turn=t.turn,
                    agent_name=t.agent_name,
                    agent_role=t.agent_role,
                    content=t.content,
                )
                for t in result.turns
            ],
        )
