"""MongoDB repository adapters, one module per entity.

Each class mirrors the interface of the corresponding Json*Repository in
json_files/ but persists data to a MongoDB collection via pymongo.

Usage (configured through deps.py when STORAGE_BACKEND=mongo):
    client = pymongo.MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db]
    agents = MongoStaffRepository(db)

Public import path is unchanged:
    from backend.infrastructure.repositories.mongo_repositories import MongoStaffRepository
"""
from server.infra.repositories.mongo_repositories.activity_feed import (
    MongoActivityFeedRepository,
)
from server.infra.repositories.mongo_repositories.staff import MongoStaffRepository
from server.infra.repositories.mongo_repositories.analytics import MongoAnalyticsRepository
from server.infra.repositories.mongo_repositories.connections import MongoConnectionRepository
from server.infra.repositories.mongo_repositories.conversations import (
    MongoMeetingRepository,
)
from server.infra.repositories.mongo_repositories.epics import MongoEpicRepository
from server.infra.repositories.mongo_repositories.graph_knowledge import (
    MongoGraphKnowledgeRepository,
)
from server.infra.repositories.mongo_repositories.model_pricing import (
    MongoModelPricingRepository,
)
from server.infra.repositories.mongo_repositories.office_builder_sessions import (
    MongoOfficeBuilderSessionRepository,
)
from server.infra.repositories.mongo_repositories.projects import MongoProjectRepository
from server.infra.repositories.mongo_repositories.skills import MongoSkillRepository
from server.infra.repositories.mongo_repositories.sprints import MongoSprintRepository
from server.infra.repositories.mongo_repositories.system_settings import (
    MongoSystemSettingsRepository,
)
from server.infra.repositories.mongo_repositories.tasks import MongoTaskRepository
from server.infra.repositories.mongo_repositories.departments import MongoDepartmentRepository
from server.infra.repositories.mongo_repositories.token_usage import (
    MongoTokenUsageRepository,
)
from server.infra.repositories.mongo_repositories.users import MongoUserRepository
from server.infra.repositories.mongo_repositories.companies import MongoCompanyRepository

__all__ = [
    "MongoActivityFeedRepository",
    "MongoStaffRepository",
    "MongoAnalyticsRepository",
    "MongoConnectionRepository",
    "MongoMeetingRepository",
    "MongoEpicRepository",
    "MongoGraphKnowledgeRepository",
    "MongoModelPricingRepository",
    "MongoOfficeBuilderSessionRepository",
    "MongoProjectRepository",
    "MongoSkillRepository",
    "MongoSprintRepository",
    "MongoSystemSettingsRepository",
    "MongoTaskRepository",
    "MongoDepartmentRepository",
    "MongoTokenUsageRepository",
    "MongoUserRepository",
    "MongoCompanyRepository",
]
