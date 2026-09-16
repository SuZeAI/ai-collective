from __future__ import annotations

import threading

from server.domain.models import Analytics
from server.infra.repositories.json_store import JsonFileStore


class JsonAnalyticsRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, dict):
            data = {}
        self._analytics = Analytics(
            tasks_completed=int(data.get("tasksCompleted", 0)),
            avg_completion_time=str(data.get("avgCompletionTime", "")),
            department_efficiency=int(data.get("teamEfficiency", 0)),
            staff_productivity={str(k): int(v) for k, v in (data.get("agentProductivity") or {}).items()},
        )

    def _persist(self) -> None:
        self._store.write(
            {
                "tasksCompleted": self._analytics.tasks_completed,
                "avgCompletionTime": self._analytics.avg_completion_time,
                "teamEfficiency": self._analytics.department_efficiency,
                "agentProductivity": dict(self._analytics.staff_productivity),
            }
        )

    def get(self) -> Analytics:
        with self._lock:
            return self._analytics

    def set(self, analytics: Analytics) -> Analytics:
        with self._lock:
            self._analytics = analytics
            self._persist()
        return analytics
