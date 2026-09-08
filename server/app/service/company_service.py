from __future__ import annotations

import logging

from server.app.ports.repositories import CompanyRepository
from server.app.service.department_service import DepartmentService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.skill_service import SkillService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.domain.errors import NotFoundError
from server.domain.models import Company, can_delete

logger = logging.getLogger(__name__)


class CompanyService:
    def __init__(
        self,
        repo: CompanyRepository,
        department_service: DepartmentService,
        staff_service: StaffService,
        skill_service: SkillService,
        task_service: TaskService,
        document_library_service: DocumentLibraryService,
    ):
        self._repo = repo
        self._departments = department_service
        self._staff = staff_service
        self._skills = skill_service
        self._tasks = task_service
        self._documents = document_library_service

    def list_companies(self) -> list[Company]:
        return self._repo.list()

    def try_get_company(self, company_id: str) -> Company | None:
        return self._repo.get(company_id)

    def get_company(self, company_id: str) -> Company:
        company = self.try_get_company(company_id)
        if company is None:
            raise NotFoundError(f"Company {company_id!r} not found")
        return company

    def upsert_company(self, company: Company) -> Company:
        return self._repo.upsert(company)

    def delete_company(self, company_id: str) -> None:
        self._repo.delete(company_id)

    def delete_company_cascade(self, company_id: str, existing: Company | None, owner_id: str) -> dict:
        """Delete a company and everything exclusive to it (departments, staff,
        skills, tasks, documents), so none of it lingers in the "All" scope as
        an orphan. Each cleanup is best-effort — a failure on related data must
        not block deleting the company itself.

        Historical stats (Cost Monitoring / token-usage records) are never
        touched here: those only carry a department_id string, not a live
        reference, so "All" keeps aggregating them forever, even for companies
        deleted since.
        """
        all_departments = self._departments.list_departments()

        # Departments still referenced by another company must be kept — they
        # are shared. Only the ones unique to this company are candidates.
        other_department_ids: set[str] = set()
        for company in self.list_companies():
            if company.id == company_id:
                continue
            other_department_ids.update(company.department_ids)

        departments_to_delete = []
        if existing is not None:
            own_department_ids = set(existing.department_ids)
            for department in all_departments:
                if department.id not in own_department_ids or department.id in other_department_ids:
                    continue
                if not can_delete(owner_id, department.owner_id):
                    continue
                departments_to_delete.append(department)
        departments_to_delete_ids = {d.id for d in departments_to_delete}

        # Staff exclusive to those departments (not also a member of a
        # department being kept, in this or another company) get removed too.
        own_staff_ids: set[str] = set()
        for department in departments_to_delete:
            own_staff_ids.update(department.staff)
        other_staff_ids: set[str] = set()
        for department in all_departments:
            if department.id in departments_to_delete_ids:
                continue
            other_staff_ids.update(department.staff)
        staff_to_delete_ids = own_staff_ids - other_staff_ids

        # Skills (tools) exclusive to the staff being removed go with them too.
        all_staff = self._staff.list_staff()
        remaining_skill_ids: set[str] = set()
        for member in all_staff:
            if member.id not in staff_to_delete_ids:
                remaining_skill_ids.update(member.skill_ids)
        skills_to_delete_ids: set[str] = set()
        for member in all_staff:
            if member.id in staff_to_delete_ids:
                skills_to_delete_ids.update(sid for sid in member.skill_ids if sid not in remaining_skill_ids)

        # Tasks tied to a department or staff member being removed have no home left.
        removed_tasks = 0
        for task in self._tasks.list_tasks():
            orphaned = task.department_id in departments_to_delete_ids or (
                task.assignee_id is not None and task.assignee_id in staff_to_delete_ids
            )
            if not orphaned:
                continue
            try:
                self._tasks.delete_task(task.id)
                removed_tasks += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete task %s for company %s: %s", task.id, company_id, exc)

        removed_staff = 0
        for staff_id in staff_to_delete_ids:
            try:
                self._staff.delete_staff(staff_id)
                removed_staff += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete staff %s for company %s: %s", staff_id, company_id, exc)

        removed_skills = 0
        for skill_id in skills_to_delete_ids:
            skill = self._skills.try_get_skill(skill_id)
            if skill is not None and not can_delete(owner_id, skill.owner_id):
                continue
            try:
                self._skills.delete_skill(skill_id)
                removed_skills += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete skill %s for company %s: %s", skill_id, company_id, exc)

        removed_teams = 0
        for department in departments_to_delete:
            try:
                self._departments.delete_department(department.id)
                removed_teams += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete department %s for company %s: %s", department.id, company_id, exc)

        removed_documents = 0
        for doc in self._documents.list_documents():
            if doc.company_id != company_id:
                continue
            try:
                self._documents.delete_document(doc)
                removed_documents += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete document %s for company %s: %s", doc.id, company_id, exc)

        # Office-builder sessions (AI Office Designer chats) are kept even after
        # the company is deleted, so the user can revisit and recreate from them.

        self.delete_company(company_id)
        return {
            "deleted": True,
            "removed_teams": removed_teams,
            "removed_staff": removed_staff,
            "removed_skills": removed_skills,
            "removed_tasks": removed_tasks,
            "removed_documents": removed_documents,
        }
