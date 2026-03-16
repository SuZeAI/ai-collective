from __future__ import annotations

from backend.application.ports.repositories import AnalyticsRepository, TaskRepository
from backend.domain.models import Analytics


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository, tasks: TaskRepository):
        self._repo = repo
        self._tasks = tasks

    def get_analytics(self) -> Analytics:
        # For now we return stored analytics; optionally enrich from tasks.
        return self._repo.get()
