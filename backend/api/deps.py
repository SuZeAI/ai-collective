from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.api.settings import settings
from backend.application.service.agent_service import AgentService
from backend.application.service.agent_graph_service import AgentGraphService
from backend.application.service.activity_feed_service import ActivityFeedService
from backend.application.service.analytics_service import AnalyticsService
from backend.application.service.conversation_service import ConversationService
from backend.application.service.llm_service import LLMService
from backend.application.service.simulation_service import SimulationService
from backend.application.service.task_service import TaskService
from backend.application.service.team_service import TeamService
from backend.application.service.skill_service import SkillService
from backend.infrastructure.llm.gemini_langchain import GeminiLangChainProvider
from backend.application.logic.langgraph_orchestrator import LangGraphAgentOrchestrator
from backend.application.logic.langgraph_mesh import MultiAgentMeshOrchestrator
from backend.infrastructure.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonAgentRepository,
    JsonAnalyticsRepository,
    JsonConversationRepository,
    JsonSkillRepository,
    JsonTaskRepository,
    JsonTeamRepository,
)
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
    return agents, skills, teams, tasks, conversations, analytics, activity_feed


def get_agent_service() -> AgentService:
    agents, skills, _, _, _, _, _ = _repos()
    return AgentService(agents, skills)


def get_skill_service() -> SkillService:
    _, skills, _, _, _, _, _ = _repos()
    return SkillService(skills)


def get_team_service() -> TeamService:
    _, _, teams, _, _, _, _ = _repos()
    return TeamService(teams)


def get_task_service() -> TaskService:
    _, _, _, tasks, _, _, _ = _repos()
    return TaskService(tasks)


def get_conversation_service() -> ConversationService:
    _, _, _, _, conversations, _, _ = _repos()
    return ConversationService(conversations)


def get_analytics_service() -> AnalyticsService:
    _, _, _, tasks, _, analytics, _ = _repos()
    return AnalyticsService(analytics, tasks)


def get_activity_feed_service() -> ActivityFeedService:
    _, _, _, _, _, _, feed = _repos()
    return ActivityFeedService(feed)


@lru_cache
def _llm_provider():
    # Prefer dedicated GEMINI_API_KEY, but allow GOOGLE_API_KEY.
    if settings.gemini_api_key:
        import os

        os.environ.setdefault("GEMINI_API_KEY", settings.gemini_api_key)
    api_key = settings.gemini_api_key
    if not api_key:
        # May still be present in env.
        import os

        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    return GeminiLangChainProvider(model=settings.gemini_api_model)


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
