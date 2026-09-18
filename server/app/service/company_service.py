from __future__ import annotations

import logging

from dataclasses import replace
from uuid import uuid4

from server.app.ports.repositories import CompanyRepository
from server.app.service.department_service import DepartmentService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.epic_service import EpicService
from server.app.service.project_service import ProjectService
from server.app.service.skill_service import SkillService
from server.app.service.sprint_service import SprintService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.domain.errors import NotFoundError
from server.domain.models import CATALOG_COMPANY_ID, Company, Department, Skill, Staff, can_delete, can_modify

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
        epic_service: EpicService,
        sprint_service: SprintService,
    ):
        self._repo = repo
        self._departments = department_service
        self._staff = staff_service
        self._skills = skill_service
        self._tasks = task_service
        self._documents = document_library_service
        self._projects = project_service
        self._epics = epic_service
        self._sprints = sprint_service

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

    def _plan_company_delete(self, company_id: str, existing: Company | None, owner_id: str) -> dict:
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

        # Projects (Jira-style) belong to exactly one company; a project with
        # no company left behind is dead weight (its epics/sprints/tasks are
        # unreachable from any UI scope), so it goes with the company.
        projects_to_delete = [
            project
            for project in self._projects.list_projects()
            if project.company_id == company_id and can_delete(owner_id, project.owner_id)
        ]
        project_ids_to_delete = {p.id for p in projects_to_delete}

        epics_to_delete = [e for e in self._epics.list_epics() if e.project_id in project_ids_to_delete]
        sprints_to_delete = [s for s in self._sprints.list_sprints() if s.project_id in project_ids_to_delete]

        # Tasks tied to a department or staff member being removed, or to a
        # project being removed, have no home left.
        tasks_to_delete = [
            task
            for task in self._tasks.list_tasks()
            if task.department_id in departments_to_delete_ids
            or (task.assignee_id is not None and task.assignee_id in staff_to_delete_ids)
            or task.project_id in project_ids_to_delete
        ]

        documents_to_delete = [doc for doc in self._documents.list_documents() if doc.company_id == company_id]

        return {
            "departments_to_delete": departments_to_delete,
            "kept_departments": kept_departments,
            "staff_to_delete_ids": staff_to_delete_ids,
            "skills_to_delete_ids": skills_to_delete_ids,
            "tasks_to_delete": tasks_to_delete,
            "documents_to_delete": documents_to_delete,
            "projects_to_delete": projects_to_delete,
            "epics_to_delete": epics_to_delete,
            "sprints_to_delete": sprints_to_delete,
        }

    def preview_company_delete(self, company_id: str, owner_id: str) -> dict:
        """Preview a company delete: how much is exclusive to it (and thus
        would be removed) vs. still shared with (and thus kept for) another
        company, without deleting anything.
        """
        plan = self._plan_company_delete(company_id, self.try_get_company(company_id), owner_id)
        return {
            "removed_teams": len(plan["departments_to_delete"]),
            "removed_staff": len(plan["staff_to_delete_ids"]),
            "removed_skills": len(plan["skills_to_delete_ids"]),
            "removed_tasks": len(plan["tasks_to_delete"]),
            "removed_documents": len(plan["documents_to_delete"]),
            "removed_projects": len(plan["projects_to_delete"]),
            "removed_epics": len(plan["epics_to_delete"]),
            "removed_sprints": len(plan["sprints_to_delete"]),
            "kept_departments": plan["kept_departments"],
        }

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
        plan = self._plan_company_delete(company_id, existing, owner_id)

        removed_tasks = 0
        for task in plan["tasks_to_delete"]:
            try:
                self._tasks.delete_task(task.id)
                removed_tasks += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete task %s for company %s: %s", task.id, company_id, exc)

        removed_staff = 0
        for staff_id in plan["staff_to_delete_ids"]:
            try:
                self._staff.delete_staff(staff_id)
                removed_staff += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete staff %s for company %s: %s", staff_id, company_id, exc)

        removed_skills = 0
        for skill_id in plan["skills_to_delete_ids"]:
            skill = self._skills.try_get_skill(skill_id)
            if skill is not None and not can_delete(owner_id, skill.owner_id):
                continue
            try:
                self._skills.delete_skill(skill_id)
                removed_skills += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete skill %s for company %s: %s", skill_id, company_id, exc)

        removed_teams = 0
        for department in plan["departments_to_delete"]:
            try:
                self._departments.delete_department(department.id)
                removed_teams += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete department %s for company %s: %s", department.id, company_id, exc)

        removed_documents = 0
        for doc in plan["documents_to_delete"]:
            try:
                self._documents.delete_document(doc)
                removed_documents += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete document %s for company %s: %s", doc.id, company_id, exc)

        removed_epics = 0
        for epic in plan["epics_to_delete"]:
            try:
                self._epics.delete_epic(epic.id)
                removed_epics += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete epic %s for company %s: %s", epic.id, company_id, exc)

        removed_sprints = 0
        for sprint in plan["sprints_to_delete"]:
            try:
                self._sprints.delete_sprint(sprint.id)
                removed_sprints += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete sprint %s for company %s: %s", sprint.id, company_id, exc)

        removed_projects = 0
        for project in plan["projects_to_delete"]:
            try:
                self._projects.delete_project(project.id)
                removed_projects += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete project %s for company %s: %s", project.id, company_id, exc)

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
            "removed_projects": removed_projects,
            "removed_epics": removed_epics,
            "removed_sprints": removed_sprints,
            "kept_departments": plan["kept_departments"],
        }

    # ----- department delete: impact preview + cascade -----------------------

    def _plan_department_delete(self, department: Department | None) -> dict:
        if department is None:
            return {"affected_companies": []}
        department_id = department.id

        affected_company_ids = {department.company_id}
        for company in self.list_companies():
            if department_id in company.department_ids or company.primary_department_id == department_id:
                affected_company_ids.add(company.id)
        affected_companies = [
            {"id": c.id, "name": c.name} for c in self.list_companies() if c.id in affected_company_ids
        ]

        return {"affected_companies": affected_companies}

    def preview_department_delete(self, department_id: str) -> dict:
        plan = self._plan_department_delete(self._departments.try_get_department(department_id))
        return {"affected_companies": plan["affected_companies"]}

    def delete_department_cascade(self, department_id: str, existing: Department | None, owner_id: str) -> dict:
        """Delete a department without touching its staff.

        Staff are their own entity, reusable across departments in the same
        company — deleting a department only removes it from whichever
        company(ies) reference it; staff members stay put, just no longer
        rostered under this department. (Deleting a staff, in turn, never
        deletes the departments that referenced it — see delete_staff_cascade.)
        """
        plan = self._plan_department_delete(existing)
        affected_ids = {c["id"] for c in plan["affected_companies"]}

        for company in self.list_companies():
            if company.id not in affected_ids:
                continue
            new_department_ids = [d for d in company.department_ids if d != department_id]
            new_primary = "" if company.primary_department_id == department_id else company.primary_department_id
            if new_department_ids == company.department_ids and new_primary == company.primary_department_id:
                continue
            try:
                self.upsert_company(
                    replace(company, department_ids=new_department_ids, primary_department_id=new_primary)
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to unlink department %s from company %s: %s", department_id, company.id, exc)

        self._departments.delete_department(department_id)
        return {"deleted": True, "affected_companies": plan["affected_companies"]}

    # ----- staff delete: impact preview + cascade -----------------------------

    def _plan_staff_delete(self, staff: Staff | None) -> dict:
        if staff is None:
            return {"affected_companies": [], "department_ids": [], "project_ids": [], "task_ids": []}
        staff_id = staff.id

        departments_with_staff = [d for d in self._departments.list_departments() if staff_id in d.staff]
        projects_with_staff = [
            p for p in self._projects.list_projects() if p.lead_id == staff_id or p.planner_staff_id == staff_id
        ]
        tasks_with_staff = [
            t for t in self._tasks.list_tasks() if t.assignee_id == staff_id or staff_id in t.assigned_staff
        ]

        affected_company_ids = {staff.company_id}
        affected_company_ids.update(d.company_id for d in departments_with_staff)
        affected_company_ids.update(p.company_id for p in projects_with_staff if p.company_id)
        affected_companies = [
            {"id": c.id, "name": c.name} for c in self.list_companies() if c.id in affected_company_ids
        ]

        return {
            "affected_companies": affected_companies,
            "department_ids": [d.id for d in departments_with_staff],
            "project_ids": [p.id for p in projects_with_staff],
            "task_ids": [t.id for t in tasks_with_staff],
        }

    def preview_staff_delete(self, staff_id: str) -> dict:
        plan = self._plan_staff_delete(self._staff.try_get_staff(staff_id))
        return {
            "affected_companies": plan["affected_companies"],
            "departments_updated": len(plan["department_ids"]),
            "projects_updated": len(plan["project_ids"]),
            "tasks_updated": len(plan["task_ids"]),
        }

    def delete_staff_cascade(self, staff_id: str, existing: Staff | None, owner_id: str) -> dict:
        plan = self._plan_staff_delete(existing)

        for department_id in plan["department_ids"]:
            department = self._departments.try_get_department(department_id)
            if department is None or not can_modify(owner_id, department.owner_id):
                continue
            try:
                self._departments.upsert_department(
                    replace(department, staff=[sid for sid in department.staff if sid != staff_id])
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to unassign staff %s from department %s: %s", staff_id, department_id, exc)

        for project_id in plan["project_ids"]:
            project = self._projects.try_get_project(project_id)
            if project is None or not can_modify(owner_id, project.owner_id):
                continue
            try:
                self._projects.upsert_project(
                    replace(
                        project,
                        lead_id="" if project.lead_id == staff_id else project.lead_id,
                        planner_staff_id="" if project.planner_staff_id == staff_id else project.planner_staff_id,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to clear staff %s from project %s: %s", staff_id, project_id, exc)

        for task_id in plan["task_ids"]:
            task = self._tasks.try_get_task(task_id)
            if task is None or not can_modify(owner_id, task.owner_id):
                continue
            try:
                self._tasks.upsert_task(
                    replace(
                        task,
                        assignee_id=None if task.assignee_id == staff_id else task.assignee_id,
                        assigned_staff=[sid for sid in task.assigned_staff if sid != staff_id],
                    )
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to clear staff %s from task %s: %s", staff_id, task_id, exc)

        self._staff.delete_staff(staff_id)
        return {
            "deleted": True,
            "affected_companies": plan["affected_companies"],
            "departments_updated": len(plan["department_ids"]),
            "projects_updated": len(plan["project_ids"]),
            "tasks_updated": len(plan["task_ids"]),
        }

    # ----- skill delete: impact preview + cascade -----------------------------

    def _plan_skill_delete(self, skill: Skill | None) -> dict:
        if skill is None:
            return {"affected_companies": [], "staff_ids": []}
        skill_id = skill.id

        staff_with_skill = [s for s in self._staff.list_staff() if skill_id in s.skill_ids]

        affected_company_ids = {skill.company_id}
        affected_company_ids.update(s.company_id for s in staff_with_skill)
        affected_companies = [
            {"id": c.id, "name": c.name} for c in self.list_companies() if c.id in affected_company_ids
        ]

        return {"affected_companies": affected_companies, "staff_ids": [s.id for s in staff_with_skill]}

    def preview_skill_delete(self, skill_id: str) -> dict:
        plan = self._plan_skill_delete(self._skills.try_get_skill(skill_id))
        return {"affected_companies": plan["affected_companies"], "staff_updated": len(plan["staff_ids"])}

    def delete_skill_cascade(self, skill_id: str, existing: Skill | None, owner_id: str) -> dict:
        plan = self._plan_skill_delete(existing)

        for staff_id in plan["staff_ids"]:
            staff = self._staff.try_get_staff(staff_id)
            if staff is None or not can_modify(owner_id, staff.owner_id):
                continue
            try:
                self._staff.upsert_staff(
                    replace(staff, skill_ids=[sid for sid in staff.skill_ids if sid != skill_id])
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to remove skill %s from staff %s: %s", skill_id, staff_id, exc)

        self._skills.delete_skill(skill_id)
        return {
            "deleted": True,
            "affected_companies": plan["affected_companies"],
            "staff_updated": len(plan["staff_ids"]),
        }
