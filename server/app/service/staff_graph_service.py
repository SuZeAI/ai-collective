from __future__ import annotations

from server.app.ports.staff_graph import (
    StaffGraphOrchestrator,
    CustomGraphSpec,
    GraphStaffDefinition,
    GraphContextProvider,
    GraphRunResult,
)
from server.domain.memory.knowledge_graph import GraphContextConfig
from server.app.ports.llm import LLMProvider


def _backup_workspace(conversation_id: str | None) -> None:
    """Best-effort: mirror staff-written files up to S3 at run-end (s3 mode only)."""
    if not conversation_id:
        return
    try:
        from server.infra.llm.sandbox_middleware import (
            backup_conversation_workspace,
        )

        backup_conversation_workspace(conversation_id)
    except Exception:  # noqa: BLE001 - never let backup wiring break a run
        pass


class StaffGraphService:
    def __init__(self, llm: LLMProvider, orchestrator: StaffGraphOrchestrator):
        self._llm = llm
        self._orchestrator = orchestrator

    async def run_with_definitions(
        self,
        *,
        user_input: str,
        definitions: list[GraphStaffDefinition],
        max_rounds: int = 6,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph: CustomGraphSpec | None = None,
    ) -> GraphRunResult:
        if not user_input.strip():
            raise ValueError("user_input must not be empty")
        if not definitions:
            raise ValueError("At least one staff definition is required")
        try:
            return await self._orchestrator.run(
                user_input=user_input,
                staff=definitions,
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
        definitions: list[GraphStaffDefinition],
        max_rounds: int = 6,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph: CustomGraphSpec | None = None,
    ):
        """Stream staff responses as they are generated"""
        if not user_input.strip():
            raise ValueError("user_input must not be empty")
        if not definitions:
            raise ValueError("At least one staff definition is required")
        try:
            async for turn in self._orchestrator.run_stream(
                user_input=user_input,
                staff=definitions,
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
