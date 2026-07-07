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
from backend.infrastructure.repositories.mongo_repositories.activity_feed import (
    MongoActivityFeedRepository,
)
from backend.infrastructure.repositories.mongo_repositories.staff import MongoStaffRepository
from backend.infrastructure.repositories.mongo_repositories.analytics import MongoAnalyticsRepository
from backend.infrastructure.repositories.mongo_repositories.connections import MongoConnectionRepository
from backend.infrastructure.repositories.mongo_repositories.conversations import (
    MongoMeetingRepository,
)
from backend.infrastructure.repositories.mongo_repositories.epics import MongoEpicRepository
from backend.infrastructure.repositories.mongo_repositories.graph_knowledge import (
    MongoGraphKnowledgeRepository,
)
from backend.infrastructure.repositories.mongo_repositories.model_pricing import (
    MongoModelPricingRepository,
)
from backend.infrastructure.repositories.mongo_repositories.office_builder_sessions import (
    MongoOfficeBuilderSessionRepository,
)
from backend.infrastructure.repositories.mongo_repositories.projects import MongoProjectRepository
from backend.infrastructure.repositories.mongo_repositories.skills import MongoSkillRepository
from backend.infrastructure.repositories.mongo_repositories.sprints import MongoSprintRepository
from backend.infrastructure.repositories.mongo_repositories.tasks import MongoTaskRepository
from backend.infrastructure.repositories.mongo_repositories.departments import MongoDepartmentRepository
from backend.infrastructure.repositories.mongo_repositories.token_usage import (
    MongoTokenUsageRepository,
)
from backend.infrastructure.repositories.mongo_repositories.users import MongoUserRepository
from backend.infrastructure.repositories.mongo_repositories.companies import MongoCompanyRepository

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
    "MongoTaskRepository",
    "MongoDepartmentRepository",
    "MongoTokenUsageRepository",
    "MongoUserRepository",
    "MongoCompanyRepository",
]
