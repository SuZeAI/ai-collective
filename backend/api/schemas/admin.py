from __future__ import annotations

from pydantic import BaseModel

from backend.domain.models import ModelPricing


# ── Token usage ──────────────────────────────────────────────────────────────

class UsageTotalsSchema(BaseModel):
    inputTokens: int
    outputTokens: int
    totalTokens: int
    requests: int
    cost: float


class ModelUsageSchema(BaseModel):
    model: str
    provider: str = ""
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float
    priced: bool = False


class UserUsageSchema(BaseModel):
    userId: str
    name: str
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float


class DailyUsageSchema(BaseModel):
    date: str
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float


class UsageSummarySchema(BaseModel):
    days: int
    totals: UsageTotalsSchema
    byModel: list[ModelUsageSchema]
    byUser: list[UserUsageSchema]
    byDay: list[DailyUsageSchema]

    @staticmethod
    def from_summary(s: dict) -> "UsageSummarySchema":
        return UsageSummarySchema(
            days=s["days"],
            totals=UsageTotalsSchema(
                inputTokens=s["totals"]["input_tokens"],
                outputTokens=s["totals"]["output_tokens"],
                totalTokens=s["totals"]["total_tokens"],
                requests=s["totals"]["requests"],
                cost=s["totals"]["cost"],
            ),
            byModel=[
                ModelUsageSchema(
                    model=m["model"],
                    provider=m.get("provider", ""),
                    inputTokens=m["input_tokens"],
                    outputTokens=m["output_tokens"],
                    requests=m["requests"],
                    cost=m["cost"],
                    priced=bool(m.get("priced", False)),
                )
                for m in s["by_model"]
            ],
            byUser=[
                UserUsageSchema(
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
                DailyUsageSchema(
                    date=d["date"],
                    inputTokens=d["input_tokens"],
                    outputTokens=d["output_tokens"],
                    requests=d["requests"],
                    cost=d["cost"],
                )
                for d in s["by_day"]
            ],
        )


# ── Pricing ──────────────────────────────────────────────────────────────────

class ModelPricingSchema(BaseModel):
    model: str
    provider: str = ""
    inputPricePerMillion: float
    outputPricePerMillion: float

    @staticmethod
    def from_domain(p: ModelPricing) -> "ModelPricingSchema":
        return ModelPricingSchema(
            model=p.model,
            provider=p.provider,
            inputPricePerMillion=p.input_price_per_million,
            outputPricePerMillion=p.output_price_per_million,
        )

    def to_domain(self) -> ModelPricing:
        return ModelPricing(
            model=self.model.strip(),
            provider=self.provider.strip(),
            input_price_per_million=self.inputPricePerMillion,
            output_price_per_million=self.outputPricePerMillion,
        )


# ── System health ────────────────────────────────────────────────────────────

class RequestMetricsSchema(BaseModel):
    totalRequests: int
    errorRequests: int
    errorRate: float
    avgLatencyMs: float


class StorageHealthSchema(BaseModel):
    backend: str
    ok: bool
    detail: str = ""


class LLMHealthSchema(BaseModel):
    provider: str
    model: str
    configured: bool


class EntityCountsSchema(BaseModel):
    users: int
    agents: int
    teams: int
    tasks: int
    workspaces: int


class SystemHealthSchema(BaseModel):
    status: str
    environment: str
    uptimeSeconds: float
    requests: RequestMetricsSchema
    storage: StorageHealthSchema
    llm: LLMHealthSchema
    taskQueueBackend: str
    lockBackend: str
    counts: EntityCountsSchema


# ── User activity ────────────────────────────────────────────────────────────

class UserActivitySchema(BaseModel):
    id: str
    name: str
    email: str
    role: str
    provider: str
    joinedAt: str
    agents: int
    teams: int
    tasks: int
    workspaces: int
    inputTokens: int
    outputTokens: int
    requests: int
    cost: float

    @staticmethod
    def from_activity(a: dict) -> "UserActivitySchema":
        return UserActivitySchema(
            id=a["id"],
            name=a["name"],
            email=a["email"],
            role=a["role"],
            provider=a["provider"],
            joinedAt=a["joined_at"],
            agents=a["agents"],
            teams=a["teams"],
            tasks=a["tasks"],
            workspaces=a["workspaces"],
            inputTokens=a["input_tokens"],
            outputTokens=a["output_tokens"],
            requests=a["requests"],
            cost=a["cost"],
        )
