from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, NamedTuple

if TYPE_CHECKING:
    from server.app.service.document_library_service import DocumentLibraryService
    from server.app.service.project_service import ProjectService
    from server.app.service.epic_service import EpicService
    from server.app.service.sprint_service import SprintService

from server.api.settings import settings
from server.app.ports.repositories import (
    ActivityFeedRepository,
    AnalyticsRepository,
    ConnectionRepository,
    GraphKnowledgeRepository,
    MeetingRepository,
    SkillRepository,
    StaffRepository,
    TaskRepository,
    DepartmentRepository,
    CompanyRepository,
)
from server.app.service.staff_service import StaffService
from server.app.service.staff_graph_service import StaffGraphService
from server.app.service.activity_feed_service import ActivityFeedService
from server.app.service.analytics_service import AnalyticsService
from server.app.service.meeting_service import MeetingService
from server.app.service.graph_context_service import GraphContextService
from server.app.service.llm_service import LLMService
from server.app.service.simulation_service import SimulationService
from server.app.service.task_service import TaskService
from server.app.service.department_service import DepartmentService
from server.app.service.skill_service import SkillService
from server.app.service.recruiting_service import RecruitingService
from server.domain.service.skill_tool_service import SkillToolManager
from server.domain.staff.langgraph_orchestrator import LangGraphStaffOrchestrator
from server.domain.staff.langgraph_mesh import MultiAgentMeshOrchestrator
from server.infra.lock_provider import get_shared_lock_provider
from server.domain.staff.langgraph_ring import LangGraphRingOrchestrator
from server.domain.staff.langgraph_supervisor import LangGraphSupervisorOrchestrator
from server.domain.staff.langgraph_tree import LangGraphTreeOrchestrator
from server.domain.staff.langgraph_custom import LangGraphCustomOrchestrator
from server.infra.llm.config import get_enabled_models, get_model_config
from server.infra.llm.factory import build_default_llm_provider
from server.infra.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonStaffRepository,
    JsonAnalyticsRepository,
    JsonConnectionRepository,
    JsonMeetingRepository,
    JsonModelPricingRepository,
    JsonOfficeBuilderSessionRepository,
    JsonSkillRepository,
    JsonSystemSettingsRepository,
    JsonTaskRepository,
    JsonDepartmentRepository,
    JsonTokenUsageRepository,
    JsonCompanyRepository,
)
from server.app.service.company_service import CompanyService
from server.app.service.connection_service import ConnectionService
from server.app.service.office_builder_session_service import OfficeBuilderSessionService
from server.app.service.user_service import UserService
from server.infra.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from server.infra.repositories.json_files import JsonUserRepository
from server.infra.repositories.json_store import JsonFileStore
from server.infra.security import BcryptPasswordHasher
from server.infra.repositories.mongo_repositories import (
    MongoActivityFeedRepository,
    MongoStaffRepository,
    MongoAnalyticsRepository,
    MongoConnectionRepository,
    MongoMeetingRepository,
    MongoGraphKnowledgeRepository,
    MongoModelPricingRepository,
    MongoOfficeBuilderSessionRepository,
    MongoSkillRepository,
    MongoSystemSettingsRepository,
    MongoTaskRepository,
    MongoDepartmentRepository,
    MongoTokenUsageRepository,
    MongoUserRepository,
    MongoCompanyRepository,
)
from server.log import get_logger


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
# gitignored — defaults to <project_root>/storage/runtime.
STORAGE_DIR = _resolve_dir(settings.storage_dir, PROJECT_ROOT / "storage" / "runtime")

# Seed source: the bundled default catalog committed to git. Read-only — it is
# the source the startup seed copies defaults FROM, never the live store.
# Configured via SEED_DIR (settings.seed_dir); defaults to <project_root>/storage/seed.
SEED_DIR = _resolve_dir(settings.seed_dir, PROJECT_ROOT / "storage" / "seed")


