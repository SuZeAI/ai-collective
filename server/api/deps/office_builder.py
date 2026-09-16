from __future__ import annotations

from functools import lru_cache

from server.api.deps._core import _mongo_db, _repos, _store
from server.api.deps.company import get_company_service
from server.api.deps.meetings import get_meeting_service
from server.api.deps.monitoring import _llm_provider
from server.api.settings import settings
from server.app.service.department_service import DepartmentService
from server.app.service.office_builder_service import OfficeBuilderService
from server.app.service.office_builder_session_service import OfficeBuilderSessionService
from server.app.service.skill_service import SkillService
from server.app.service.staff_service import StaffService
from server.infra.repositories.json_files import JsonOfficeBuilderSessionRepository
from server.infra.repositories.mongo_repositories import MongoOfficeBuilderSessionRepository


@lru_cache
def _office_builder_session_store():
    if settings.storage_backend == "mongo":
        return MongoOfficeBuilderSessionRepository(_mongo_db())
    return JsonOfficeBuilderSessionRepository(_store("office_builder_sessions.json"))


def get_office_builder_session_service() -> OfficeBuilderSessionService:
    return OfficeBuilderSessionService(_office_builder_session_store())


def get_office_builder_service() -> OfficeBuilderService:
    repos = _repos()
    return OfficeBuilderService(
        _llm_provider(),
        SkillService(repos.skills),
        StaffService(repos.staff, repos.skills),
        DepartmentService(repos.departments),
        get_company_service(),
        get_meeting_service(),
    )
