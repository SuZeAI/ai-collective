"""No pytest-asyncio in this repo; RecruitingService has no async paths anyway."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

import pytest

from server.domain.enums import StaffStatus, TaskStatus
from server.domain.errors import NotFoundError, ValidationError
from server.domain.models import (
    DEFAULT_OWNER_ID,
    Company,
    Department,
    Epic,
    Project,
    Skill,
    Sprint,
    Staff,
    Task,
)

from server.infra.repositories.json_store import JsonFileStore
from server.infra.repositories.json_files.companies import JsonCompanyRepository
from server.infra.repositories.json_files.departments import JsonDepartmentRepository
from server.infra.repositories.json_files.epics import JsonEpicRepository
from server.infra.repositories.json_files.projects import JsonProjectRepository
from server.infra.repositories.json_files.skills import JsonSkillRepository
from server.infra.repositories.json_files.sprints import JsonSprintRepository
from server.infra.repositories.json_files.staff import JsonStaffRepository
from server.infra.repositories.json_files.tasks import JsonTaskRepository

from server.app.service.company_service import CompanyService
from server.app.service.department_service import DepartmentService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.epic_service import EpicService
from server.app.service.project_service import ProjectService
from server.app.service.recruiting_service import RecruitingService
from server.app.service.skill_service import SkillService
from server.app.service.sprint_service import SprintService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService


class _FakeDocumentRepo:
    """No JSON adapter needed here: RecruitingService's document path isn't
    under test (it requires real byte storage), so a minimal stub is enough
    to satisfy DocumentLibraryService's constructor."""

    def list(self):
        return []

    def get(self, doc_id):
        return None

    def upsert(self, doc):
        return doc

    def delete(self, doc_id):
        pass


def _store(tmp_path: Path, name: str) -> JsonFileStore:
    return JsonFileStore(tmp_path / f"{name}.json")


def _build_services(tmp_path: Path):
    skill_service = SkillService(JsonSkillRepository(_store(tmp_path, "skills")))
    staff_service = StaffService(JsonStaffRepository(_store(tmp_path, "staff")))
    department_service = DepartmentService(JsonDepartmentRepository(_store(tmp_path, "departments")))
    task_service = TaskService(JsonTaskRepository(_store(tmp_path, "tasks")))
    document_service = DocumentLibraryService(_FakeDocumentRepo())
    project_service = ProjectService(JsonProjectRepository(_store(tmp_path, "projects")))
    epic_service = EpicService(JsonEpicRepository(_store(tmp_path, "epics")))
    sprint_service = SprintService(JsonSprintRepository(_store(tmp_path, "sprints")))
    company_service = CompanyService(
        JsonCompanyRepository(_store(tmp_path, "companies")),
        department_service,
        staff_service,
        skill_service,
        task_service,
        document_service,
        project_service,
        epic_service,
        sprint_service,
    )
    recruiting = RecruitingService(
        staff_service,
        skill_service,
        department_service,
        task_service,
        document_service,
        company_service,
        project_service,
        epic_service,
        sprint_service,
    )
    return recruiting, dict(
        skills=skill_service,
        staff=staff_service,
        departments=department_service,
        tasks=task_service,
        companies=company_service,
        projects=project_service,
        epics=epic_service,
        sprints=sprint_service,
    )


def _default_skill(id_="skill_default_1") -> Skill:
    return Skill(
        id=id_,
        name="Web Search",
        description="Searches the web",
        third_party="",
        kind="integration",
        config={"api_key": "shared-secret"},
        tool_name="websearch",
        owner_id=DEFAULT_OWNER_ID,
    )


def _default_staff(skill_ids: list[str], id_="agent_default_1") -> Staff:
    return Staff(
        id=id_,
        name="Researcher",
        role="Researcher",
        description="Does research",
        skill_ids=skill_ids,
        status=StaffStatus.idle,
        avatar="R",
        owner_id=DEFAULT_OWNER_ID,
    )


def _default_department(staff_ids: list[str], id_="team_default_1") -> Department:
    return Department(
        id=id_,
        name="Research Dept",
        description="",
        staff=staff_ids,
        active_tasks=0,
        owner_id=DEFAULT_OWNER_ID,
    )


def test_copy_department_deep_clones_staff_and_skills_with_fresh_ids(tmp_path):
    recruiting, svc = _build_services(tmp_path)
    skill = svc["skills"].upsert_skill(_default_skill())
    staff = svc["staff"].upsert_staff(_default_staff([skill.id]))
    department = svc["departments"].upsert_department(_default_department([staff.id]))
    target_company = svc["companies"].upsert_company(
        Company(id="company_1", name="Acme", description="", department_ids=[], created_at=datetime.now(timezone.utc), owner_id="user_1")
    )

    result = recruiting.copy("department", department.id, "user_1", company_id=target_company.id)

    assert result["type"] == "department"
    cloned_department = svc["departments"].get_department(result["id"])
    assert cloned_department.id != department.id
    assert cloned_department.owner_id == "user_1"
    assert cloned_department.company_id == target_company.id
    assert len(cloned_department.staff) == 1

    cloned_staff_id = cloned_department.staff[0]
    assert cloned_staff_id != staff.id
    cloned_staff = svc["staff"].get_staff(cloned_staff_id)
    assert cloned_staff.owner_id == "user_1"
    assert len(cloned_staff.skill_ids) == 1

    cloned_skill_id = cloned_staff.skill_ids[0]
    assert cloned_skill_id != skill.id
    cloned_skill = svc["skills"].try_get_skill(cloned_skill_id)
    assert cloned_skill is not None
    assert cloned_skill.owner_id == "user_1"
    assert cloned_skill.config == skill.config  # deep-copied value, not shared reference

    # editing the clone must never touch the original
    svc["skills"].upsert_skill(replace(cloned_skill, name="Edited"))
    original_skill_again = svc["skills"].try_get_skill(skill.id)
    assert original_skill_again.name == "Web Search"

    # cloned department must be attached to the target company
    refreshed_company = svc["companies"].get_company(target_company.id)
    assert cloned_department.id in refreshed_company.department_ids


