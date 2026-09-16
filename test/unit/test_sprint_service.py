"""No pytest-asyncio in this repo; SprintService has no async paths so plain calls are used."""

from __future__ import annotations

import pytest

from server.app.service.sprint_service import SprintService
from server.domain.enums import SprintStatus
from server.domain.errors import NotFoundError
from server.domain.models import Sprint
from server.infra.repositories.json_files import JsonSprintRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path) -> SprintService:
    store = JsonFileStore(tmp_path / "sprints.json")
    repo = JsonSprintRepository(store)
    return SprintService(repo)


def _sprint(id_="s1", project_id="p1", **overrides) -> Sprint:
    defaults = dict(id=id_, project_id=project_id, name="Sprint 1", goal="Ship it")
    defaults.update(overrides)
    return Sprint(**defaults)


def test_list_sprints_empty_by_default(tmp_path):
    service = _make_service(tmp_path)
    assert service.list_sprints() == []


def test_upsert_then_list_returns_the_sprint(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_sprint(_sprint())

    sprints = service.list_sprints()
    assert len(sprints) == 1
    assert sprints[0].id == "s1"
    assert sprints[0].project_id == "p1"
    assert sprints[0].status == SprintStatus.planned


def test_try_get_sprint_returns_none_when_missing(tmp_path):
    service = _make_service(tmp_path)
    assert service.try_get_sprint("missing") is None


def test_get_sprint_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_sprint("missing")


def test_get_sprint_returns_existing_sprint(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_sprint(_sprint())

    sprint = service.get_sprint("s1")
    assert sprint.id == "s1"
    assert sprint.name == "Sprint 1"


def test_upsert_sprint_overwrites_existing_by_id(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_sprint(_sprint(goal="Original goal"))
    service.upsert_sprint(_sprint(goal="Updated goal"))

    sprints = service.list_sprints()
    assert len(sprints) == 1
    assert sprints[0].goal == "Updated goal"


def test_upsert_sprint_persists_across_service_instances(tmp_path):
    service_a = _make_service(tmp_path)
    service_a.upsert_sprint(_sprint())

    service_b = _make_service(tmp_path)
    assert service_b.get_sprint("s1").id == "s1"


def test_delete_sprint_removes_it(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_sprint(_sprint())

    service.delete_sprint("s1")

    assert service.list_sprints() == []
    assert service.try_get_sprint("s1") is None


def test_delete_sprint_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.delete_sprint("missing")


def test_multiple_sprints_can_share_a_project(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_sprint(_sprint(id_="s1", project_id="p1"))
    service.upsert_sprint(_sprint(id_="s2", project_id="p1"))
    service.upsert_sprint(_sprint(id_="s3", project_id="p2"))

    sprints = service.list_sprints()
    assert {s.id for s in sprints} == {"s1", "s2", "s3"}
    assert [s.project_id for s in sprints if s.id in ("s1", "s2")] == ["p1", "p1"]
