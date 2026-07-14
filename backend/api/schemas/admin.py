from __future__ import annotations

from pydantic import BaseModel

from backend.domain.models import ModelPricing


# ── Token usage ──────────────────────────────────────────────────────────────

class UsageTotalsSchema(BaseModel):
    inputTokens: int
    outputTokens: int
    totalTokens: int
    cacheReadTokens: int = 0
    cacheCreationTokens: int = 0
    requests: int
    cost: float


class ModelUsageSchema(BaseModel):
    model: str
    provider: str = ""
    inputTokens: int
    outputTokens: int
    cacheReadTokens: int = 0
    cacheCreationTokens: int = 0
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
                cacheReadTokens=s["totals"].get("cache_read_tokens", 0),
                cacheCreationTokens=s["totals"].get("cache_creation_tokens", 0),
                requests=s["totals"]["requests"],
                cost=s["totals"]["cost"],
            ),
            byModel=[
                ModelUsageSchema(
                    model=m["model"],
                    provider=m.get("provider", ""),
                    inputTokens=m["input_tokens"],
                    outputTokens=m["output_tokens"],
                    cacheReadTokens=m.get("cache_read_tokens", 0),
                    cacheCreationTokens=m.get("cache_creation_tokens", 0),
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
    staff: int
    departments: int
    tasks: int
    companies: int


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


class FileStorageStatsSchema(BaseModel):
    """File byte-store (uploads / staff outputs / document library) status & usage."""
    backend: str                 # "local" | "s3"
    sandboxMode: str             # local | docker | k8s
    workspaceBase: str
    minioEnabled: bool
    minioConnected: bool
    minioEndpoint: str = ""
    minioBucket: str = ""
    minioError: str = ""
    libraryDocCount: int = 0
    libraryTotalBytes: int = 0
    sandboxObjectCount: int = 0   # objects under sandbox/ in MinIO (s3 mode)
    sandboxTotalBytes: int = 0
    libraryObjectCount: int = 0   # objects under library/ in MinIO (s3 mode)
    libraryObjectBytes: int = 0


# ── User activity ────────────────────────────────────────────────────────────

class UserActivitySchema(BaseModel):
    id: str
    name: str
    email: str
    role: str
    provider: str
    joinedAt: str
    staff: int
    departments: int
    tasks: int
    companies: int
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
            staff=a["staff"],
            departments=a["departments"],
            tasks=a["tasks"],
            companies=a["companies"],
            inputTokens=a["input_tokens"],
            outputTokens=a["output_tokens"],
            requests=a["requests"],
            cost=a["cost"],
        )
