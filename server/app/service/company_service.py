from __future__ import annotations

import logging

from dataclasses import replace
from uuid import uuid4

from server.app.ports.repositories import CompanyRepository
from server.app.service.department_service import DepartmentService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.project_service import ProjectService
from server.app.service.skill_service import SkillService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.domain.errors import NotFoundError
from server.domain.models import CATALOG_COMPANY_ID, Company, can_delete

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
        project_service: ProjectService,
    ):
        self._repo = repo
        self._departments = department_service
        self._staff = staff_service
        self._skills = skill_service
        self._tasks = task_service
        self._documents = document_library_service
        self._projects = project_service

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
        """Save a company, claiming or cloning any department it newly lists.

        ``department_ids`` is client-supplied (the "Manage Companies" UI lets a
        user free-pick from every department, including "Import settings from
        another Company"), so without this a company could end up listing a
        department another company already owns — exactly the cross-company
        sharing ``company_id`` was introduced to rule out. Each id is resolved
        so it always ends up scoped to exactly this company: unclaimed catalog
        templates are claimed in place, departments already owned by a
        *different* real company are cloned instead of aliased (mirrors
        scripts/migrate_company_scoping.py's claim-or-clone pattern).
        """
        resolved_department_ids, id_map = self._resolve_department_ids(company.department_ids, company)
        if resolved_department_ids != company.department_ids:
            primary = id_map.get(company.primary_department_id, company.primary_department_id)
            if primary not in resolved_department_ids:
                primary = resolved_department_ids[0] if resolved_department_ids else ""
            company = replace(company, department_ids=resolved_department_ids, primary_department_id=primary)
        return self._repo.upsert(company)

    def delete_company(self, company_id: str) -> None:
        self._repo.delete(company_id)

    # ----- claim-or-clone (upsert_company department_ids resolution) --------

    def _resolve_department_ids(
        self, department_ids: list[str], target_company: Company
    ) -> tuple[list[str], dict[str, str]]:
        resolved: list[str] = []
        id_map: dict[str, str] = {}
        for department_id in department_ids:
            new_id = self._claim_or_clone_department(department_id, target_company)
            if new_id is not None:
                resolved.append(new_id)
                id_map[department_id] = new_id
        return resolved, id_map

    def _claim_or_clone_skill(self, skill_id: str, target_company: Company) -> str | None:
        skill = self._skills.try_get_skill(skill_id)
        if skill is None:
            return None
        if skill.company_id == target_company.id:
            return skill.id
        if skill.company_id == CATALOG_COMPANY_ID:
            self._skills.upsert_skill(
                replace(skill, company_id=target_company.id, owner_id=target_company.owner_id)
            )
            return skill.id
        clone = replace(
            skill,
            id=f"skill_{uuid4().hex}",
            config=dict(skill.config or {}),
            company_id=target_company.id,
            owner_id=target_company.owner_id,
        )
        return self._skills.upsert_skill(clone).id

    def _claim_or_clone_staff(self, staff_id: str, target_company: Company) -> str | None:
        staff = self._staff.try_get_staff(staff_id)
        if staff is None:
            return None
        new_skill_ids = [
            sid
            for sid in (self._claim_or_clone_skill(sid, target_company) for sid in staff.skill_ids)
            if sid is not None
        ]
        if staff.company_id == target_company.id:
            if new_skill_ids != staff.skill_ids:
                self._staff.upsert_staff(replace(staff, skill_ids=new_skill_ids))
            return staff.id
        if staff.company_id == CATALOG_COMPANY_ID:
            self._staff.upsert_staff(
                replace(staff, skill_ids=new_skill_ids, company_id=target_company.id, owner_id=target_company.owner_id)
            )
            return staff.id
        clone = replace(
            staff,
            id=f"agent_{uuid4().hex}",
            skill_ids=new_skill_ids,
            company_id=target_company.id,
            owner_id=target_company.owner_id,
        )
        return self._staff.upsert_staff(clone).id

    def _claim_or_clone_department(self, department_id: str, target_company: Company) -> str | None:
        department = self._departments.try_get_department(department_id)
        if department is None:
            return None
        new_staff_ids = [
            sid
            for sid in (self._claim_or_clone_staff(sid, target_company) for sid in department.staff)
            if sid is not None
        ]
        if department.company_id == target_company.id:
            if new_staff_ids != department.staff:
                self._departments.upsert_department(replace(department, staff=new_staff_ids))
            return department.id
        if department.company_id == CATALOG_COMPANY_ID:
            self._departments.upsert_department(
                replace(
                    department, staff=new_staff_ids, company_id=target_company.id, owner_id=target_company.owner_id
                )
            )
            return department.id
        clone = replace(
            department,
            id=f"team_{uuid4().hex}",
            staff=new_staff_ids,
            company_id=target_company.id,
            owner_id=target_company.owner_id,
        )
        return self._departments.upsert_department(clone).id

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
        all_companies = self.list_companies()

        # department.company_id is the single source of truth for ownership
        # now (Department/Staff/Skill each belong to exactly one company).
        # own_department_ids also covers data that predates company_id and is
        # still at the CATALOG_COMPANY_ID default (see
        # scripts/migrate_company_scoping.py) — those are only "owned" via the
        # legacy department_ids list until migrated.
        own_department_ids = set(existing.department_ids) if existing is not None else set()

        # A department can still be listed in another company's department_ids
        # despite company_id saying otherwise — that's drift, not real sharing,
        # but it must not be silently deleted out from under that company. Kept
        # departments are reported below instead of guessed away.
        other_department_ids: dict[str, list[str]] = {}
        for company in all_companies:
            if company.id == company_id:
                continue
            for did in company.department_ids:
                other_department_ids.setdefault(did, []).append(company.name)

        departments_to_delete = []
        kept_departments = []
        for department in all_departments:
            owns = department.company_id == company_id or (
                department.company_id == CATALOG_COMPANY_ID and department.id in own_department_ids
            )
            if not owns or not can_delete(owner_id, department.owner_id):
                continue
            shared_with = other_department_ids.get(department.id)
            if shared_with:
                kept_departments.append({"id": department.id, "name": department.name, "shared_with": shared_with})
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
            "kept_departments": kept_departments,
        }
