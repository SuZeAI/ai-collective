from __future__ import annotations

from pydantic import BaseModel


# Per-user token/cost consumption, broken down by department (team), staff
# (staff) and human (user). Powers the Cost Monitoring page. Mirrors the camelCase
# shape used by the admin monitoring schemas.


class ConsumptionTotalsSchema(BaseModel):
    inputTokens: int
    outputTokens: int
    totalTokens: int
    cacheReadTokens: int = 0
    cacheCreationTokens: int = 0
    requests: int
    cost: float


class DepartmentConsumptionSchema(BaseModel):
    departmentId: str
    name: str
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float


class StaffConsumptionSchema(BaseModel):
    staffName: str
    name: str
    role: str = ""
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float


class UserConsumptionSchema(BaseModel):
    userId: str
    name: str
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float


class DailyConsumptionSchema(BaseModel):
    date: str
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float


class ConsumptionSchema(BaseModel):
    days: int
    totals: ConsumptionTotalsSchema
    byDepartment: list[DepartmentConsumptionSchema]
    byStaff: list[StaffConsumptionSchema]
    byUser: list[UserConsumptionSchema]
    byDay: list[DailyConsumptionSchema]

    @staticmethod
    def from_summary(s: dict) -> "ConsumptionSchema":
        return ConsumptionSchema(
            days=s["days"],
            totals=ConsumptionTotalsSchema(
                inputTokens=s["totals"]["input_tokens"],
                outputTokens=s["totals"]["output_tokens"],
                totalTokens=s["totals"]["total_tokens"],
                cacheReadTokens=s["totals"].get("cache_read_tokens", 0),
                cacheCreationTokens=s["totals"].get("cache_creation_tokens", 0),
                requests=s["totals"]["requests"],
                cost=s["totals"]["cost"],
            ),
            byDepartment=[
                DepartmentConsumptionSchema(
                    departmentId=t["department_id"],
                    name=t["name"],
                    inputTokens=t["input_tokens"],
                    outputTokens=t["output_tokens"],
                    requests=t["requests"],
                    cost=t["cost"],
                )
                for t in s["by_department"]
            ],
            byStaff=[
                StaffConsumptionSchema(
                    staffName=a["agent_name"],
                    name=a["name"],
                    role=a.get("role", ""),
                    inputTokens=a["input_tokens"],
                    outputTokens=a["output_tokens"],
                    requests=a["requests"],
                    cost=a["cost"],
                )
                for a in s["by_staff"]
            ],
            byUser=[
                UserConsumptionSchema(
                    userId=u["user_id"],
                    name=u["name"],
                    inputTokens=u["input_tokens"],
                    outputTokens=u["output_tokens"],
                    requests=u["requests"],
                    cost=u["cost"],
                )
                for u in s["by_user"]
            ],
            byDay=[
                DailyConsumptionSchema(
                    date=d["date"],
                    inputTokens=d["input_tokens"],
                    outputTokens=d["output_tokens"],
                    requests=d["requests"],
                    cost=d["cost"],
                )
                for d in s["by_day"]
            ],
        )
