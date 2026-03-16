from __future__ import annotations

from pydantic import BaseModel


class AnalyticsSchema(BaseModel):
    tasksCompleted: int
    avgCompletionTime: str
    teamEfficiency: int
    agentProductivity: dict[str, int]

    @staticmethod
    def from_domain(a) -> "AnalyticsSchema":
        return AnalyticsSchema(
            tasksCompleted=a.tasks_completed,
            avgCompletionTime=a.avg_completion_time,
            teamEfficiency=a.team_efficiency,
            agentProductivity=dict(a.agent_productivity),
        )
