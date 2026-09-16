"""No pytest-asyncio in this repo; EpicService has no async paths anyway."""

from __future__ import annotations

import pytest

from server.app.service.epic_service import EpicService
from server.domain.enums import TaskStatus
from server.domain.errors import NotFoundError
from server.domain.models import Epic
from server.infra.repositories.json_files import JsonEpicRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path) -> EpicService:
    store = JsonFileStore(tmp_path / "epics.json")
    return EpicService(JsonEpicRepository(store))


def _make_epic(id="epic-1", project_id="proj-1", key="NUC-1", title="Ship it") -> Epic:
    return Epic(id=id, project_id=project_id, key=key, title=title)


def test_list_epics_empty_when_no_data(tmp_path):
    service = _make_service(tmp_path)
    assert service.list_epics() == []


def test_upsert_then_list_and_get(tmp_path):
    service = _make_service(tmp_path)
    epic = _make_epic()

    saved = service.upsert_epic(epic)

    assert saved == epic
    assert service.list_epics() == [epic]
    assert service.get_epic("epic-1") == epic


def test_try_get_epic_returns_none_when_missing(tmp_path):
    service = _make_service(tmp_path)
    assert service.try_get_epic("does-not-exist") is None


def test_get_epic_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_epic("does-not-exist")


def test_upsert_overwrites_existing_epic_with_same_id(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_epic(_make_epic(title="Draft"))

    updated = Epic(id="epic-1", project_id="proj-1", key="NUC-1", title="Final", status=TaskStatus.completed)
    service.upsert_epic(updated)

    result = service.get_epic("epic-1")
    assert result.title == "Final"
    assert result.status == TaskStatus.completed
    assert len(service.list_epics()) == 1


def test_delete_epic_removes_it(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_epic(_make_epic())

    service.delete_epic("epic-1")

    assert service.list_epics() == []
    assert service.try_get_epic("epic-1") is None


def test_delete_epic_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.delete_epic("does-not-exist")


def test_upsert_persists_across_service_instances(tmp_path):
    """Characterizes that state is durable on disk, not just in the in-memory cache."""
    store_path = tmp_path / "epics.json"
    service_a = EpicService(JsonEpicRepository(JsonFileStore(store_path)))
    service_a.upsert_epic(_make_epic())

    service_b = EpicService(JsonEpicRepository(JsonFileStore(store_path)))

    assert service_b.get_epic("epic-1").title == "Ship it"
