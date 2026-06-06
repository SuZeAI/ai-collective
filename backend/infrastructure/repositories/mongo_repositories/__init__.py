"""MongoDB repository adapters, one module per entity.

Each class mirrors the interface of the corresponding Json*Repository in
json_files/ but persists data to a MongoDB collection via pymongo.

Usage (configured through deps.py when STORAGE_BACKEND=mongo):
    client = pymongo.MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db]
    agents = MongoAgentRepository(db)

Public import path is unchanged:
    from backend.infrastructure.repositories.mongo_repositories import MongoAgentRepository
"""
from backend.infrastructure.repositories.mongo_repositories.activity_feed import (
    MongoActivityFeedRepository,
)
from backend.infrastructure.repositories.mongo_repositories.agents import MongoAgentRepository
from backend.infrastructure.repositories.mongo_repositories.analytics import MongoAnalyticsRepository
from backend.infrastructure.repositories.mongo_repositories.connections import MongoConnectionRepository
from backend.infrastructure.repositories.mongo_repositories.conversations import (
    MongoConversationRepository,
)
from backend.infrastructure.repositories.mongo_repositories.graph_knowledge import (
    MongoGraphKnowledgeRepository,
)
from backend.infrastructure.repositories.mongo_repositories.office_builder_sessions import (
    MongoOfficeBuilderSessionRepository,
)
from backend.infrastructure.repositories.mongo_repositories.skills import MongoSkillRepository
from backend.infrastructure.repositories.mongo_repositories.tasks import MongoTaskRepository
from backend.infrastructure.repositories.mongo_repositories.teams import MongoTeamRepository
from backend.infrastructure.repositories.mongo_repositories.users import MongoUserRepository
from backend.infrastructure.repositories.mongo_repositories.workspaces import MongoWorkspaceRepository

__all__ = [
    "MongoActivityFeedRepository",
    "MongoAgentRepository",
    "MongoAnalyticsRepository",
    "MongoConnectionRepository",
    "MongoConversationRepository",
    "MongoGraphKnowledgeRepository",
    "MongoOfficeBuilderSessionRepository",
    "MongoSkillRepository",
    "MongoTaskRepository",
    "MongoTeamRepository",
    "MongoUserRepository",
    "MongoWorkspaceRepository",
]
