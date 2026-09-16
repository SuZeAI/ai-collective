"""No pytest-asyncio in this repo, and DepartmentService has no async paths."""

from __future__ import annotations

import pytest

from server.app.service.department_service import DepartmentService
from server.domain.errors import NotFoundError
from server.domain.models import Department
from server.infra.repositories.json_files.departments import JsonDepartmentRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path) -> DepartmentService:
    store = JsonFileStore(tmp_path / "departments.json")
    return DepartmentService(JsonDepartmentRepository(store))


def _department(**overrides) -> Department:
    defaults = dict(
        id="dept-1",
        name="Engineering",
        description="Builds things",
        staff=["staff-1", "staff-2"],
        active_tasks=0,
    )
    defaults.update(overrides)
    return Department(**defaults)


def test_list_departments_empty_by_default(tmp_path):
    service = _make_service(tmp_path)
    assert service.list_departments() == []


def test_upsert_then_get_department_round_trips(tmp_path):
    service = _make_service(tmp_path)
    saved = service.upsert_department(_department())

    assert saved.id == "dept-1"
    fetched = service.get_department("dept-1")
    assert fetched.name == "Engineering"
    assert fetched.staff == ["staff-1", "staff-2"]
    assert fetched.mode == "sequential"
    assert fetched.max_steps == 6


def test_upsert_persists_across_service_instances(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_department(_department())

    reloaded = _make_service(tmp_path)
    assert [d.id for d in reloaded.list_departments()] == ["dept-1"]


def test_upsert_overwrites_existing_department_with_same_id(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_department(_department())
    service.upsert_department(_department(name="Engineering Renamed", active_tasks=3))

    departments = service.list_departments()
    assert len(departments) == 1
    assert departments[0].name == "Engineering Renamed"
    assert departments[0].active_tasks == 3


def test_upsert_preserves_custom_mode_flow_payload(tmp_path):
    service = _make_service(tmp_path)
    flow = {"nodes": [{"id": "n1"}], "edges": [{"source": "n1", "target": "n1"}]}
    service.upsert_department(_department(mode="custom", flow=flow))

    fetched = service.get_department("dept-1")
    assert fetched.mode == "custom"
    assert fetched.flow == flow


def test_try_get_department_returns_none_when_missing(tmp_path):
    service = _make_service(tmp_path)
    assert service.try_get_department("missing") is None


def test_get_department_raises_not_found_for_missing_id(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_department("missing")


def test_delete_department_removes_it(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_department(_department())
    service.delete_department("dept-1")

    assert service.list_departments() == []
    assert service.try_get_department("dept-1") is None


def test_delete_department_raises_not_found_for_missing_id(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.delete_department("missing")
