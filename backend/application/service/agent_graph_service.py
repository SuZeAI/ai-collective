from __future__ import annotations

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
)
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.application.ports.llm import LLMProvider


class AgentGraphService:
    def __init__(self, llm: LLMProvider, orchestrator: AgentGraphOrchestrator):
        self._llm = llm
        self._orchestrator = orchestrator

    async def run_with_definitions(
        self,
        *,
        user_input: str,
        definitions: list[GraphAgentDefinition],
        max_rounds: int = 6,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ) -> GraphRunResult:
        if not user_input.strip():
            raise ValueError("user_input must not be empty")
        if not definitions:
            raise ValueError("At least one agent definition is required")
        return await self._orchestrator.run(
            user_input=user_input,
            agents=definitions,
            llm=self._llm,
            max_rounds=max(1, max_rounds),
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        )

    async def run_stream_with_definitions(
        self,
        *,
        user_input: str,
        definitions: list[GraphAgentDefinition],
        max_rounds: int = 6,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ):
        """Stream agent responses as they are generated"""
        if not user_input.strip():
            raise ValueError("user_input must not be empty")
        if not definitions:
            raise ValueError("At least one agent definition is required")
        async for turn in self._orchestrator.run_stream(
            user_input=user_input,
            agents=definitions,
            llm=self._llm,
            max_rounds=max(1, max_rounds),
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        ):
            yield turn
