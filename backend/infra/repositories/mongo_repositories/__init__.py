"""MongoDB repository adapters, one module per entity.

Each class mirrors the interface of the corresponding Json*Repository in
json_files/ but persists data to a MongoDB collection via pymongo.

Usage (configured through deps.py when STORAGE_BACKEND=mongo):
    client = pymongo.MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db]
    agents = MongoStaffRepository(db)

Public import path is unchanged:
    from backend.infra.repositories.mongo_repositories import MongoStaffRepository
"""
from backend.infra.repositories.mongo_repositories.activity_feed import (
    MongoActivityFeedRepository,
)
from backend.infra.repositories.mongo_repositories.staff import MongoStaffRepository
from backend.infra.repositories.mongo_repositories.analytics import MongoAnalyticsRepository
from backend.infra.repositories.mongo_repositories.connections import MongoConnectionRepository
from backend.infra.repositories.mongo_repositories.conversations import (
    MongoMeetingRepository,
)
from backend.infra.repositories.mongo_repositories.epics import MongoEpicRepository
from backend.infra.repositories.mongo_repositories.graph_knowledge import (
    MongoGraphKnowledgeRepository,
)
from backend.infra.repositories.mongo_repositories.model_pricing import (
    MongoModelPricingRepository,
)
from backend.infra.repositories.mongo_repositories.office_builder_sessions import (
    MongoOfficeBuilderSessionRepository,
)
from backend.infra.repositories.mongo_repositories.projects import MongoProjectRepository
from backend.infra.repositories.mongo_repositories.skills import MongoSkillRepository
from backend.infra.repositories.mongo_repositories.sprints import MongoSprintRepository
from backend.infra.repositories.mongo_repositories.system_settings import (
    MongoSystemSettingsRepository,
)
from backend.infra.repositories.mongo_repositories.tasks import MongoTaskRepository
from backend.infra.repositories.mongo_repositories.departments import MongoDepartmentRepository
from backend.infra.repositories.mongo_repositories.token_usage import (
    MongoTokenUsageRepository,
)
from backend.infra.repositories.mongo_repositories.users import MongoUserRepository
from backend.infra.repositories.mongo_repositories.companies import MongoCompanyRepository

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
