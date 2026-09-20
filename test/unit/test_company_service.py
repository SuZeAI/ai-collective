"""Characterization tests for CompanyService, wired with real JSON-file repos."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from server.app.service.company_service import CompanyService
from server.app.service.department_service import DepartmentService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.epic_service import EpicService
from server.app.service.project_service import ProjectService
from server.app.service.skill_service import SkillService
from server.app.service.sprint_service import SprintService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.domain.enums import StaffStatus
from server.domain.errors import NotFoundError
from server.domain.models import CATALOG_COMPANY_ID, Company, Department, Skill, Staff
from server.infra.repositories.json_files.companies import JsonCompanyRepository
from server.infra.repositories.json_files.departments import JsonDepartmentRepository
from server.infra.repositories.json_files.epics import JsonEpicRepository
from server.infra.repositories.json_files.library_documents import JsonLibraryDocumentRepository
from server.infra.repositories.json_files.projects import JsonProjectRepository
from server.infra.repositories.json_files.skills import JsonSkillRepository
from server.infra.repositories.json_files.sprints import JsonSprintRepository
from server.infra.repositories.json_files.staff import JsonStaffRepository
from server.infra.repositories.json_files.tasks import JsonTaskRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_company_service(tmp_path: Path) -> tuple[CompanyService, StaffService, SkillService, DepartmentService]:
    department_repo = JsonDepartmentRepository(JsonFileStore(tmp_path / "departments.json"))
    staff_repo = JsonStaffRepository(JsonFileStore(tmp_path / "staff.json"))
    skill_repo = JsonSkillRepository(JsonFileStore(tmp_path / "skills.json"))
    task_repo = JsonTaskRepository(JsonFileStore(tmp_path / "tasks.json"))
    project_repo = JsonProjectRepository(JsonFileStore(tmp_path / "projects.json"))
    epic_repo = JsonEpicRepository(JsonFileStore(tmp_path / "epics.json"))
    sprint_repo = JsonSprintRepository(JsonFileStore(tmp_path / "sprints.json"))
    document_repo = JsonLibraryDocumentRepository(JsonFileStore(tmp_path / "documents.json"))

    department_service = DepartmentService(department_repo)
    staff_service = StaffService(staff_repo, skill_repo)
    skill_service = SkillService(skill_repo)
    task_service = TaskService(task_repo)
    project_service = ProjectService(project_repo)
    epic_service = EpicService(epic_repo)
    sprint_service = SprintService(sprint_repo)
    document_service = DocumentLibraryService(document_repo)

    company_repo = JsonCompanyRepository(JsonFileStore(tmp_path / "companies.json"))
    service = CompanyService(
        company_repo,
        department_service,
        staff_service,
        skill_service,
        task_service,
        document_service,
        project_service,
        epic_service,
        sprint_service,
    )
    return service, staff_service, skill_service, department_service


def _company(**overrides) -> Company:
    defaults = dict(
        id="company_1",
        name="Acme",
        description="",
        department_ids=[],
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return Company(**defaults)


def _department(**overrides) -> Department:
    defaults = dict(id="dept_1", name="Engineering", description="", staff=[], active_tasks=0)
    defaults.update(overrides)
    return Department(**defaults)


def _staff(**overrides) -> Staff:
    defaults = dict(
        id="staff_1", name="Ada", role="Engineer", description="", skill_ids=[],
        status=StaffStatus.active, avatar="A",
    )
    defaults.update(overrides)
    return Staff(**defaults)


def _skill(**overrides) -> Skill:
    defaults = dict(id="skill_1", name="Search", description="", third_party="", kind="integration", config={})
    defaults.update(overrides)
    return Skill(**defaults)


def test_list_get_upsert_delete_company_roundtrip(tmp_path):
    service, *_ = _make_company_service(tmp_path)
    company = _company()

    saved = service.upsert_company(company)
    assert saved.id == "company_1"
    assert service.get_company("company_1").name == "Acme"
    assert [c.id for c in service.list_companies()] == ["company_1"]

    service.delete_company("company_1")
    assert service.try_get_company("company_1") is None
    assert service.list_companies() == []


def test_get_company_missing_raises_not_found(tmp_path):
    service, *_ = _make_company_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_company("does-not-exist")
    assert service.try_get_company("does-not-exist") is None


def test_upsert_company_claims_unclaimed_catalog_department_in_place(tmp_path):
    service, _staff_service, _skill_service, department_service = _make_company_service(tmp_path)
    department_service.upsert_department(_department(id="dept_catalog", company_id=CATALOG_COMPANY_ID))

    company = _company(id="company_1", department_ids=["dept_catalog"])
    saved = service.upsert_company(company)

    assert saved.department_ids == ["dept_catalog"]
    claimed = department_service.try_get_department("dept_catalog")
    assert claimed.company_id == "company_1"


def test_upsert_company_clones_department_owned_by_another_real_company(tmp_path):
    service, _staff_service, _skill_service, department_service = _make_company_service(tmp_path)
    department_service.upsert_department(_department(id="dept_owned", company_id="company_other"))

    company = _company(id="company_1", department_ids=["dept_owned"])
    saved = service.upsert_company(company)

    assert saved.department_ids != ["dept_owned"]
    assert len(saved.department_ids) == 1
    cloned_id = saved.department_ids[0]
    assert cloned_id != "dept_owned"

    original = department_service.try_get_department("dept_owned")
    assert original.company_id == "company_other"
    clone = department_service.try_get_department(cloned_id)
    assert clone.company_id == "company_1"


def test_upsert_company_clone_also_reassigns_primary_department_id(tmp_path):
    service, *_rest, department_service = _make_company_service(tmp_path)
    department_service.upsert_department(_department(id="dept_owned", company_id="company_other"))

    company = _company(id="company_1", department_ids=["dept_owned"], primary_department_id="dept_owned")
    saved = service.upsert_company(company)

    assert saved.primary_department_id == saved.department_ids[0]
    assert saved.primary_department_id != "dept_owned"


def test_upsert_company_department_missing_is_dropped_silently(tmp_path):
    service, *_ = _make_company_service(tmp_path)
    company = _company(id="company_1", department_ids=["does-not-exist"])
    saved = service.upsert_company(company)
    assert saved.department_ids == []


def test_claim_or_clone_cascades_to_staff_and_skills(tmp_path):
    service, staff_service, skill_service, department_service = _make_company_service(tmp_path)
    skill_service.upsert_skill(_skill(id="skill_catalog", company_id=CATALOG_COMPANY_ID))
    staff_service.upsert_staff(
        _staff(id="staff_catalog", skill_ids=["skill_catalog"], company_id=CATALOG_COMPANY_ID)
    )
    department_service.upsert_department(
        _department(id="dept_catalog", staff=["staff_catalog"], company_id=CATALOG_COMPANY_ID)
    )

    company = _company(id="company_1", department_ids=["dept_catalog"])
    service.upsert_company(company)

    claimed_department = department_service.try_get_department("dept_catalog")
    assert claimed_department.company_id == "company_1"
    claimed_staff = staff_service.try_get_staff("staff_catalog")
    assert claimed_staff.company_id == "company_1"
    claimed_skill = skill_service.try_get_skill("skill_catalog")
    assert claimed_skill.company_id == "company_1"