def test_copy_department_requires_company_id(tmp_path):
    recruiting, svc = _build_services(tmp_path)
    with pytest.raises(ValidationError):
        recruiting.copy("department", "team_default_1", "user_1")


def test_copy_non_default_department_raises_not_found(tmp_path):
    recruiting, svc = _build_services(tmp_path)
    department = svc["departments"].upsert_department(
        Department(id="team_owned", name="Mine", description="", staff=[], active_tasks=0, owner_id="user_1")
    )
    with pytest.raises(NotFoundError):
        recruiting.copy("department", department.id, "user_2", company_id="company_x")


def test_copy_task_clones_backing_department_and_remaps_assigned_staff(tmp_path):
    recruiting, svc = _build_services(tmp_path)
    skill = svc["skills"].upsert_skill(_default_skill())
    staff = svc["staff"].upsert_staff(_default_staff([skill.id]))
    department = svc["departments"].upsert_department(_default_department([staff.id]))
    task = svc["tasks"].upsert_task(
        Task(
            id="task_default_1",
            title="Investigate",
            description="",
            department_id=department.id,
            status=TaskStatus.pending,
            progress=0,
            assigned_staff=[staff.id],
            owner_id=DEFAULT_OWNER_ID,
        )
    )

    result = recruiting.copy("task", task.id, "user_1", company_id="company_9")

    cloned_task = svc["tasks"].get_task(result["id"])
    assert cloned_task.id != task.id
    assert cloned_task.owner_id == "user_1"
    assert cloned_task.status == TaskStatus.pending
    assert cloned_task.department_id != department.id  # remapped to a freshly cloned department
    assert cloned_task.assigned_staff[0] != staff.id  # remapped to the freshly cloned staff


def test_copy_unknown_kind_raises_not_found(tmp_path):
    recruiting, _ = _build_services(tmp_path)
    with pytest.raises(NotFoundError):
        recruiting.copy("bogus-kind", "x", "user_1", company_id="company_1")


def test_copy_project_clones_epics_sprints_and_tasks(tmp_path):
    recruiting, svc = _build_services(tmp_path)
    project = svc["projects"].upsert_project(
        Project(id="project_1", key="NUC", name="Nucleus", owner_id=DEFAULT_OWNER_ID)
    )
    epic = svc["epics"].upsert_epic(
        Epic(id="epic_1", project_id=project.id, key="NUC-1", title="Epic 1", owner_id=DEFAULT_OWNER_ID)
    )
    sprint = svc["sprints"].upsert_sprint(
        Sprint(id="sprint_1", project_id=project.id, name="Sprint 1", owner_id=DEFAULT_OWNER_ID)
    )
    svc["tasks"].upsert_task(
        Task(
            id="task_1",
            title="Do it",
            description="",
            department_id="",
            status=TaskStatus.pending,
            progress=0,
            assigned_staff=[],
            owner_id=DEFAULT_OWNER_ID,
            project_id=project.id,
            epic_id=epic.id,
            sprint_id=sprint.id,
        )
    )

    result = recruiting.copy("project", project.id, "user_1")

    cloned_project = svc["projects"].get_project(result["id"])
    assert cloned_project.id != project.id
    # is_visible_to() treats DEFAULT_OWNER_ID items as visible to every owner, so the
    # default "NUC" project counts as a collision even when cloning into a new owner.
    assert cloned_project.key == "NUC2"
    assert cloned_project.owner_id == "user_1"

    cloned_tasks = [t for t in svc["tasks"].list_tasks() if t.project_id == cloned_project.id]
    assert len(cloned_tasks) == 1
    assert cloned_tasks[0].epic_id != epic.id
    assert cloned_tasks[0].sprint_id != sprint.id


def test_copy_project_key_collision_only_bumps_once_per_existing_owner(tmp_path):
    # A user who already owns a project cloned as "NUC2" gets "NUC3" on a second clone.
    recruiting, svc = _build_services(tmp_path)
    project = svc["projects"].upsert_project(Project(id="project_1", key="NUC", name="Nucleus", owner_id=DEFAULT_OWNER_ID))

    first = svc["projects"].get_project(recruiting.copy("project", project.id, "user_1")["id"])
    assert first.key == "NUC2"

    second = svc["projects"].get_project(recruiting.copy("project", project.id, "user_1")["id"])
    assert second.key == "NUC3"
