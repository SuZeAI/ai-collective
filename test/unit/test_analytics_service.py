"""Characterization tests for AnalyticsService, backed by real JSON repos."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from server.app.service.analytics_service import AnalyticsService
from server.domain.enums import TaskStatus
from server.domain.models import Task
from server.infra.repositories.json_files.analytics import JsonAnalyticsRepository
from server.infra.repositories.json_files.tasks import JsonTaskRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path: Path, base_analytics: dict | None = None) -> AnalyticsService:
    analytics_path = tmp_path / "analytics.json"
    if base_analytics is not None:
        analytics_path.write_text(json.dumps(base_analytics))
    analytics_repo = JsonAnalyticsRepository(JsonFileStore(analytics_path))
    task_repo = JsonTaskRepository(JsonFileStore(tmp_path / "tasks.json"))
    return AnalyticsService(analytics_repo, task_repo), task_repo


def _make_task(
    task_id: str,
    owner_id: str,
    status: TaskStatus = TaskStatus.completed,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> Task:
    return Task(
        id=task_id,
        title=f"Task {task_id}",
        description="",
        department_id="",
        status=status,
        progress=100 if status == TaskStatus.completed else 0,
        assigned_staff=[],
        start_time=start_time,
        end_time=end_time,
        owner_id=owner_id,
    )


def test_get_analytics_with_no_tasks_returns_base_analytics_zero_completed(tmp_path):
    service, _ = _make_service(
        tmp_path,
        base_analytics={"tasksCompleted": 999, "avgCompletionTime": "ignored", "teamEfficiency": 42, "agentProductivity": {"Dev": 7}},
    )
    result = service.get_analytics("default")

    assert result.tasks_completed == 0
    assert result.avg_completion_time == "-"
    assert result.department_efficiency == 42
    assert result.staff_productivity == {"Dev": 7}


def test_get_analytics_counts_only_completed_tasks_for_owner(tmp_path):
    service, task_repo = _make_service(tmp_path)
    now = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("t1", "default", TaskStatus.completed, now, now + timedelta(seconds=10)))
    task_repo.upsert(_make_task("t2", "default", TaskStatus.in_progress))
    task_repo.upsert(_make_task("t3", "default", TaskStatus.pending))

    result = service.get_analytics("default")

    assert result.tasks_completed == 1


def test_get_analytics_excludes_other_owners_tasks(tmp_path):
    service, task_repo = _make_service(tmp_path)
    now = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("mine", "alice", TaskStatus.completed, now, now + timedelta(seconds=5)))
    task_repo.upsert(_make_task("theirs", "bob", TaskStatus.completed, now, now + timedelta(seconds=5)))

    result = service.get_analytics("alice")

    assert result.tasks_completed == 1


def test_get_analytics_formats_seconds(tmp_path):
    service, task_repo = _make_service(tmp_path)
    start = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("t1", "default", TaskStatus.completed, start, start + timedelta(seconds=45)))

    result = service.get_analytics("default")

    assert result.avg_completion_time == "45s"


def test_get_analytics_formats_minutes(tmp_path):
    service, task_repo = _make_service(tmp_path)
    start = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("t1", "default", TaskStatus.completed, start, start + timedelta(minutes=3, seconds=20)))

    result = service.get_analytics("default")

    assert result.avg_completion_time == "3m 20s"


def test_get_analytics_formats_hours(tmp_path):
    service, task_repo = _make_service(tmp_path)
    start = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("t1", "default", TaskStatus.completed, start, start + timedelta(hours=2, minutes=15)))

    result = service.get_analytics("default")

    assert result.avg_completion_time == "2h 15m"


def test_get_analytics_averages_across_multiple_completed_tasks(tmp_path):
    service, task_repo = _make_service(tmp_path)
    start = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("t1", "default", TaskStatus.completed, start, start + timedelta(seconds=10)))
    task_repo.upsert(_make_task("t2", "default", TaskStatus.completed, start, start + timedelta(seconds=30)))

    result = service.get_analytics("default")

    assert result.tasks_completed == 2
    assert result.avg_completion_time == "20s"


def test_get_analytics_skips_completed_tasks_missing_start_or_end_time(tmp_path):
    service, task_repo = _make_service(tmp_path)
    start = datetime.now(timezone.utc)
    task_repo.upsert(_make_task("no_start", "default", TaskStatus.completed, None, start))
    task_repo.upsert(_make_task("no_end", "default", TaskStatus.completed, start, None))

    result = service.get_analytics("default")

    # Both are still counted as "completed" (status-based), but contribute no
    # duration data — so tasks_completed reflects them while avg falls back to "-".
    assert result.tasks_completed == 2
    assert result.avg_completion_time == "-"


def test_get_analytics_handles_naive_datetimes(tmp_path):
    """start_time/end_time can be tz-naive (e.g. parsed from legacy storage); the
    service must normalize both to UTC before diffing, not crash or misdate."""
    service, task_repo = _make_service(tmp_path)
    naive_start = datetime(2026, 1, 1, 10, 0, 0)
    naive_end = datetime(2026, 1, 1, 10, 1, 0)
    task_repo.upsert(_make_task("t1", "default", TaskStatus.completed, naive_start, naive_end))

    result = service.get_analytics("default")

    assert result.avg_completion_time == "1m 0s"
