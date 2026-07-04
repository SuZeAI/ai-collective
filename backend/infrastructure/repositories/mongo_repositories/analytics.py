from __future__ import annotations

import pymongo

from backend.domain.models import Analytics


class MongoAnalyticsRepository:
    _SINGLETON_ID = "singleton"

    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["analytics"]

    def _load(self) -> Analytics:
        doc = self._col.find_one({"_id": self._SINGLETON_ID}) or {}
        return Analytics(
            tasks_completed=int(doc.get("tasksCompleted", 0)),
            avg_completion_time=str(doc.get("avgCompletionTime", "")),
            department_efficiency=int(doc.get("teamEfficiency", 0)),
            staff_productivity={str(k): int(v) for k, v in (doc.get("agentProductivity") or {}).items()},
        )

    def get(self) -> Analytics:
        return self._load()

    def set(self, analytics: Analytics) -> Analytics:
        self._col.replace_one(
            {"_id": self._SINGLETON_ID},
            {
                "_id": self._SINGLETON_ID,
                "tasksCompleted": analytics.tasks_completed,
                "avgCompletionTime": analytics.avg_completion_time,
                "teamEfficiency": analytics.department_efficiency,
                "agentProductivity": dict(analytics.staff_productivity),
            },
            upsert=True,
        )
        return analytics
