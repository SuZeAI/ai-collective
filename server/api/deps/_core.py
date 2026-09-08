from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

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
from server.infra.lock_provider import get_shared_lock_provider
from server.infra.repositories.json_files import (
    JsonActivityFeedRepository,
    JsonStaffRepository,
    JsonAnalyticsRepository,
    JsonConnectionRepository,
    JsonMeetingRepository,
    JsonSkillRepository,
    JsonTaskRepository,
    JsonDepartmentRepository,
    JsonCompanyRepository,
)
from server.infra.repositories.json_graph_knowledge import JsonGraphKnowledgeRepository
from server.infra.repositories.json_store import JsonFileStore
from server.infra.repositories.mongo_repositories import (
    MongoActivityFeedRepository,
    MongoStaffRepository,
    MongoAnalyticsRepository,
    MongoConnectionRepository,
    MongoMeetingRepository,
    MongoGraphKnowledgeRepository,
    MongoSkillRepository,
    MongoTaskRepository,
    MongoDepartmentRepository,
    MongoCompanyRepository,
)
from server.share.log import get_logger


PROJECT_ROOT = Path(__file__).resolve().parents[3]


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
