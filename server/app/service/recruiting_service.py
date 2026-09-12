from __future__ import annotations

from datetime import datetime, timezone
from dataclasses import replace
from uuid import uuid4

from server.app.service.staff_service import StaffService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.skill_service import SkillService
from server.app.service.task_service import TaskService
from server.app.service.department_service import DepartmentService
from server.app.service.company_service import CompanyService
from server.app.service.project_service import ProjectService
from server.app.service.epic_service import EpicService
from server.app.service.sprint_service import SprintService
from server.domain.enums import StaffStatus, TaskStatus
from server.domain.errors import NotFoundError, ValidationError
from server.domain.models import (
    CATALOG_COMPANY_ID,
    DEFAULT_OWNER_ID,
    Staff,
    LibraryDocument,
    Skill,
    Task,
    Department,
    Project,
    is_visible_to,
)

# The entity kinds users can browse and clone via recruiting.
RECRUITING_KINDS = ("skill", "staff", "department", "task", "project", "document")


class RecruitingService:
    """Browse shared "default" items and deep-copy them into a user's scope.

    Copying is done server-side so the whole dependency graph (a department's staff,
    each staff's skills, a task's department) is cloned with freshly minted ids and
    re-owned by the requesting user — the clone runs immediately and editing it
    never touches the shared original.
    """

    def __init__(
        self,
        staff_service: StaffService,
        skill_service: SkillService,
        department_service: DepartmentService,
        task_service: TaskService,
        document_service: DocumentLibraryService,
        company_service: CompanyService,
        project_service: ProjectService,
        epic_service: EpicService,
        sprint_service: SprintService,
    ) -> None:
        self._staff = staff_service
        self._skills = skill_service
        self._departments = department_service
        self._tasks = task_service
        self._documents = document_service
        self._companies = company_service
        self._projects = project_service
        self._epics = epic_service
        self._sprints = sprint_service

    # ----- listing -----------------------------------------------------------

    def list_default_skills(self) -> list[Skill]:
        return [s for s in self._skills.list_skills() if s.owner_id == DEFAULT_OWNER_ID]

    def list_default_staff(self) -> list[tuple[Staff, list[Skill]]]:
        return [
            (a, skills)
            for a, skills in self._staff.list_staff_with_skills()
            if a.owner_id == DEFAULT_OWNER_ID
        ]

    def list_default_departments(self) -> list[Department]:
        return [t for t in self._departments.list_departments() if t.owner_id == DEFAULT_OWNER_ID]

    def list_default_tasks(self) -> list[Task]:
        return [t for t in self._tasks.list_tasks() if t.owner_id == DEFAULT_OWNER_ID]

    def list_default_projects(self) -> list[Project]:
        return [p for p in self._projects.list_projects() if p.owner_id == DEFAULT_OWNER_ID]

    def list_default_documents(self) -> list[LibraryDocument]:
        return [
            d
            for d in self._documents.list_documents()
            if d.owner_id == DEFAULT_OWNER_ID and d.company_id == CATALOG_COMPANY_ID
        ]

    # ----- copying -----------------------------------------------------------

    def copy(
        self,
        kind: str,
        item_id: str,
        owner_id: str,
        *,
        company_id: str | None = None,
    ) -> dict:
        """Deep-copy a default item into ``owner_id``'s scope.

        Returns a small summary ``{"type", "id"}`` of the created root entity.
        Documents are office-bound, so copying one requires the target
        ``company_id`` (the company the user is recruiting into).
        """
        if kind in ("skill", "staff", "department") and not company_id:
            raise ValidationError(f"Copying a {kind} requires a target company_id")
        if kind == "skill":
            return {"type": kind, "id": self._copy_skill(item_id, owner_id, company_id).id}
        if kind == "staff":
            return {"type": kind, "id": self._copy_staff(item_id, owner_id, company_id).id}
        if kind == "department":
            department = self._copy_department(item_id, owner_id, company_id)
            self._attach_department(department.id, company_id)
            return {"type": kind, "id": department.id}
        if kind == "task":
            return {"type": kind, "id": self._copy_task(item_id, owner_id, company_id).id}
        if kind == "project":
            return {"type": kind, "id": self._copy_project(item_id, owner_id, company_id).id}
        if kind == "document":
            if not company_id:
                raise ValidationError("Copying a document requires a target company_id")
            return {"type": kind, "id": self._copy_document(item_id, owner_id, company_id).id}
        raise NotFoundError(f"Unknown recruiting kind '{kind}'")

    def _skills_by_id(self) -> dict[str, Skill]:
        return {s.id: s for s in self._skills.list_skills()}

    def _require_default_skill(self, skill_id: str, lookup: dict[str, Skill]) -> Skill:
        skill = lookup.get(skill_id)
        if skill is None or skill.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Recruiting skill '{skill_id}' not found")
        return skill

    def _clone_skill(self, src: Skill, owner_id: str, company_id: str) -> Skill:
        clone = replace(
            src,
            id=f"skill_{uuid4().hex}",
            config=dict(src.config or {}),
            owner_id=owner_id,
            company_id=company_id,
        )
        return self._skills.upsert_skill(clone)

    def _clone_staff(
        self, src: Staff, owner_id: str, skill_lookup: dict[str, Skill], company_id: str
    ) -> Staff:
        new_skill_ids: list[str] = []
        for sid in src.skill_ids:
            skill = skill_lookup.get(sid)
            if skill is None:
                continue  # tolerate dangling references
            new_skill_ids.append(self._clone_skill(skill, owner_id, company_id).id)
        clone = replace(
            src,
            id=f"agent_{uuid4().hex}",
            skill_ids=new_skill_ids,
            status=StaffStatus.idle,
            owner_id=owner_id,
            company_id=company_id,
        )
        return self._staff.upsert_staff(clone)

    def _clone_department(
        self, src: Department, owner_id: str, skill_lookup: dict[str, Skill], company_id: str
    ) -> Department:
        new_staff_ids: list[str] = []
        for aid in src.staff:
            staff = self._staff._repo.get(aid)
            if staff is None:
                continue
            new_staff_ids.append(self._clone_staff(staff, owner_id, skill_lookup, company_id).id)
        clone = replace(
            src,
            id=f"team_{uuid4().hex}",
            staff=new_staff_ids,
            active_tasks=0,
            owner_id=owner_id,
            company_id=company_id,
        )
        return self._departments.upsert_department(clone)

    def _copy_skill(self, skill_id: str, owner_id: str, company_id: str) -> Skill:
        src = self._require_default_skill(skill_id, self._skills_by_id())
        return self._clone_skill(src, owner_id, company_id)

    def _copy_staff(self, staff_id: str, owner_id: str, company_id: str) -> Staff:
        src = self._staff._repo.get(staff_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Recruiting staff '{staff_id}' not found")
        return self._clone_staff(src, owner_id, self._skills_by_id(), company_id)

    def _copy_department(self, department_id: str, owner_id: str, company_id: str) -> Department:
        src = self._departments._repo.get(department_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Recruiting department '{department_id}' not found")
        return self._clone_department(src, owner_id, self._skills_by_id(), company_id)

    def _attach_department(self, department_id: str, company_id: str | None) -> None:
        # "Copy to my unit" only means something if the clone actually shows up
        # in that unit's Projects/Departments views, which are scoped off
        # Company.department_ids — so a freshly cloned department must join it.
        if not company_id:
            return
        company = self._companies.try_get_company(company_id)
        if company is None or department_id in company.department_ids:
            return
        self._companies.upsert_company(
            replace(company, department_ids=[*company.department_ids, department_id])
        )

    def _clone_task_department(
        self, src: Task, owner_id: str, skill_lookup: dict[str, Skill], company_id: str | None
    ) -> tuple[str, dict[str, str]]:
        """Deep-copy a task's backing department (+ staff + skills), if any, and
        attach the clone to ``company_id`` so the task is both runnable and
        visible in that company. Returns (new_department_id, old_staff_id -> new_staff_id)."""
        staff_id_map: dict[str, str] = {}
        new_department_id = ""
        src_department = self._departments._repo.get(src.department_id) if src.department_id else None
        if src_department is not None and src_department.owner_id == DEFAULT_OWNER_ID:
            effective_company_id = company_id or CATALOG_COMPANY_ID
            new_staff_ids: list[str] = []
            for aid in src_department.staff:
                staff = self._staff._repo.get(aid)
                if staff is None:
                    continue
                cloned = self._clone_staff(staff, owner_id, skill_lookup, effective_company_id)
                staff_id_map[aid] = cloned.id
                new_staff_ids.append(cloned.id)
            cloned_department = replace(
                src_department,
                id=f"team_{uuid4().hex}",
                staff=new_staff_ids,
                active_tasks=0,
                owner_id=owner_id,
                company_id=effective_company_id,
            )
            new_department_id = self._departments.upsert_department(cloned_department).id
            self._attach_department(new_department_id, company_id)
        return new_department_id, staff_id_map

    def _copy_task(self, task_id: str, owner_id: str, company_id: str | None = None) -> Task:
        src = self._tasks._repo.get(task_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Recruiting task '{task_id}' not found")

        skill_lookup = self._skills_by_id()
        new_department_id, staff_id_map = self._clone_task_department(src, owner_id, skill_lookup, company_id)
        clone = replace(
            src,
            id=f"task_{uuid4().hex}",
            department_id=new_department_id or src.department_id,
            assigned_staff=[staff_id_map.get(a, a) for a in src.assigned_staff],
            status=TaskStatus.pending,
            progress=0,
            start_time=None,
            end_time=None,
            owner_id=owner_id,
        )
        return self._tasks.upsert_task(clone)

    def _unique_project_key(self, base_key: str, owner_id: str) -> str:
        existing = {p.key for p in self._projects.list_projects() if is_visible_to(owner_id, p.owner_id)}
        if base_key not in existing:
            return base_key
        n = 2
        while f"{base_key}{n}" in existing:
            n += 1
        return f"{base_key}{n}"

    def _copy_project(self, project_id: str, owner_id: str, company_id: str | None = None) -> Project:
        src = self._projects.try_get_project(project_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Recruiting project '{project_id}' not found")

        new_project_id = f"project_{uuid4().hex}"
        cloned_project = replace(
            src,
            id=new_project_id,
            key=self._unique_project_key(src.key, owner_id),
            created_at=datetime.now(timezone.utc).replace(microsecond=0),
            owner_id=owner_id,
            company_id=company_id or "",
        )
        saved_project = self._projects.upsert_project(cloned_project)

        epic_id_map = {
            epic.id: self._epics.upsert_epic(
                replace(epic, id=f"epic_{uuid4().hex}", project_id=new_project_id, owner_id=owner_id)
            ).id
            for epic in self._epics.list_epics()
            if epic.project_id == project_id and epic.owner_id == DEFAULT_OWNER_ID
        }
        sprint_id_map = {
            sprint.id: self._sprints.upsert_sprint(
                replace(sprint, id=f"sprint_{uuid4().hex}", project_id=new_project_id, owner_id=owner_id)
            ).id
            for sprint in self._sprints.list_sprints()
            if sprint.project_id == project_id and sprint.owner_id == DEFAULT_OWNER_ID
        }

        skill_lookup = self._skills_by_id()
        for task in self._tasks.list_tasks():
            if task.project_id != project_id or task.owner_id != DEFAULT_OWNER_ID:
                continue
            new_department_id, staff_id_map = self._clone_task_department(task, owner_id, skill_lookup, company_id)
            cloned_task = replace(
                task,
                id=f"task_{uuid4().hex}",
                department_id=new_department_id or task.department_id,
                assigned_staff=[staff_id_map.get(a, a) for a in task.assigned_staff],
                project_id=new_project_id,
                epic_id=epic_id_map.get(task.epic_id, task.epic_id) if task.epic_id else task.epic_id,
                sprint_id=sprint_id_map.get(task.sprint_id, task.sprint_id) if task.sprint_id else task.sprint_id,
                status=TaskStatus.pending,
                progress=0,
                start_time=None,
                end_time=None,
                owner_id=owner_id,
            )
            self._tasks.upsert_task(cloned_task)

        return saved_project

    def _copy_document(
        self, doc_id: str, owner_id: str, target_company_id: str
    ) -> LibraryDocument:
        src = self._documents.get_document(doc_id)
        if src.owner_id != DEFAULT_OWNER_ID or src.company_id != CATALOG_COMPANY_ID:
            raise NotFoundError(f"Recruiting document '{doc_id}' not found")
        data = self._documents.read_bytes(src)
        if data is None:
            raise NotFoundError(f"Document bytes for {doc_id!r} not found")
        return self._documents.create_document(
            company_id=target_company_id,
            filename=src.name,
            content_type=src.content_type,
            data=data,
            owner_id=owner_id,
            uploaded_by=owner_id,
            description=src.description,
            source=src.source,
            source_url=src.source_url,
            tags=list(src.tags or []),
        )
