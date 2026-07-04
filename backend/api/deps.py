from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

from backend.api.settings import settings
from backend.application.ports.repositories import (
    ActivityFeedRepository,
    AgentRepository,
    AnalyticsRepository,
    ConnectionRepository,
    ConversationRepository,
    GraphKnowledgeRepository,
    SkillRepository,
    TaskRepository,
    TeamRepository,
    WorkspaceRepository,
)
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
from backend.application.service.marketplace_service import MarketplaceService
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.domain.agent.langgraph_orchestrator import LangGraphAgentOrchestrator
from backend.domain.agent.langgraph_mesh import MultiAgentMeshOrchestrator
from backend.infrastructure.lock_provider import create_lock_provider
from backend.domain.agent.langgraph_ring import LangGraphRingOrchestrator
from backend.domain.agent.langgraph_supervisor import LangGraphSupervisorOrchestrator
from backend.domain.agent.langgraph_tree import LangGraphTreeOrchestrator
from backend.domain.agent.langgraph_custom import LangGraphCustomOrchestrator
from backend.infrastructure.llm.factory import create_llm_provider
from backend.infrastructure.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonAgentRepository,
    JsonAnalyticsRepository,
    JsonConnectionRepository,
    JsonConversationRepository,
    JsonModelPricingRepository,
    JsonOfficeBuilderSessionRepository,
    JsonSkillRepository,
    JsonTaskRepository,
    JsonTeamRepository,
    JsonTokenUsageRepository,
    JsonWorkspaceRepository,
)
from backend.application.service.workspace_service import WorkspaceService
from backend.application.service.connection_service import ConnectionService
from backend.application.service.office_builder_session_service import OfficeBuilderSessionService
from backend.application.service.user_service import UserService
from backend.infrastructure.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from backend.infrastructure.repositories.json_files import JsonUserRepository
from backend.infrastructure.repositories.json_store import JsonFileStore
from backend.infrastructure.security import BcryptPasswordHasher
from backend.infrastructure.repositories.mongo_repositories import (
    MongoActivityFeedRepository,
    MongoAgentRepository,
    MongoAnalyticsRepository,
    MongoConnectionRepository,
    MongoConversationRepository,
    MongoGraphKnowledgeRepository,
    MongoModelPricingRepository,
    MongoOfficeBuilderSessionRepository,
    MongoSkillRepository,
    MongoTaskRepository,
    MongoTeamRepository,
    MongoTokenUsageRepository,
    MongoUserRepository,
    MongoWorkspaceRepository,
)
from backend.infrastructure import task_queue as _task_queue_module
from backend.log import get_logger


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _resolve_dir(value: str | None, default: Path) -> Path:
    """Resolve a configured dir to an absolute path.

    Relative values are resolved against the project root (not the process
    CWD), so the app behaves the same no matter where it is launched from.
    """
    if not value:
        return default
    p = Path(value)
    return p if p.is_absolute() else PROJECT_ROOT / p


# Live database: where the app reads/writes runtime JSON data. Per-machine and
# gitignored — defaults to <project_root>/local_database.
STORAGE_DIR = _resolve_dir(settings.storage_dir, PROJECT_ROOT / "local_database")

# Seed source: the bundled default catalog committed to git. Read-only — it is
# the source the startup seed copies defaults FROM, never the live store.
# Configured via SEED_DIR (settings.seed_dir); defaults to <project_root>/storage.
SEED_DIR = _resolve_dir(settings.seed_dir, PROJECT_ROOT / "storage")


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


class Repos(NamedTuple):
    """Named bundle of repo singletons — access by field, not position, so
    adding/reordering a repo can't silently swap two unrelated getters."""
    agents: AgentRepository
    skills: SkillRepository
    teams: TeamRepository
    tasks: TaskRepository
    conversations: ConversationRepository
    analytics: AnalyticsRepository
    activity_feed: ActivityFeedRepository
    graph_knowledge: GraphKnowledgeRepository
    workspaces: WorkspaceRepository
    connections: ConnectionRepository


