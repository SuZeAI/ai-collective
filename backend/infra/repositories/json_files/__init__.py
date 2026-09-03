"""JSON-file repository adapters, one module per entity.

Public import path is unchanged:
    from backend.infrastructure.repositories.json_files import JsonStaffRepository
"""
from backend.infra.repositories.json_files.activity_feed import JsonActivityFeedRepository
from backend.infra.repositories.json_files.staff import JsonStaffRepository
from backend.infra.repositories.json_files.analytics import JsonAnalyticsRepository
from backend.infra.repositories.json_files.connections import JsonConnectionRepository
from backend.infra.repositories.json_files.conversations import JsonMeetingRepository
from backend.infra.repositories.json_files.epics import JsonEpicRepository
from backend.infra.repositories.json_files.model_pricing import JsonModelPricingRepository
from backend.infra.repositories.json_files.office_builder_sessions import (
    JsonOfficeBuilderSessionRepository,
)
from backend.infra.repositories.json_files.projects import JsonProjectRepository
from backend.infra.repositories.json_files.skills import JsonSkillRepository
from backend.infra.repositories.json_files.sprints import JsonSprintRepository
from backend.infra.repositories.json_files.system_settings import (
    JsonSystemSettingsRepository,
)
from backend.infra.repositories.json_files.tasks import JsonTaskRepository
from backend.infra.repositories.json_files.departments import JsonDepartmentRepository
from backend.infra.repositories.json_files.token_usage import JsonTokenUsageRepository
from backend.infra.repositories.json_files.users import JsonUserRepository
from backend.infra.repositories.json_files.companies import JsonCompanyRepository

__all__ = [
    "JsonActivityFeedRepository",
    "JsonStaffRepository",
    "JsonAnalyticsRepository",
    "JsonConnectionRepository",
    "JsonMeetingRepository",
    "JsonEpicRepository",
    "JsonModelPricingRepository",
    "JsonOfficeBuilderSessionRepository",
    "JsonProjectRepository",
    "JsonSkillRepository",
    "JsonSprintRepository",
    "JsonSystemSettingsRepository",
    "JsonTaskRepository",
    "JsonDepartmentRepository",
    "JsonTokenUsageRepository",
    "JsonUserRepository",
    "JsonCompanyRepository",
]
