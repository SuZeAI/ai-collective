from __future__ import annotations

import threading

from backend.domain.models import Analytics
from backend.infrastructure.repositories.json_store import JsonFileStore


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
            team_efficiency=int(data.get("teamEfficiency", 0)),
            agent_productivity={str(k): int(v) for k, v in (data.get("agentProductivity") or {}).items()},
        )

    def _persist(self) -> None:
        self._store.write(
            {
                "tasksCompleted": self._analytics.tasks_completed,
                "avgCompletionTime": self._analytics.avg_completion_time,
                "teamEfficiency": self._analytics.team_efficiency,
                "agentProductivity": dict(self._analytics.agent_productivity),
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
