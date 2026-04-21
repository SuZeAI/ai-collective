from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.api.settings import settings
from backend.application.service.agent_service import AgentService
from backend.application.service.agent_graph_service import AgentGraphService
from backend.application.service.activity_feed_service import ActivityFeedService
from backend.application.service.analytics_service import AnalyticsService
from backend.application.service.conversation_service import ConversationService
from backend.application.service.graph_context_service import GraphContextService
from backend.application.service.llm_service import LLMService
from backend.application.service.simulation_service import SimulationService
from backend.application.service.task_service import TaskService
from backend.application.service.team_service import TeamService
from backend.application.service.skill_service import SkillService
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.domain.agent.langgraph_orchestrator import LangGraphAgentOrchestrator
from backend.domain.agent.langgraph_mesh import MultiAgentMeshOrchestrator
from backend.domain.agent.langgraph_ring import LangGraphRingOrchestrator
from backend.domain.agent.langgraph_supervisor import LangGraphSupervisorOrchestrator
from backend.infrastructure.llm.factory import create_llm_provider
from backend.infrastructure.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonAgentRepository,
    JsonAnalyticsRepository,
    JsonConversationRepository,
    JsonSkillRepository,
    JsonTaskRepository,
    JsonTeamRepository,
)
from backend.infrastructure.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from backend.infrastructure.repositories.json_store import JsonFileStore
from backend.log import get_logger


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STORAGE_DIR = PROJECT_ROOT / "storage"


@lru_cache
def _repos():
    agents = JsonAgentRepository(JsonFileStore(STORAGE_DIR / "agents.json"))
    skills = JsonSkillRepository(JsonFileStore(STORAGE_DIR / "skills.json"))
    teams = JsonTeamRepository(JsonFileStore(STORAGE_DIR / "teams.json"))
    tasks = JsonTaskRepository(JsonFileStore(STORAGE_DIR / "tasks.json"))
    conversations = JsonConversationRepository(JsonFileStore(STORAGE_DIR / "conversations.json"))
    analytics = JsonAnalyticsRepository(JsonFileStore(STORAGE_DIR / "analytics.json"))
    activity_feed = JsonActivityFeedRepository(JsonFileStore(STORAGE_DIR / "activity_feed.json"))
    graph_knowledge = JsonGraphKnowledgeRepository(
        JsonFileStore(STORAGE_DIR / "graph_knowledge.json"),
        JsonFileStore(STORAGE_DIR / "graph_knowledge_events.json"),
    )
    return agents, skills, teams, tasks, conversations, analytics, activity_feed, graph_knowledge


def get_agent_service() -> AgentService:
    agents, skills, _, _, _, _, _, _ = _repos()
    return AgentService(agents, skills)


def get_skill_service() -> SkillService:
    _, skills, _, _, _, _, _, _ = _repos()
    return SkillService(skills)


def get_team_service() -> TeamService:
    _, _, teams, _, _, _, _, _ = _repos()
    return TeamService(teams)


def get_task_service() -> TaskService:
    _, _, _, tasks, _, _, _, _ = _repos()
    return TaskService(tasks)


def get_conversation_service() -> ConversationService:
    _, _, _, _, conversations, _, _, graph_knowledge = _repos()
    return ConversationService(conversations, GraphContextService(graph_knowledge))


def get_analytics_service() -> AnalyticsService:
    _, _, _, tasks, _, analytics, _, _ = _repos()
    return AnalyticsService(analytics, tasks)


def get_activity_feed_service() -> ActivityFeedService:
    _, _, _, _, _, _, feed, _ = _repos()
    return ActivityFeedService(feed)


def get_graph_context_service() -> GraphContextService:
    _, _, _, _, _, _, _, graph_knowledge = _repos()
    return GraphContextService(graph_knowledge)


def get_skill_tool_manager() -> SkillToolManager:
    """Get SkillToolManager for binding tools to skills during agent initialization."""
    return SkillToolManager()


@lru_cache
def _llm_provider():
    return create_llm_provider(
        provider=settings.llm_provider,
        model=settings.llm_model,
        google_api_key=settings.google_api_key,
        anthropic_api_key=settings.anthropic_api_key,
        openai_api_key=settings.openai_api_key,
        open_weight_api_key=settings.open_weight_api_key,
        base_url=settings.llm_api_base,
    )


def get_simulation_service() -> SimulationService:
    return SimulationService(_llm_provider())


def get_llm_service() -> LLMService | None:
    provider = _llm_provider()
    if not provider:
        return None
    return LLMService(provider)


def get_agent_graph_service(mode: str = "sequential") -> AgentGraphService | None:
    provider = _llm_provider()
    if not provider:
        return None
    if mode == "mesh":
        orchestrator = MultiAgentMeshOrchestrator()
    elif mode == "ring":
        orchestrator = LangGraphRingOrchestrator()
    elif mode == "supervisor":
        orchestrator = LangGraphSupervisorOrchestrator()
    else:
        orchestrator = LangGraphAgentOrchestrator()
    get_logger().info(f"{orchestrator.__class__.__name__} selected for mode='{mode}'")
    return AgentGraphService(provider, orchestrator)
