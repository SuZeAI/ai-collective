from __future__ import annotations

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    CustomGraphSpec,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
)
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.application.ports.llm import LLMProvider


def _backup_workspace(conversation_id: str | None) -> None:
    """Best-effort: mirror agent-written files up to S3 at run-end (s3 mode only)."""
    if not conversation_id:
        return
    try:
        from backend.infrastructure.llm.sandbox_middleware import (
            backup_conversation_workspace,
        )

        backup_conversation_workspace(conversation_id)
    except Exception:  # noqa: BLE001 - never let backup wiring break a run
        pass


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
        custom_graph: CustomGraphSpec | None = None,
    ) -> GraphRunResult:
        if not user_input.strip():
            raise ValueError("user_input must not be empty")
        if not definitions:
            raise ValueError("At least one agent definition is required")
        try:
            return await self._orchestrator.run(
                user_input=user_input,
                agents=definitions,
                llm=self._llm,
                max_rounds=max(1, max_rounds),
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
                custom_graph=custom_graph,
            )
        finally:
            _backup_workspace(conversation_id)

    async def run_stream_with_definitions(
        self,
        *,
        user_input: str,
        definitions: list[GraphAgentDefinition],
        max_rounds: int = 6,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph: CustomGraphSpec | None = None,
    ):
        """Stream agent responses as they are generated"""
        if not user_input.strip():
            raise ValueError("user_input must not be empty")
        if not definitions:
            raise ValueError("At least one agent definition is required")
        try:
            async for turn in self._orchestrator.run_stream(
                user_input=user_input,
                agents=definitions,
                llm=self._llm,
                max_rounds=max(1, max_rounds),
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
                custom_graph=custom_graph,
            ):
                yield turn
        finally:
            _backup_workspace(conversation_id)