@lru_cache
def _repos() -> Repos:
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
        connections = JsonConnectionRepository(_store("connections.json"))

    # Optional Neo4j knowledge-graph backend (overrides the STORAGE_BACKEND repo
    # above). Falls back to that repo if the driver/server is unavailable so the
    # app always boots.
    if settings.graph.backend.strip().lower() == "neo4j" and settings.graph.neo4j_uri:
        try:
            from backend.infrastructure.repositories.neo4j_graph_knowledge import (
                Neo4jGraphKnowledgeRepository,
            )

            graph_knowledge = Neo4jGraphKnowledgeRepository(
                uri=settings.graph.neo4j_uri,
                user=settings.graph.neo4j_user,
                password=settings.graph.neo4j_password,
                database=settings.graph.neo4j_database,
            )
            get_logger().info("Knowledge graph backend: Neo4j (%s)", settings.graph.neo4j_uri)
        except Exception:  # noqa: BLE001 — degrade to the storage-backend repo
            get_logger().warning(
                "Neo4j graph backend unavailable; using %s repo", settings.storage_backend,
                exc_info=True,
            )

    return Repos(
        agents=agents,
        skills=skills,
        teams=teams,
        tasks=tasks,
        conversations=conversations,
        analytics=analytics,
        activity_feed=activity_feed,
        graph_knowledge=graph_knowledge,
        workspaces=workspaces,
        connections=connections,
    )


def get_agent_service() -> AgentService:
    repos = _repos()
    return AgentService(repos.agents, repos.skills)


def get_skill_service() -> SkillService:
    return SkillService(_repos().skills)


def get_team_service() -> TeamService:
    return TeamService(_repos().teams)


def get_task_service() -> TaskService:
    return TaskService(_repos().tasks)


def get_marketplace_service() -> MarketplaceService:
    repos = _repos()
    return MarketplaceService(
        AgentService(repos.agents, repos.skills),
        SkillService(repos.skills),
        TeamService(repos.teams),
        TaskService(repos.tasks),
        get_document_library_service(),
    )