def _lock_provider():
    """Process-wide singleton lock provider, initialised once from settings."""
    return get_shared_lock_provider()


def _store(filename: str) -> JsonFileStore:
    """Create a JsonFileStore with the configured lock provider."""
    return JsonFileStore(STORAGE_DIR / filename, lock_provider=_lock_provider())


@lru_cache
def _init_task_queue():
    """Initialise and register the configured task queue singleton."""
    from server.infra.task_queue import create_task_queue, _set_queue
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
    staff: StaffRepository
    skills: SkillRepository
    departments: DepartmentRepository
    tasks: TaskRepository
    conversations: MeetingRepository
    analytics: AnalyticsRepository
    activity_feed: ActivityFeedRepository
    graph_knowledge: GraphKnowledgeRepository
    companies: CompanyRepository
    connections: ConnectionRepository


@lru_cache
def _mongo_db():
    """Single shared MongoClient/database for the whole process.

    pymongo.MongoClient already pools connections internally and is meant to
    be created once per application, not once per repository — a separate
    client per store multiplies the connection-pool count against the same
    Mongo server for no benefit.
    """
    import pymongo
    client = pymongo.MongoClient(settings.mongo_uri)
    return client[settings.mongo_db]


@lru_cache
def _repos() -> Repos:
    _init_task_queue()
    if settings.storage_backend == "mongo":
        db = _mongo_db()
        staff = MongoStaffRepository(db)
        skills = MongoSkillRepository(db)
        departments = MongoDepartmentRepository(db)
        tasks = MongoTaskRepository(db)
        conversations = MongoMeetingRepository(db)
        analytics = MongoAnalyticsRepository(db)
        activity_feed = MongoActivityFeedRepository(db)
        graph_knowledge = MongoGraphKnowledgeRepository(db)
        companies = MongoCompanyRepository(db)
        connections = MongoConnectionRepository(db)
    else:
        staff = JsonStaffRepository(_store("staff.json"))
        skills = JsonSkillRepository(_store("skills.json"))
        departments = JsonDepartmentRepository(_store("departments.json"))
        tasks = JsonTaskRepository(_store("tasks.json"))
        conversations = JsonMeetingRepository(_store("meetings.json"))
        analytics = JsonAnalyticsRepository(_store("analytics.json"))
        activity_feed = JsonActivityFeedRepository(_store("activity_feed.json"))
        graph_knowledge = JsonGraphKnowledgeRepository(
            _store("graph_knowledge.json"),
            _store("graph_knowledge_events.json"),
        )
        companies = JsonCompanyRepository(_store("companies.json"))
        connections = JsonConnectionRepository(_store("connections.json"))

    # Optional Neo4j knowledge-graph backend (overrides the STORAGE_BACKEND repo
    # above). Falls back to that repo if the driver/server is unavailable so the
    # app always boots.
    if settings.graph.backend.strip().lower() == "neo4j" and settings.graph.neo4j_uri:
        try:
            from server.infra.repositories.neo4j_graph_knowledge import (
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
        staff=staff,
        skills=skills,
        departments=departments,
        tasks=tasks,
        conversations=conversations,
        analytics=analytics,
        activity_feed=activity_feed,
        graph_knowledge=graph_knowledge,
        companies=companies,
        connections=connections,
    )


def get_staff_service() -> StaffService:
    repos = _repos()
    return StaffService(repos.staff, repos.skills)


def get_skill_service() -> SkillService:
    return SkillService(_repos().skills)


def get_department_service() -> DepartmentService:
    return DepartmentService(_repos().departments)


def get_task_service() -> TaskService:
    return TaskService(_repos().tasks)


def get_recruiting_service() -> RecruitingService:
    repos = _repos()
    return RecruitingService(
        StaffService(repos.staff, repos.skills),
        SkillService(repos.skills),
        DepartmentService(repos.departments),
        TaskService(repos.tasks),
        get_document_library_service(),
        get_company_service(),
        get_project_service(),
        get_epic_service(),
        get_sprint_service(),
    )


