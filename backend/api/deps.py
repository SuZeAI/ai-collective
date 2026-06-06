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
from backend.domain.agent.langgraph_ring import LangGraphRingOrchestrator
from backend.domain.agent.langgraph_supervisor import LangGraphSupervisorOrchestrator
from backend.domain.agent.langgraph_tree import LangGraphTreeOrchestrator
from backend.infrastructure.llm.factory import create_llm_provider
from backend.infrastructure.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonAgentRepository,
    JsonAnalyticsRepository,
    JsonConnectionRepository,
    JsonConversationRepository,
    JsonOfficeBuilderSessionRepository,
    JsonSkillRepository,
    JsonTaskRepository,
    JsonTeamRepository,
    JsonWorkspaceRepository,
)
from backend.application.service.workspace_service import WorkspaceService
from backend.application.service.connection_service import ConnectionService
from backend.application.service.office_builder_session_service import OfficeBuilderSessionService
from backend.application.service.user_service import UserService
from backend.infrastructure.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from backend.infrastructure.repositories.json_files import JsonUserRepository
from backend.infrastructure.repositories.json_store import JsonFileStore
from backend.infrastructure.repositories.mongo_repositories import (
    MongoActivityFeedRepository,
    MongoAgentRepository,
    MongoAnalyticsRepository,
    MongoConnectionRepository,
    MongoConversationRepository,
    MongoGraphKnowledgeRepository,
    MongoOfficeBuilderSessionRepository,
    MongoSkillRepository,
    MongoTaskRepository,
    MongoTeamRepository,
    MongoUserRepository,
    MongoWorkspaceRepository,
)
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
    _init_task_queue()
    if settings.storage_backend == "mongo":
        import pymongo
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        agents = MongoAgentRepository(db)
        skills = MongoSkillRepository(db)
        teams = MongoTeamRepository(db)
        tasks = MongoTaskRepository(db)
        conversations = MongoConversationRepository(db)
        analytics = MongoAnalyticsRepository(db)
        activity_feed = MongoActivityFeedRepository(db)
        graph_knowledge = MongoGraphKnowledgeRepository(db)
        workspaces = MongoWorkspaceRepository(db)
        connections = MongoConnectionRepository(db)
    else:
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
        workspaces = JsonWorkspaceRepository(JsonFileStore(STORAGE_DIR / "workspaces.json"))
        connections = JsonConnectionRepository(JsonFileStore(STORAGE_DIR / "connections.json"))
    return agents, skills, teams, tasks, conversations, analytics, activity_feed, graph_knowledge, workspaces, connections


def get_agent_service() -> AgentService:
    agents, skills, _, _, _, _, _, _, _, _ = _repos()
    return AgentService(agents, skills)


def get_skill_service() -> SkillService:
    _, skills, _, _, _, _, _, _, _, _ = _repos()
    return SkillService(skills)


def get_team_service() -> TeamService:
    _, _, teams, _, _, _, _, _, _, _ = _repos()
    return TeamService(teams)


def get_task_service() -> TaskService:
    _, _, _, tasks, _, _, _, _, _, _ = _repos()
    return TaskService(tasks)


def get_conversation_service() -> ConversationService:
    _, _, _, _, conversations, _, _, graph_knowledge, _, _ = _repos()
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = create_llm_provider(
            provider=settings.graph_llm_provider or settings.llm_provider,
            model=settings.graph_llm_model or settings.llm_model,
            google_api_key=settings.google_api_key,
            anthropic_api_key=settings.anthropic_api_key,
            openai_api_key=settings.openai_api_key,
            open_weight_api_key=settings.open_weight_api_key,
            base_url=settings.llm_api_base,
        )
    return ConversationService(
        conversations,
        GraphContextService(
            graph_knowledge,
            llm_provider=graph_llm,
            build_mode=settings.graph_build_mode,
        ),
    )


def get_analytics_service() -> AnalyticsService:
    _, _, _, tasks, _, analytics, _, _, _, _ = _repos()
    return AnalyticsService(analytics, tasks)


