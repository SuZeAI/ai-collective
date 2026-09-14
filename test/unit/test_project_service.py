"""No pytest-asyncio in this repo; ProjectService has no async methods so plain calls suffice."""

from __future__ import annotations

import pytest

from server.app.service.project_service import ProjectService
from server.domain.errors import NotFoundError
from server.domain.models import Project
from server.infra.repositories.json_files.projects import JsonProjectRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path) -> ProjectService:
    store = JsonFileStore(tmp_path / "projects.json")
    repo = JsonProjectRepository(store)
    return ProjectService(repo)


def _project(id_: str = "p1", key: str = "NUC", **overrides) -> Project:
    return Project(id=id_, key=key, name=f"Project {id_}", **overrides)


def test_list_projects_empty_by_default(tmp_path):
    service = _make_service(tmp_path)
    assert service.list_projects() == []


def test_upsert_then_list_and_get(tmp_path):
    service = _make_service(tmp_path)
    saved = service.upsert_project(_project())

    assert saved.id == "p1"
    assert service.list_projects() == [saved]
    assert service.get_project("p1") == saved


def test_try_get_project_returns_none_when_missing(tmp_path):
    service = _make_service(tmp_path)
    assert service.try_get_project("missing") is None


def test_get_project_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_project("missing")


def test_upsert_project_persists_across_service_instances(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_project(_project())

    reloaded = _make_service(tmp_path)
    assert reloaded.get_project("p1").name == "Project p1"


def test_upsert_project_overwrites_existing_by_id(tmp_path):
    service = _make_service(tmp_path)
    original = service.upsert_project(_project())

    from dataclasses import replace

    service.upsert_project(replace(original, name="Renamed"))

    assert service.get_project("p1").name == "Renamed"
    assert len(service.list_projects()) == 1


def test_delete_project_removes_it(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_project(_project())

    service.delete_project("p1")

    assert service.list_projects() == []
    assert service.try_get_project("p1") is None


def test_delete_project_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.delete_project("missing")


def test_allocate_issue_number_starts_at_one_and_increments(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_project(_project())

    first = service.allocate_issue_number("p1")
    second = service.allocate_issue_number("p1")

    assert first == 1
    assert second == 2
    assert service.get_project("p1").issue_counter == 2


def test_allocate_issue_number_raises_key_error_when_project_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(KeyError):
        service.allocate_issue_number("missing")
