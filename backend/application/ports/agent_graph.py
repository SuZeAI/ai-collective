from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

from backend.domain.memory.knowledge_graph import GraphContextConfig, GraphContextPack
from backend.application.ports.llm import LLMProvider
from backend.domain.tools.base import BaseToolkit


@dataclass(frozen=True, slots=True)
class GraphAgentDefinition:
    name: str
    role: str
    system_prompt: str
    description: str = ""
    routing_guidance: str = ""
    skill_ids: list[str] | None = None
    tools: dict[str, BaseToolkit] | None = None  # Bound tools by skill_id
    subagent_enabled: bool = False


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


@dataclass(frozen=True, slots=True)
class CustomGraphSpec:
    """A user-drawn directed graph over agent NAMES (not ids).

    edges: (source_name, target_name) pairs. entry: explicit start nodes; when
    empty the orchestrator infers roots (nodes with no incoming edge).
    """

    edges: tuple[tuple[str, str], ...]
    entry: tuple[str, ...] = ()


class GraphContextProvider(Protocol):
    def ingest_message(
        self,
        *,
        conversation_id: str,
        message_id: str,
        speaker: str,
        content: str,
        config: GraphContextConfig | None = None,
    ) -> None:
        ...

    def build_graph_context(
        self,
        *,
        conversation_id: str,
        query: str,
        config: GraphContextConfig | None = None,
    ) -> GraphContextPack:
        ...


class AgentGraphOrchestrator(Protocol):
    async def run(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph: CustomGraphSpec | None = None,
    ) -> GraphRunResult:
        ...

    async def run_stream(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph: CustomGraphSpec | None = None,
    ):
        """Streaming version that yields GraphTurn events as agents process"""
        ...
