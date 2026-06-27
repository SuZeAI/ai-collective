"""JSON-file repository adapters, one module per entity.

Public import path is unchanged:
    from backend.infrastructure.repositories.json_files import JsonAgentRepository
"""
from backend.infrastructure.repositories.json_files.activity_feed import JsonActivityFeedRepository
from backend.infrastructure.repositories.json_files.agents import JsonAgentRepository
from backend.infrastructure.repositories.json_files.analytics import JsonAnalyticsRepository
from backend.infrastructure.repositories.json_files.connections import JsonConnectionRepository
from backend.infrastructure.repositories.json_files.conversations import JsonConversationRepository
from backend.infrastructure.repositories.json_files.epics import JsonEpicRepository
from backend.infrastructure.repositories.json_files.model_pricing import JsonModelPricingRepository
from backend.infrastructure.repositories.json_files.office_builder_sessions import (
    JsonOfficeBuilderSessionRepository,
)
from backend.infrastructure.repositories.json_files.projects import JsonProjectRepository
from backend.infrastructure.repositories.json_files.skills import JsonSkillRepository
from backend.infrastructure.repositories.json_files.sprints import JsonSprintRepository
from backend.infrastructure.repositories.json_files.tasks import JsonTaskRepository
from backend.infrastructure.repositories.json_files.teams import JsonTeamRepository
from backend.infrastructure.repositories.json_files.token_usage import JsonTokenUsageRepository
from backend.infrastructure.repositories.json_files.users import JsonUserRepository
from backend.infrastructure.repositories.json_files.workspaces import JsonWorkspaceRepository

__all__ = [
    "JsonActivityFeedRepository",
    "JsonAgentRepository",
    "JsonAnalyticsRepository",
    "JsonConnectionRepository",
    "JsonConversationRepository",
    "JsonEpicRepository",
    "JsonModelPricingRepository",
    "JsonOfficeBuilderSessionRepository",
    "JsonProjectRepository",
    "JsonSkillRepository",
    "JsonSprintRepository",
    "JsonTaskRepository",
    "JsonTeamRepository",
    "JsonTokenUsageRepository",
    "JsonUserRepository",
    "JsonWorkspaceRepository",
]
