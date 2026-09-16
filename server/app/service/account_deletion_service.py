from __future__ import annotations

import logging

from server.app.service.company_service import CompanyService
from server.app.service.connection_service import ConnectionService
from server.app.service.department_service import DepartmentService
from server.app.service.epic_service import EpicService
from server.app.service.office_builder_session_service import OfficeBuilderSessionService
from server.app.service.project_service import ProjectService
from server.app.service.skill_service import SkillService
from server.app.service.sprint_service import SprintService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.app.service.user_service import UserService

logger = logging.getLogger(__name__)


class AccountDeletionService:
    """Permanently deletes a user account and everything they own.

    Mirrors ``CompanyService.delete_company_cascade``: owned companies are
    removed via that same cascade (which sweeps their exclusive departments,
    staff, skills, tasks, and documents), then anything still owned directly
    by the user but never attached to a company (e.g. items created in the
    "All" scope) is swept in a second pass. Every step is best-effort — one
    failure must not block the rest of the deletion or leave the account
    stuck undeletable. Historical stats (token usage, activity feed) are
    never touched, same as company deletion.
    """

    def __init__(
        self,
        user_service: UserService,
        company_service: CompanyService,
        connection_service: ConnectionService,
        office_builder_session_service: OfficeBuilderSessionService,
        project_service: ProjectService,
        epic_service: EpicService,
        sprint_service: SprintService,
        department_service: DepartmentService,
        staff_service: StaffService,
        skill_service: SkillService,
        task_service: TaskService,
    ) -> None:
        self._users = user_service
        self._companies = company_service
        self._connections = connection_service
        self._office_sessions = office_builder_session_service
        self._projects = project_service
        self._epics = epic_service
        self._sprints = sprint_service
        self._departments = department_service
        self._staff = staff_service
        self._skills = skill_service
        self._tasks = task_service

    def delete_account(self, user_id: str) -> dict:
        removed_companies = 0
        for company in self._companies.list_companies():
            if company.owner_id != user_id:
                continue
            try:
                self._companies.delete_company_cascade(company.id, company, user_id)
                removed_companies += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete company %s for account %s: %s", company.id, user_id, exc)

        removed_connections = self._sweep(
            self._connections.list_connections(), self._connections.delete_connection, user_id, "connection"
        )
        removed_sessions = self._sweep(
            self._office_sessions.list_sessions(), self._office_sessions.delete_session, user_id, "office session"
        )
        removed_epics = self._sweep(self._epics.list_epics(), self._epics.delete_epic, user_id, "epic")
        removed_sprints = self._sweep(self._sprints.list_sprints(), self._sprints.delete_sprint, user_id, "sprint")
        removed_projects = self._sweep(
            self._projects.list_projects(), self._projects.delete_project, user_id, "project"
        )
        # Leftover items never attached to an owned company.
        removed_tasks = self._sweep(self._tasks.list_tasks(), self._tasks.delete_task, user_id, "task")
        removed_staff = self._sweep(self._staff.list_staff(), self._staff.delete_staff, user_id, "staff")
        removed_skills = self._sweep(self._skills.list_skills(), self._skills.delete_skill, user_id, "skill")
        removed_departments = self._sweep(
            self._departments.list_departments(), self._departments.delete_department, user_id, "department"
        )

        self._users.delete_account(user_id)

        return {
            "removed_companies": removed_companies,
            "removed_departments": removed_departments,
            "removed_staff": removed_staff,
            "removed_skills": removed_skills,
            "removed_tasks": removed_tasks,
            "removed_projects": removed_projects,
            "removed_epics": removed_epics,
            "removed_sprints": removed_sprints,
            "removed_connections": removed_connections,
            "removed_office_sessions": removed_sessions,
        }

    @staticmethod
    def _sweep(items, delete_fn, user_id: str, label: str) -> int:
        removed = 0
        for item in items:
            if item.owner_id != user_id:
                continue
            try:
                delete_fn(item.id)
                removed += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete %s %s for account %s: %s", label, item.id, user_id, exc)
        return removed
