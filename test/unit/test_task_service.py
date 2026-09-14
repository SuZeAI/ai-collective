"""No pytest-asyncio in this repo; TaskService has no async methods so plain calls are used."""

from __future__ import annotations

import pytest

from server.app.service.task_service import TaskService
from server.domain.enums import IssueType, TaskPriority, TaskStatus
from server.domain.errors import NotFoundError
from server.domain.models import Task
from server.infra.repositories.json_files.tasks import JsonTaskRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path) -> TaskService:
    store = JsonFileStore(tmp_path / "tasks.json")
    return TaskService(JsonTaskRepository(store))


def _make_task(task_id: str = "t1", **overrides) -> Task:
    defaults = dict(
        id=task_id,
        title="Ship the release",
        description="",
        department_id="dept-1",
        status=TaskStatus.pending,
        progress=0,
        assigned_staff=[],
    )
    defaults.update(overrides)
    return Task(**defaults)


def test_list_tasks_empty_by_default(tmp_path):
    service = _make_service(tmp_path)
    assert service.list_tasks() == []


def test_upsert_then_list_and_get(tmp_path):
    service = _make_service(tmp_path)
    task = _make_task()

    saved = service.upsert_task(task)

    assert saved == task
    assert service.list_tasks() == [task]
    assert service.try_get_task("t1") == task
    assert service.get_task("t1") == task


def test_upsert_persists_across_service_instances(tmp_path):
    store_path = tmp_path / "tasks.json"
    service_a = TaskService(JsonTaskRepository(JsonFileStore(store_path)))
    service_a.upsert_task(_make_task())

    service_b = TaskService(JsonTaskRepository(JsonFileStore(store_path)))

    assert [t.id for t in service_b.list_tasks()] == ["t1"]


def test_upsert_overwrites_existing_task_with_same_id(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_task(_make_task(title="Original"))

    updated = service.upsert_task(_make_task(title="Renamed", status=TaskStatus.in_progress))

    assert service.get_task("t1").title == "Renamed"
    assert service.get_task("t1").status == TaskStatus.in_progress
    assert len(service.list_tasks()) == 1
    assert updated.title == "Renamed"


def test_try_get_task_returns_none_when_missing(tmp_path):
    service = _make_service(tmp_path)
    assert service.try_get_task("missing") is None


def test_get_task_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.get_task("missing")


def test_delete_task_removes_it(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_task(_make_task())

    service.delete_task("t1")

    assert service.list_tasks() == []
    assert service.try_get_task("t1") is None


def test_delete_task_raises_not_found_when_missing(tmp_path):
    service = _make_service(tmp_path)
    with pytest.raises(NotFoundError):
        service.delete_task("missing")


def test_upsert_round_trips_jira_style_fields(tmp_path):
    service = _make_service(tmp_path)
    task = _make_task(
        priority=TaskPriority.high,
        labels=["bug", "urgent"],
        assignee_id="staff-1",
        comments=[{"id": "c1", "author_id": "u1", "content": "hi", "created_at": "2026-01-01T00:00:00Z"}],
        project_id="proj-1",
        issue_type=IssueType.bug,
        issue_key="NUC-42",
        epic_id="epic-1",
        sprint_id="sprint-1",
        story_points=5,
    )

    service.upsert_task(task)
    reloaded = TaskService(JsonTaskRepository(JsonFileStore(tmp_path / "tasks.json"))).get_task("t1")

    assert reloaded.priority == TaskPriority.high
    assert reloaded.labels == ["bug", "urgent"]
    assert reloaded.assignee_id == "staff-1"
    assert reloaded.comments[0]["content"] == "hi"
    assert reloaded.project_id == "proj-1"
    assert reloaded.issue_type == IssueType.bug
    assert reloaded.issue_key == "NUC-42"
    assert reloaded.epic_id == "epic-1"
    assert reloaded.sprint_id == "sprint-1"
    assert reloaded.story_points == 5
