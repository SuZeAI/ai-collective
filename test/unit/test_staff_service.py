"""Characterization tests for StaffService, wired to real JSON repo adapters."""

from __future__ import annotations

import pytest

from server.app.service.staff_service import StaffService
from server.domain.enums import StaffStatus
from server.domain.errors import NotFoundError
from server.domain.models import Skill, Staff
from server.infra.repositories._helpers import default_staff_system_prompt
from server.infra.repositories.json_files.skills import JsonSkillRepository
from server.infra.repositories.json_files.staff import JsonStaffRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_staff(id: str = "staff-1", skill_ids: list[str] | None = None) -> Staff:
    # system_prompt must be pre-filled: JsonStaffRepository serializes a falsy
    # system_prompt into a generated default, which would break round-trip
    # equality against an empty-string original.
    return Staff(
        id=id,
        name="Dev Staff",
        role="developer",
        description="Writes code",
        skill_ids=skill_ids or [],
        status=StaffStatus.idle,
        avatar="D",
        system_prompt=default_staff_system_prompt(name="Dev Staff", role="developer", description="Writes code"),
    )


def _make_skill(id: str = "skill-1", tool_name: str | None = None) -> Skill:
    # avatar must be pre-filled for the same reason (falsy avatar -> repo
    # generates one from the name on serialize).
    return Skill(
        id=id,
        name="Web Search",
        description="Search the web",
        third_party="",
        kind="integration",
        config={},
        avatar="W",
        tool_name=tool_name,
    )


def _service(tmp_path, with_skills: bool = True) -> StaffService:
    staff_repo = JsonStaffRepository(JsonFileStore(tmp_path / "staff.json"))
    skill_repo = JsonSkillRepository(JsonFileStore(tmp_path / "skills.json")) if with_skills else None
    return StaffService(staff_repo, skill_repo)


def test_upsert_then_get_staff_roundtrips(tmp_path):
    service = _service(tmp_path)
    staff = _make_staff()

    service.upsert_staff(staff)

    assert service.get_staff("staff-1") == staff
    assert service.list_staff() == [staff]


def test_try_get_staff_returns_none_when_missing(tmp_path):
    service = _service(tmp_path)
    assert service.try_get_staff("nope") is None


def test_get_staff_raises_not_found_when_missing(tmp_path):
    service = _service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_staff("nope")


def test_delete_staff_raises_not_found_when_missing(tmp_path):
    service = _service(tmp_path)
    with pytest.raises(NotFoundError):
        service.delete_staff("nope")


def test_delete_staff_removes_it(tmp_path):
    service = _service(tmp_path)
    service.upsert_staff(_make_staff())

    service.delete_staff("staff-1")

    assert service.try_get_staff("staff-1") is None
    assert service.list_staff() == []


def test_get_staff_skills_without_skill_repo_returns_empty(tmp_path):
    service = _service(tmp_path, with_skills=False)
    service.upsert_staff(_make_staff(skill_ids=["skill-1"]))

    assert service.get_staff_skills("staff-1") == []


def test_get_staff_skills_resolves_skill_ids(tmp_path):
    service = _service(tmp_path)
    skill = _make_skill()
    service._skill_repo.upsert(skill)
    service.upsert_staff(_make_staff(skill_ids=["skill-1"]))

    assert service.get_staff_skills("staff-1") == [skill]


def test_get_staff_skills_silently_drops_dangling_skill_ids(tmp_path):
    """A skill_id with no matching skill is simply skipped, not an error."""
    service = _service(tmp_path)
    service.upsert_staff(_make_staff(skill_ids=["missing-skill"]))

    assert service.get_staff_skills("staff-1") == []


def test_list_staff_with_skills_pairs_each_staff_with_resolved_skills(tmp_path):
    service = _service(tmp_path)
    skill = _make_skill()
    service._skill_repo.upsert(skill)
    staff = _make_staff(skill_ids=["skill-1"])
    service.upsert_staff(staff)

    result = service.list_staff_with_skills()

    assert result == [(staff, [skill])]


def test_list_staff_with_skills_without_skill_repo_returns_empty_skill_lists(tmp_path):
    service = _service(tmp_path, with_skills=False)
    staff = _make_staff(skill_ids=["skill-1"])
    service.upsert_staff(staff)

    assert service.list_staff_with_skills() == [(staff, [])]


def test_get_staff_tools_returns_empty_when_skill_has_no_tool_name(tmp_path):
    """Skill.tool_name=None means SkillToolManager.bind_tool short-circuits
    without touching ToolRegistry, so this stays a pure in-memory path."""
    service = _service(tmp_path)
    service._skill_repo.upsert(_make_skill(tool_name=None))
    service.upsert_staff(_make_staff(skill_ids=["skill-1"]))

    assert service.get_staff_tools("staff-1") == {}


def test_prepare_graph_definitions_raises_not_found_for_missing_staff_id(tmp_path):
    service = _service(tmp_path)
    with pytest.raises(NotFoundError):
        service.prepare_graph_definitions(["missing-staff"])


def test_prepare_graph_definitions_builds_definition_and_name_map(tmp_path):
    service = _service(tmp_path)
    staff = _make_staff()
    service.upsert_staff(staff)

    definitions, id_to_name = service.prepare_graph_definitions(["staff-1"])

    assert len(definitions) == 1
    assert definitions[0].name == "Dev Staff"
    assert definitions[0].role == "developer"
    assert definitions[0].skill_ids == []
    assert definitions[0].tools is None
    assert id_to_name == {"staff-1": "Dev Staff"}