def get_meeting_service() -> MeetingService:
    repos = _repos()
    conversations, graph_knowledge = repos.conversations, repos.graph_knowledge
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = build_default_llm_provider(
            provider=settings.graph_llm_provider,
            model=settings.graph_llm_model,
        )
    return MeetingService(
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
        graph_llm = build_default_llm_provider(
            provider=settings.graph_llm_provider,
            model=settings.graph_llm_model,
        )
    return GraphContextService(
        graph_knowledge,
        llm_provider=graph_llm,
        build_mode=settings.graph_build_mode,
    )


def get_company_service() -> CompanyService:
    return CompanyService(_repos().companies)


def get_connection_service() -> ConnectionService:
    return ConnectionService(_repos().connections)


@lru_cache
def _library_document_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories.library_documents import (
            MongoLibraryDocumentRepository,
        )
        return MongoLibraryDocumentRepository(_mongo_db())
    from server.infra.repositories.json_files.library_documents import (
        JsonLibraryDocumentRepository,
    )
    return JsonLibraryDocumentRepository(_store("library_documents.json"))


def get_document_library_service() -> "DocumentLibraryService":
    from server.app.service.document_library_service import DocumentLibraryService

    return DocumentLibraryService(_library_document_store())


@lru_cache
def _office_builder_session_store():
    if settings.storage_backend == "mongo":
        return MongoOfficeBuilderSessionRepository(_mongo_db())
    return JsonOfficeBuilderSessionRepository(_store("office_builder_sessions.json"))


def get_office_builder_session_service() -> OfficeBuilderSessionService:
    return OfficeBuilderSessionService(_office_builder_session_store())


@lru_cache
def _user_store():
    if settings.storage_backend == "mongo":
        return MongoUserRepository(_mongo_db())
    return JsonUserRepository(_store("users.json"))


@lru_cache
def _password_hasher() -> BcryptPasswordHasher:
    return BcryptPasswordHasher()


def get_user_service() -> UserService:
    return UserService(_user_store(), _password_hasher())


@lru_cache
def _project_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories import MongoProjectRepository
        return MongoProjectRepository(_mongo_db())
    from server.infra.repositories.json_files import JsonProjectRepository
    return JsonProjectRepository(_store("projects.json"))


def get_project_service() -> "ProjectService":
    from server.app.service.project_service import ProjectService
    return ProjectService(_project_store())


@lru_cache
def _epic_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories import MongoEpicRepository
        return MongoEpicRepository(_mongo_db())
    from server.infra.repositories.json_files import JsonEpicRepository
    return JsonEpicRepository(_store("epics.json"))


def get_epic_service() -> "EpicService":
    from server.app.service.epic_service import EpicService
    return EpicService(_epic_store())


@lru_cache
def _sprint_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories import MongoSprintRepository
        return MongoSprintRepository(_mongo_db())
    from server.infra.repositories.json_files import JsonSprintRepository
    return JsonSprintRepository(_store("sprints.json"))


def get_sprint_service() -> "SprintService":
    from server.app.service.sprint_service import SprintService
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
# Order matters: staff/skills/departments are seeded before tasks so a seeded task's
# referenced team and staff already exist in the live store.
_DEFAULT_DATA_FILES = (
    ("staff", "staff.json"),
    ("skills", "skills.json"),
    ("departments", "departments.json"),
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
    """Seed the bundled default staff/skills/departments/tasks into the live DB on startup.

    The committed catalog lives in the seed dir (``storage/seed/``); the live data
    lives in the local database (Mongo, or JSON files under ``storage/runtime/``).
    This copies any default entity that is missing from the live DB so a fresh
    clone comes up with the starter catalog — without ever touching the seed
    files or clobbering entities already present in the live DB.
    """
    if not settings.seed.default_data:
        return

    try:
        from server.domain.models import DEFAULT_OWNER_ID

        total_inserted = 0

        if settings.storage_backend == "mongo":
            db = _mongo_db()
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
            # JSON mode: live store is storage/runtime/*.json (≠ the seed dir).
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
    """Get SkillToolManager for binding tools to skills during staff initialization."""
    return SkillToolManager()


@lru_cache
def _monitoring_stores():
    """(TokenUsageRepository, ModelPricingRepository) for the configured backend."""
    if settings.storage_backend == "mongo":
        db = _mongo_db()
        return MongoTokenUsageRepository(db), MongoModelPricingRepository(db)
    return (
        JsonTokenUsageRepository(_store("token_usage.json")),
        JsonModelPricingRepository(_store("model_pricing.json")),
    )


@lru_cache
def get_system_settings_repository():
    """SystemSettingsRepository for the configured backend (active-model override)."""
    if settings.storage_backend == "mongo":
        return MongoSystemSettingsRepository(_mongo_db())
    return JsonSystemSettingsRepository(_store("system_settings.json"))


@lru_cache
def init_usage_tracking() -> bool:
    """Register the global LLM usage recorder against the configured store.

    Called from create_app() and lazily wherever an LLM provider is built, so
    token usage is persisted no matter which entry point fires first.
    """
    import uuid
    from datetime import datetime, timezone

    from server.domain.models import TokenUsageRecord
    from server.infra.llm.usage_tracker import set_usage_recorder

    usage_repo, _ = _monitoring_stores()

    def _record(
        *,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: str,
        staff_name: str = "",
        department_id: str = "",
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0,
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
                staff_name=staff_name or "",
                department_id=department_id or "",
                cache_read_tokens=cache_read_tokens,
                cache_creation_tokens=cache_creation_tokens,
            )
        )

    set_usage_recorder(_record)
    return True


def get_monitoring_service():
    from server.app.service.monitoring_service import MonitoringService

    init_usage_tracking()
    usage_repo, pricing_repo = _monitoring_stores()
    repos = _repos()
    return MonitoringService(
        usage=usage_repo,
        pricing=pricing_repo,
        users=_user_store(),
        staff=repos.staff,
        departments=repos.departments,
        tasks=repos.tasks,
        companies=repos.companies,
    )


def _resolve_active_model_config():
    """The active ``models:`` entry: DB override (Settings UI) if it names a
    currently-enabled model, else the config.yml resolution, else None (no
    `models:` entry at all — build_default_llm_provider raises in that case)."""
    enabled = get_enabled_models()
    if enabled:
        try:
            override = get_system_settings_repository().get_active_model()
        except Exception:  # noqa: BLE001 — DB unavailable must not block LLM startup
            override = None
        if override:
            match = next((m for m in enabled if m.name == override), None)
            if match:
                return match
    return get_model_config()


@lru_cache
def _llm_provider():
    init_usage_tracking()
    return build_default_llm_provider(model_config=_resolve_active_model_config())


def refresh_llm_provider() -> None:
    """Drop the cached LLM provider so the next call rebuilds it — call this
    after the Settings-UI active-model override changes."""
    _llm_provider.cache_clear()


def get_simulation_service() -> SimulationService:
    return SimulationService(_llm_provider())


def get_llm_service() -> LLMService | None:
    provider = _llm_provider()
    if not provider:
        return None
    return LLMService(provider)


def get_staff_graph_service(mode: str = "sequential") -> StaffGraphService | None:
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
        orchestrator = LangGraphStaffOrchestrator()
    get_logger().info(f"{orchestrator.__class__.__name__} selected for mode='{mode}'")
    return StaffGraphService(provider, orchestrator)


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
        from server.api.security import decode_access_token
        from server.domain.errors import NotFoundError

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
        from server.api.security import decode_access_token
        from server.domain.models import DEFAULT_OWNER_ID, GUEST_OWNER_ID

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
