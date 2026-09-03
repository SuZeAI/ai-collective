from __future__ import annotations

from pydantic import BaseModel


class AnalyticsSchema(BaseModel):
    tasksCompleted: int
    avgCompletionTime: str
    departmentEfficiency: int
    staffProductivity: dict[str, int]

    @staticmethod
    def from_domain(a) -> "AnalyticsSchema":
        return AnalyticsSchema(
            tasksCompleted=a.tasks_completed,
            avgCompletionTime=a.avg_completion_time,
            departmentEfficiency=a.department_efficiency,
            staffProductivity=dict(a.staff_productivity),
        )
