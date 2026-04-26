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
from backend.infrastructure.lock_provider import create_lock_provider
from backend.infrastructure.llm.factory import create_llm_provider
from backend.infrastructure.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonAgentRepository,
    JsonAnalyticsRepository,
    JsonConversationRepository,
    JsonSkillRepository,
    JsonTaskRepository,
    JsonTeamRepository,
    JsonWorkspaceRepository,
)
from backend.application.service.workspace_service import WorkspaceService
from backend.infrastructure.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from backend.infrastructure.repositories.json_store import JsonFileStore
from backend.infrastructure import task_queue as _task_queue_module
from backend.log import get_logger


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STORAGE_DIR = Path(settings.storage_dir) if settings.storage_dir else PROJECT_ROOT / "storage"


@lru_cache
def _lock_provider():
    """Singleton lock provider — initialised once from settings."""
    return create_lock_provider(
        backend=settings.lock_backend,
        redis_url=settings.redis_url,
    )


def _store(filename: str) -> JsonFileStore:
    """Create a JsonFileStore with the configured lock provider."""
    return JsonFileStore(STORAGE_DIR / filename, lock_provider=_lock_provider())


@lru_cache
def _init_task_queue():
    """Initialise and register the configured task queue singleton."""
    from backend.infrastructure.task_queue import create_task_queue, _set_queue
    q = create_task_queue(
        backend=settings.task_queue_backend,
        max_concurrent=settings.task_queue_max_concurrent,
        rabbitmq_url=settings.rabbitmq_url,
    )
    _set_queue(q)
    return q


@lru_cache
def _repos():
    _init_task_queue()  # ensure task queue is configured before first request
    agents = JsonAgentRepository(_store("agents.json"))
    skills = JsonSkillRepository(_store("skills.json"))
    teams = JsonTeamRepository(_store("teams.json"))
    tasks = JsonTaskRepository(_store("tasks.json"))
    conversations = JsonConversationRepository(_store("conversations.json"))
    analytics = JsonAnalyticsRepository(_store("analytics.json"))
    activity_feed = JsonActivityFeedRepository(_store("activity_feed.json"))
    graph_knowledge = JsonGraphKnowledgeRepository(
        _store("graph_knowledge.json"),
        _store("graph_knowledge_events.json"),
    )
    workspaces = JsonWorkspaceRepository(_store("workspaces.json"))
    return agents, skills, teams, tasks, conversations, analytics, activity_feed, graph_knowledge, workspaces


def get_agent_service() -> AgentService:
    agents, skills, _, _, _, _, _, _, _ = _repos()
    return AgentService(agents, skills)


def get_skill_service() -> SkillService:
    _, skills, _, _, _, _, _, _, _ = _repos()
    return SkillService(skills)


def get_team_service() -> TeamService:
    _, _, teams, _, _, _, _, _, _ = _repos()
    return TeamService(teams)


def get_task_service() -> TaskService:
    _, _, _, tasks, _, _, _, _, _ = _repos()
    return TaskService(tasks)


def get_conversation_service() -> ConversationService:
    _, _, _, _, conversations, _, _, graph_knowledge, _ = _repos()
    return ConversationService(conversations, GraphContextService(graph_knowledge))


def get_analytics_service() -> AnalyticsService:
    _, _, _, tasks, _, analytics, _, _, _ = _repos()
    return AnalyticsService(analytics, tasks)


def get_activity_feed_service() -> ActivityFeedService:
    _, _, _, _, _, _, feed, _, _ = _repos()
    return ActivityFeedService(feed)


def get_graph_context_service() -> GraphContextService:
    _, _, _, _, _, _, _, graph_knowledge, _ = _repos()
    return GraphContextService(graph_knowledge)


def get_workspace_service() -> WorkspaceService:
    _, _, _, _, _, _, _, _, workspaces = _repos()
    return WorkspaceService(workspaces)


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
    orchestrator = (
        MultiAgentMeshOrchestrator() if mode == "mesh"
        else LangGraphAgentOrchestrator()
    )
    get_logger().info(f"{orchestrator.__class__.__name__} selected for mode='{mode}'")
    return AgentGraphService(provider, orchestrator)
