from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from backend.application.ports.llm import LLMProvider


@dataclass(frozen=True, slots=True)
class GraphAgentDefinition:
    name: str
    role: str
    system_prompt: str


@dataclass(frozen=True, slots=True)
class GraphTurn:
    turn: int
    agent_name: str
    agent_role: str
    content: str


@dataclass(frozen=True, slots=True)
class GraphRunResult:
    turns: list[GraphTurn]
    final_response: str
    final_agent: str | None
    rounds: int


class AgentGraphOrchestrator(Protocol):
    async def run(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
    ) -> GraphRunResult:
        ...

    async def run_stream(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
    ):
        """Streaming version that yields GraphTurn events as agents process"""
        ...
