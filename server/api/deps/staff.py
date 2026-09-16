from __future__ import annotations

from server.api.deps._core import _repos
from server.app.service.department_service import DepartmentService
from server.app.service.recruiting_service import RecruitingService
from server.app.service.skill_service import SkillService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.domain.service.skill_tool_service import SkillToolManager


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
    # Lazy: server.api.deps.company imports this module at load time (for
    # get_company_service's staff/department/skill/task dependencies), so
    # importing it back at module level here would be circular.
    from server.api.deps.company import get_company_service
    from server.api.deps.documents import get_document_library_service
    from server.api.deps.projects import get_epic_service, get_project_service, get_sprint_service

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


def get_skill_tool_manager() -> SkillToolManager:
    """Get SkillToolManager for binding tools to skills during staff initialization."""
    return SkillToolManager()
