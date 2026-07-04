from __future__ import annotations

from datetime import datetime, timezone

from backend.application.ports.repositories import AnalyticsRepository, TaskRepository
from backend.domain.enums import TaskStatus
from backend.domain.models import Analytics, is_owned_by


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository, tasks: TaskRepository):
        self._repo = repo
        self._tasks = tasks

    def get_analytics(self, owner_id: str) -> Analytics:
        # team_efficiency/agent_productivity come from a single global
        # singleton document (no per-owner data model exists for them);
        # tasks_completed/avg_completion_time are computed live and are
        # scoped to the caller's own tasks so one owner can't infer another
        # owner's task volume/throughput.
        base = self._repo.get()
        tasks = [t for t in self._tasks.list() if is_owned_by(owner_id, t.owner_id)]

        completed_tasks = [t for t in tasks if t.status == TaskStatus.completed]
        durations_ms: list[int] = []

        for task in completed_tasks:
            if not task.start_time or not task.end_time:
                continue
            start = self._to_utc(task.start_time)
            end = self._to_utc(task.end_time)
            elapsed = int((end - start).total_seconds() * 1000)
            if elapsed > 0:
                durations_ms.append(elapsed)

        avg_completion_time = "-"
        if durations_ms:
            avg_ms = sum(durations_ms) // len(durations_ms)
            avg_completion_time = self._format_duration(avg_ms)

        return Analytics(
            tasks_completed=len(completed_tasks),
            avg_completion_time=avg_completion_time,
            team_efficiency=base.team_efficiency,
            agent_productivity=base.agent_productivity,
        )

    @staticmethod
    def _to_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _format_duration(ms: int) -> str:
        if ms <= 0:
            return "0s"
        total_seconds = ms // 1000
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        if minutes > 0:
            return f"{minutes}m {seconds}s"
        return f"{seconds}s"
