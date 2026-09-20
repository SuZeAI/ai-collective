"""No pytest-asyncio in this repo, so async paths are driven via ``asyncio.run()``."""

from __future__ import annotations

import asyncio
from pathlib import Path

from server.app.service.company_service import CompanyService
from server.app.service.department_service import DepartmentService
from server.app.service.document_library_service import DocumentLibraryService
from server.app.service.epic_service import EpicService
from server.app.service.meeting_service import MeetingService
from server.app.service.office_builder_service import OfficeBuilderService
from server.app.service.project_service import ProjectService
from server.app.service.skill_service import SkillService
from server.app.service.sprint_service import SprintService
from server.app.service.staff_service import StaffService
from server.app.service.task_service import TaskService
from server.domain.errors import ValidationError
from server.domain.models import CATALOG_COMPANY_ID, Department, Skill, Staff
from server.domain.enums import StaffStatus
from server.domain.office_builder import DepartmentPlan, OfficePlan, StaffPlan
from server.infra.repositories.json_files import (
    JsonCompanyRepository,
    JsonDepartmentRepository,
    JsonEpicRepository,
    JsonMeetingRepository,
    JsonProjectRepository,
    JsonSkillRepository,
    JsonSprintRepository,
    JsonStaffRepository,
    JsonTaskRepository,
)
from server.infra.repositories.json_files.library_documents import JsonLibraryDocumentRepository
from server.infra.repositories.json_store import JsonFileStore


def _run(coro):
    return asyncio.run(coro)


class _FakeLLM:
    def __init__(self, response: dict | Exception):
        self._response = response

    async def generate_json(self, *, system: str, user: str) -> dict:
        if isinstance(self._response, Exception):
            raise self._response
        return self._response

    async def chat(self, **kwargs):
        raise NotImplementedError

    def get_chat_model(self):
        raise NotImplementedError


def _repo(cls, tmp_path: Path, name: str):
    return cls(JsonFileStore(tmp_path / f"{name}.json"))


def _build_service(tmp_path: Path, llm=None) -> OfficeBuilderService:
    skill_service = SkillService(_repo(JsonSkillRepository, tmp_path, "skills"))
    staff_service = StaffService(_repo(JsonStaffRepository, tmp_path, "staff"))
    department_service = DepartmentService(_repo(JsonDepartmentRepository, tmp_path, "departments"))
    task_service = TaskService(_repo(JsonTaskRepository, tmp_path, "tasks"))
    project_service = ProjectService(_repo(JsonProjectRepository, tmp_path, "projects"))
    epic_service = EpicService(_repo(JsonEpicRepository, tmp_path, "epics"))
    sprint_service = SprintService(_repo(JsonSprintRepository, tmp_path, "sprints"))
    document_service = DocumentLibraryService(_repo(JsonLibraryDocumentRepository, tmp_path, "documents"))
    company_service = CompanyService(
        _repo(JsonCompanyRepository, tmp_path, "companies"),
        department_service,
        staff_service,
        skill_service,
        task_service,
        document_service,
        project_service,
        epic_service,
        sprint_service,
    )
    conv_service = MeetingService(_repo(JsonMeetingRepository, tmp_path, "meetings"))
    return OfficeBuilderService(
        llm, skill_service, staff_service, department_service, company_service, conv_service
    ), staff_service, department_service, skill_service, company_service


def test_is_llm_configured_reflects_llm_presence(tmp_path):
    service, *_ = _build_service(tmp_path, llm=None)
    assert service.is_llm_configured() is False

    service_with_llm, *_ = _build_service(tmp_path, llm=_FakeLLM({}))
    assert service_with_llm.is_llm_configured() is True


def test_generate_plan_returns_reply_and_sanitized_plan_from_llm_json(tmp_path):
    fake_llm = _FakeLLM(
        {
            "reply": "Here is a support team.",
            "plan": {
                "name": "Support Co",
                "description": "Handles support",
                "company_type": "general",
                "departments": [
                    {
                        "name": "Support",
                        "description": "Front-line support",
                        "mode": "sequential",
                        "staff": [
                            {"name": "Alex", "role": "Agent", "description": "Handles tickets", "skills": []}
                        ],
                    }
                ],
            },
        }
    )
    service, *_ = _build_service(tmp_path, llm=fake_llm)

    reply, plan = _run(service.generate_plan([("user", "Build me a support team")], None, "default"))

    assert reply == "Here is a support team."
    assert plan is not None
    assert plan.name == "Support Co"
    assert len(plan.departments) == 1
    assert plan.departments[0].name == "Support"
    assert plan.departments[0].staff[0].name == "Alex"


def test_generate_plan_clamps_invalid_select_field_value_to_default(tmp_path):
    """Regression: found live running a generated software-company plan --
    the designer LLM wrote skill.config={"driver": "playwright"} for a
    tool_name="browser" skill. Only "browser_use" is actually implemented
    (server/domain/tools/tool_registry.py raises otherwise), but the
    "driver" field was declared as free text with no allowed-options list,
    so nothing caught the bad value until the skill was actually run days
    later, deep inside staff-graph execution, as a cryptic 502. The browser
    preset's "driver" field is now a select with a single valid option, and
    sanitize_office_plan clamps any select-field value outside its declared
    options back to the field's default."""
    fake_llm = _FakeLLM(
        {
            "reply": "Here is a browser-testing team.",
            "plan": {
                "name": "Browser Co",
                "description": "",
                "company_type": "software",
                "departments": [
                    {
                        "name": "QA",
                        "description": "",
                        "mode": "sequential",
                        "staff": [
                            {
                                "name": "Tester",
                                "role": "QA",
                                "description": "",
                                "skills": [
                                    {
                                        "name": "Browser Checks",
                                        "tool_name": "browser",
                                        "config": {"driver": "playwright", "cdp_url": "http://localhost:9222"},
                                    }
                                ],
                            }
                        ],
                    }
                ],
            },
        }
    )
    service, *_ = _build_service(tmp_path, llm=fake_llm)

    _, plan = _run(service.generate_plan([("user", "Build me a browser-testing team")], None, "default"))

    skill = plan.departments[0].staff[0].skills[0]
    assert skill.config["driver"] == "browser_use"
    assert skill.config["cdp_url"] == "http://localhost:9222"  # unrelated valid field untouched