def get_activity_feed_service() -> ActivityFeedService:
    _, _, _, _, _, _, feed, _, _, _ = _repos()
    return ActivityFeedService(feed)


def get_graph_context_service() -> GraphContextService:
    _, _, _, _, _, _, _, graph_knowledge, _, _ = _repos()
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = create_llm_provider(
            provider=settings.graph_llm_provider or settings.llm_provider,
            model=settings.graph_llm_model or settings.llm_model,
            google_api_key=settings.google_api_key,
            anthropic_api_key=settings.anthropic_api_key,
            openai_api_key=settings.openai_api_key,
            open_weight_api_key=settings.open_weight_api_key,
            base_url=settings.llm_api_base,
        )
    return GraphContextService(
        graph_knowledge,
        llm_provider=graph_llm,
        build_mode=settings.graph_build_mode,
    )


def get_workspace_service() -> WorkspaceService:
    _, _, _, _, _, _, _, _, workspaces, _ = _repos()
    return WorkspaceService(workspaces)


def get_connection_service() -> ConnectionService:
    _, _, _, _, _, _, _, _, _, connections = _repos()
    return ConnectionService(connections)


@lru_cache
def _office_builder_session_store():
    if settings.storage_backend == "mongo":
        import pymongo
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoOfficeBuilderSessionRepository(db)
    return JsonOfficeBuilderSessionRepository(_store("office_builder_sessions.json"))


def get_office_builder_session_service() -> OfficeBuilderSessionService:
    return OfficeBuilderSessionService(_office_builder_session_store())


@lru_cache
def _user_store():
    if settings.storage_backend == "mongo":
        import pymongo
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoUserRepository(db)
    return JsonUserRepository(_store("users.json"))


def get_user_service() -> UserService:
    return UserService(_user_store())


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
        max_tool_rounds=settings.agent_max_tool_rounds,
        tool_timeout_seconds=settings.tool_timeout_seconds,
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
    elif mode == "tree":
        orchestrator = LangGraphTreeOrchestrator()
    else:
        orchestrator = LangGraphAgentOrchestrator()
    get_logger().info(f"{orchestrator.__class__.__name__} selected for mode='{mode}'")
    return AgentGraphService(provider, orchestrator)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

# Real implementation — defined here so the import is available.
# Usage in routers:
#   from backend.api.deps import current_user_dep
#   @router.get("") def endpoint(user = Depends(current_user_dep)): ...
def _make_current_user_dep():
    from fastapi import Depends, Header, HTTPException, status

    def dep(
        authorization: str | None = Header(default=None, alias="Authorization"),
        user_service: UserService = Depends(get_user_service),
    ):
        import jwt as _jwt
        from backend.api.security import decode_access_token
        from backend.domain.errors import NotFoundError

        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = authorization.split(" ", 1)[1]
        try:
            payload = decode_access_token(token)
            user_id: str = payload.get("sub", "")
        except _jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except _jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            return user_service.find_by_id(user_id)
        except NotFoundError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return dep


current_user_dep = _make_current_user_dep()


# Optional-auth owner resolution: identifies which "owner scope" a request
# belongs to. Valid Bearer token → that user's id; no token (guest mode in the
# frontend sends none) → the shared GUEST_OWNER_ID scope. A token that is
# present but expired/invalid is rejected so stale sessions don't silently
# read another scope's data.
def _make_current_owner_id_dep():
    from fastapi import Header, HTTPException, status

    def dep(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> str:
        import jwt as _jwt
        from backend.api.security import decode_access_token
        from backend.domain.models import GUEST_OWNER_ID

        if not authorization or not authorization.startswith("Bearer "):
            return GUEST_OWNER_ID
        token = authorization.split(" ", 1)[1]
        try:
            payload = decode_access_token(token)
        except _jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except _jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return str(payload.get("sub", "")) or GUEST_OWNER_ID

    return dep


current_owner_id_dep = _make_current_owner_id_dep()