def get_conversation_service() -> ConversationService:
    repos = _repos()
    conversations, graph_knowledge = repos.conversations, repos.graph_knowledge
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = create_llm_provider(
            provider=settings.graph_llm_provider or settings.llm_provider,
            model=settings.graph_llm_model or settings.llm_model,
            google_api_key=settings.google_api_keys(),
            anthropic_api_key=settings.anthropic_api_keys(),
            openai_api_key=settings.openai_api_keys(),
            open_weight_api_key=settings.open_weight_api_keys(),
            kimi_api_key=settings.kimi_api_keys(),
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
    repos = _repos()
    return AnalyticsService(repos.analytics, repos.tasks)


def get_activity_feed_service() -> ActivityFeedService:
    return ActivityFeedService(_repos().activity_feed)


def get_graph_context_service() -> GraphContextService:
    graph_knowledge = _repos().graph_knowledge
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = create_llm_provider(
            provider=settings.graph_llm_provider or settings.llm_provider,
            model=settings.graph_llm_model or settings.llm_model,
            google_api_key=settings.google_api_keys(),
            anthropic_api_key=settings.anthropic_api_keys(),
            openai_api_key=settings.openai_api_keys(),
            open_weight_api_key=settings.open_weight_api_keys(),
            kimi_api_key=settings.kimi_api_keys(),
            base_url=settings.llm_api_base,
        )
    return GraphContextService(
        graph_knowledge,
        llm_provider=graph_llm,
        build_mode=settings.graph_build_mode,
    )


def get_workspace_service() -> WorkspaceService:
    return WorkspaceService(_repos().workspaces)


def get_connection_service() -> ConnectionService:
    return ConnectionService(_repos().connections)


@lru_cache
def _library_document_store():
    if settings.storage_backend == "mongo":
        import pymongo
        from backend.infrastructure.repositories.mongo_repositories.library_documents import (
            MongoLibraryDocumentRepository,
        )
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoLibraryDocumentRepository(db)
    from backend.infrastructure.repositories.json_files.library_documents import (
        JsonLibraryDocumentRepository,
    )
    return JsonLibraryDocumentRepository(_store("library_documents.json"))


def get_document_library_service() -> "DocumentLibraryService":
    from backend.application.service.document_library_service import DocumentLibraryService

    return DocumentLibraryService(_library_document_store())


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


@lru_cache
def _password_hasher() -> BcryptPasswordHasher:
    return BcryptPasswordHasher()


def get_user_service() -> UserService:
    return UserService(_user_store(), _password_hasher())


@lru_cache
def _project_store():
    if settings.storage_backend == "mongo":
        import pymongo
        from backend.infrastructure.repositories.mongo_repositories import MongoProjectRepository
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoProjectRepository(db)
    from backend.infrastructure.repositories.json_files import JsonProjectRepository
    return JsonProjectRepository(_store("projects.json"))


def get_project_service() -> "ProjectService":
    from backend.application.service.project_service import ProjectService
    return ProjectService(_project_store())


@lru_cache
def _epic_store():
    if settings.storage_backend == "mongo":
        import pymongo
        from backend.infrastructure.repositories.mongo_repositories import MongoEpicRepository
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoEpicRepository(db)
    from backend.infrastructure.repositories.json_files import JsonEpicRepository
    return JsonEpicRepository(_store("epics.json"))


def get_epic_service() -> "EpicService":
    from backend.application.service.epic_service import EpicService
    return EpicService(_epic_store())


@lru_cache
def _sprint_store():
    if settings.storage_backend == "mongo":
        import pymongo
        from backend.infrastructure.repositories.mongo_repositories import MongoSprintRepository
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoSprintRepository(db)
    from backend.infrastructure.repositories.json_files import JsonSprintRepository
    return JsonSprintRepository(_store("sprints.json"))


def get_sprint_service() -> "SprintService":
    from backend.application.service.sprint_service import SprintService
    return SprintService(_sprint_store())


def seed_admin_user() -> None:
    """Create/sync the bootstrap admin account from env on startup.

    Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME straight from the
    environment and writes the account into the configured users store (the
    Mongo `users` collection, or users.json). Idempotent and resilient — a
    failure here is logged but never blocks the app from starting.
    """
    if not settings.admin.auto_seed:
        return

    email = (settings.admin.email or "").strip()
    password = settings.admin.password or ""
    name = (settings.admin.name or "Administrator").strip()

    if not email or not password:
        get_logger().info(
            "Admin auto-seed skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in .env to enable it"
        )
        return

    try:
        user, action = get_user_service().ensure_admin(email=email, password=password, name=name)
        if action == "unchanged":
            get_logger().info(f"Admin account already in sync: {user.email}")
        else:
            get_logger().info(f"Admin account {action} from env: {user.email} (id={user.id})")
    except Exception as exc:  # never block startup on a seeding error
        get_logger().error(f"Admin auto-seed failed: {exc}")


# Bundled default catalog shipped in storage/*.json (committed to git), keyed by
# the Mongo collection it feeds. Only these are auto-imported on startup.
# Order matters: agents/skills/teams are seeded before tasks so a seeded task's
# referenced team and agents already exist in the live store.
_DEFAULT_DATA_FILES = (
    ("agents", "agents.json"),
    ("skills", "skills.json"),
    ("teams", "teams.json"),
    ("tasks", "tasks.json"),
)


def _load_seed_records(filename: str) -> list[dict]:
    """Read a default-catalog file from the committed seed dir (storage/)."""
    import json

    path = SEED_DIR / filename
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def seed_default_data() -> None:
    """Seed the bundled default agents/skills/teams/tasks into the live DB on startup.

    The committed catalog lives in the seed dir (``storage/``); the live data
    lives in the local database (Mongo, or JSON files under ``local_database/``).
    This copies any default entity that is missing from the live DB so a fresh
    clone comes up with the starter catalog — without ever touching the seed
    files or clobbering entities already present in the live DB.
    """
    if not settings.seed.default_data:
        return

    try:
        from backend.domain.models import DEFAULT_OWNER_ID

        total_inserted = 0

        if settings.storage_backend == "mongo":
            import pymongo

            db = pymongo.MongoClient(settings.mongo_uri)[settings.mongo_db]
            for collection, filename in _DEFAULT_DATA_FILES:
                inserted = 0
                for rec in _load_seed_records(filename):
                    doc_id = rec.get("id")
                    if not doc_id:
                        continue
                    if db[collection].find_one({"_id": doc_id}, {"_id": 1}) is not None:
                        continue  # already in the live DB — leave it untouched
                    doc = dict(rec)
                    doc["_id"] = doc_id
                    doc.setdefault("owner_id", DEFAULT_OWNER_ID)
                    db[collection].insert_one(doc)
                    inserted += 1
                if inserted:
                    get_logger().info(f"Seeded {inserted} default {collection} into Mongo")
                total_inserted += inserted
        else:
            # JSON mode: live store is local_database/*.json (≠ the seed dir).
            for collection, filename in _DEFAULT_DATA_FILES:
                seed_records = _load_seed_records(filename)
                if not seed_records:
                    continue
                store = _store(filename)
                live = store.read()
                if not isinstance(live, list):
                    live = []
                existing_ids = {r.get("id") for r in live if isinstance(r, dict)}
                added = 0
                for rec in seed_records:
                    doc_id = rec.get("id")
                    if not doc_id or doc_id in existing_ids:
                        continue
                    rec = dict(rec)
                    rec.setdefault("owner_id", DEFAULT_OWNER_ID)
                    live.append(rec)
                    existing_ids.add(doc_id)
                    added += 1
                if added:
                    store.write(live)
                    get_logger().info(
                        f"Seeded {added} default {collection} into {STORAGE_DIR.name}/{filename}"
                    )
                total_inserted += added

        if total_inserted == 0:
            get_logger().info("Default catalog already present — nothing to seed")
    except Exception as exc:  # never block startup on a seeding error
        get_logger().error(f"Default data seed failed: {exc}")


def get_skill_tool_manager() -> SkillToolManager:
    """Get SkillToolManager for binding tools to skills during agent initialization."""
    return SkillToolManager()


@lru_cache
def _monitoring_stores():
    """(TokenUsageRepository, ModelPricingRepository) for the configured backend."""
    if settings.storage_backend == "mongo":
        import pymongo
        client = pymongo.MongoClient(settings.mongo_uri)
        db = client[settings.mongo_db]
        return MongoTokenUsageRepository(db), MongoModelPricingRepository(db)
    return (
        JsonTokenUsageRepository(_store("token_usage.json")),
        JsonModelPricingRepository(_store("model_pricing.json")),
    )


@lru_cache
def init_usage_tracking() -> bool:
    """Register the global LLM usage recorder against the configured store.

    Called from create_app() and lazily wherever an LLM provider is built, so
    token usage is persisted no matter which entry point fires first.
    """
    import uuid
    from datetime import datetime, timezone

    from backend.domain.models import TokenUsageRecord
    from backend.infrastructure.llm.usage_tracker import set_usage_recorder

    usage_repo, _ = _monitoring_stores()

    def _record(
        *,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: str,
        agent_name: str = "",
        team_id: str = "",
    ) -> None:
        usage_repo.add(
            TokenUsageRecord(
                id=str(uuid.uuid4()),
                provider=provider,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                user_id=user_id or "system",
                timestamp=datetime.now(timezone.utc),
                agent_name=agent_name or "",
                team_id=team_id or "",
            )
        )

    set_usage_recorder(_record)
    return True


def get_monitoring_service():
    from backend.application.service.monitoring_service import MonitoringService

    init_usage_tracking()
    usage_repo, pricing_repo = _monitoring_stores()
    repos = _repos()
    return MonitoringService(
        usage=usage_repo,
        pricing=pricing_repo,
        users=_user_store(),
        agents=repos.agents,
        teams=repos.teams,
        tasks=repos.tasks,
        workspaces=repos.workspaces,
    )


@lru_cache
def _llm_provider():
    init_usage_tracking()
    return create_llm_provider(
        provider=settings.llm_provider,
        model=settings.llm_model,
        google_api_key=settings.google_api_keys(),
        anthropic_api_key=settings.anthropic_api_keys(),
        openai_api_key=settings.openai_api_keys(),
        open_weight_api_key=settings.open_weight_api_keys(),
        kimi_api_key=settings.kimi_api_keys(),
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
    elif mode == "custom":
        orchestrator = LangGraphCustomOrchestrator()
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
# frontend sends none) → the shared GUEST_OWNER_ID scope. Users with the
# "admin" (or legacy "system") role act in the shared DEFAULT_OWNER_ID scope:
# everything they create is shared with everyone and they may delete shared
# items. A token that is present but expired/invalid is rejected so stale
# sessions don't silently read another scope's data.
def _make_current_owner_id_dep():
    from fastapi import Depends, Header, HTTPException, status

    def dep(
        authorization: str | None = Header(default=None, alias="Authorization"),
        user_service: UserService = Depends(get_user_service),
    ) -> str:
        import jwt as _jwt
        from backend.api.security import decode_access_token
        from backend.domain.models import DEFAULT_OWNER_ID, GUEST_OWNER_ID

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
        user_id = str(payload.get("sub", ""))
        if not user_id:
            return GUEST_OWNER_ID
        try:
            user = user_service.find_by_id(user_id)
        except Exception:
            return user_id
        if getattr(user, "role", "") in ("admin", "system"):
            return DEFAULT_OWNER_ID
        return user_id

    return dep


current_owner_id_dep = _make_current_owner_id_dep()