def test_generate_plan_keeps_current_plan_when_llm_plan_fails_validation(tmp_path):
    current_plan = OfficePlan(name="Existing Plan", description="", company_type="general", departments=[])
    fake_llm = _FakeLLM({"reply": "Updated.", "plan": {"description": "missing required name"}})
    service, *_ = _build_service(tmp_path, llm=fake_llm)

    reply, plan = _run(service.generate_plan([("user", "tweak it")], current_plan, "default"))

    assert reply == "Updated."
    assert plan is current_plan


def test_generate_plan_defaults_reply_when_llm_omits_it(tmp_path):
    fake_llm = _FakeLLM({"plan": None})
    service, *_ = _build_service(tmp_path, llm=fake_llm)

    reply, plan = _run(service.generate_plan([("user", "hi")], None, "default"))

    assert reply == "Here is the updated office plan."
    assert plan is None


def test_apply_rejects_plan_with_empty_name(tmp_path):
    service, *_ = _build_service(tmp_path)
    plan = OfficePlan(name="  ", description="", company_type="general", departments=[
        DepartmentPlan(name="Dept", staff=[])
    ])
    try:
        service.apply(plan, "default")
        assert False, "expected ValidationError"
    except ValidationError:
        pass


def test_apply_rejects_plan_with_no_departments(tmp_path):
    service, *_ = _build_service(tmp_path)
    plan = OfficePlan(name="Acme", description="", company_type="general", departments=[])
    try:
        service.apply(plan, "default")
        assert False, "expected ValidationError"
    except ValidationError:
        pass


def test_apply_creates_company_department_staff_and_skill_from_scratch(tmp_path):
    service, staff_service, department_service, skill_service, company_service = _build_service(tmp_path)
    plan = OfficePlan(
        name="Acme Support",
        description="A support company",
        company_type="general",
        departments=[
            DepartmentPlan(
                name="Support",
                description="Front-line support",
                mode="sequential",
                staff=[StaffPlan(name="Alex", role="Agent", description="Handles tickets", skills=[])],
            )
        ],
    )

    result = service.apply(plan, "default")

    assert result.company.name == "Acme Support"
    assert len(result.department_ids) == 1
    assert len(result.staff_ids) == 1
    assert result.reused_department_ids == []
    assert result.reused_staff_ids == []

    saved_company = company_service.get_company(result.company.id)
    assert saved_company.department_ids == result.department_ids

    saved_department = department_service.get_department(result.department_ids[0])
    assert saved_department.company_id == result.company.id
    assert saved_department.staff == result.staff_ids

    saved_staff = staff_service.get_staff(result.staff_ids[0])
    assert saved_staff.name == "Alex"
    assert saved_staff.company_id == result.company.id
    assert saved_staff.status == StaffStatus.active


def test_apply_clones_catalog_department_into_new_company_without_mutating_template(tmp_path):
    service, staff_service, department_service, skill_service, company_service = _build_service(tmp_path)

    template_skill = skill_service.upsert_skill(
        Skill(
            id="skill_template",
            name="Ticketing",
            description="",
            third_party="",
            kind="integration",
            config={},
            company_id=CATALOG_COMPANY_ID,
        )
    )
    template_staff = staff_service.upsert_staff(
        Staff(
            id="staff_template",
            name="Template Agent",
            role="Agent",
            description="",
            skill_ids=[template_skill.id],
            status=StaffStatus.idle,
            avatar="A",
            company_id=CATALOG_COMPANY_ID,
        )
    )
    template_department = department_service.upsert_department(
        Department(
            id="dept_template",
            name="Support Template",
            description="",
            staff=[template_staff.id],
            active_tasks=0,
            company_id=CATALOG_COMPANY_ID,
        )
    )

    plan = OfficePlan(
        name="Cloned Co",
        description="",
        company_type="general",
        departments=[DepartmentPlan(name="ignored", staff=[], existing_id=template_department.id)],
    )

    result = service.apply(plan, "default")

    assert len(result.department_ids) == 1
    cloned_department = department_service.get_department(result.department_ids[0])
    assert cloned_department.id != template_department.id
    assert cloned_department.company_id == result.company.id
    assert result.reused_department_ids == [cloned_department.id]

    cloned_staff_id = cloned_department.staff[0]
    assert cloned_staff_id != template_staff.id
    cloned_staff = staff_service.get_staff(cloned_staff_id)
    assert cloned_staff.company_id == result.company.id
    assert cloned_staff.status == StaffStatus.active
    assert result.reused_staff_ids == [cloned_staff_id]

    cloned_skill_id = cloned_staff.skill_ids[0]
    assert cloned_skill_id != template_skill.id
    cloned_skill = skill_service.try_get_skill(cloned_skill_id)
    assert cloned_skill.company_id == result.company.id
    assert result.reused_skill_ids == [cloned_skill_id]

    # template must be untouched
    original_department = department_service.get_department(template_department.id)
    assert original_department.company_id == CATALOG_COMPANY_ID
    assert original_department.staff == [template_staff.id]
    original_staff = staff_service.get_staff(template_staff.id)
    assert original_staff.status == StaffStatus.idle
    assert original_staff.company_id == CATALOG_COMPANY_ID
