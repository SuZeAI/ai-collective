from __future__ import annotations

from functools import lru_cache

from server.api.deps._core import _mongo_db, _repos, _store
from server.api.deps.users import _user_store
from server.api.settings import settings
from server.app.service.llm_service import LLMService
from server.app.service.simulation_service import SimulationService
from server.app.service.staff_graph_service import StaffGraphService
from server.domain.staff.langgraph_custom import LangGraphCustomOrchestrator
from server.domain.staff.langgraph_mesh import MultiAgentMeshOrchestrator
from server.domain.staff.langgraph_orchestrator import LangGraphStaffOrchestrator
from server.domain.staff.langgraph_ring import LangGraphRingOrchestrator
from server.domain.staff.langgraph_supervisor import LangGraphSupervisorOrchestrator
from server.domain.staff.langgraph_tree import LangGraphTreeOrchestrator
from server.infra.llm.config import get_enabled_models, get_model_config
from server.infra.llm.factory import build_default_llm_provider
from server.infra.repositories.json_files import (
    JsonModelPricingRepository,
    JsonSystemSettingsRepository,
    JsonTokenUsageRepository,
)
from server.infra.repositories.mongo_repositories import (
    MongoModelPricingRepository,
    MongoSystemSettingsRepository,
    MongoTokenUsageRepository,
)
from server.share.log import get_logger


@lru_cache
def _monitoring_stores():
    """(TokenUsageRepository, ModelPricingRepository) for the configured backend."""
    if settings.storage_backend == "mongo":
        db = _mongo_db()
        return MongoTokenUsageRepository(db), MongoModelPricingRepository(db)
    return (
        JsonTokenUsageRepository(_store("token_usage.json")),
        JsonModelPricingRepository(_store("model_pricing.json")),
    )


@lru_cache
def get_system_settings_repository():
    """SystemSettingsRepository for the configured backend (active-model override)."""
    if settings.storage_backend == "mongo":
        return MongoSystemSettingsRepository(_mongo_db())
    return JsonSystemSettingsRepository(_store("system_settings.json"))


@lru_cache
def init_usage_tracking() -> bool:
    """Register the global LLM usage recorder against the configured store.

    Called from create_app() and lazily wherever an LLM provider is built, so
    token usage is persisted no matter which entry point fires first.
    """
    import uuid
    from datetime import datetime, timezone

    from server.domain.models import TokenUsageRecord
    from server.infra.llm.usage_tracker import set_usage_recorder

    usage_repo, _ = _monitoring_stores()

    def _record(
        *,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        user_id: str,
        staff_name: str = "",
        department_id: str = "",
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0,
    ) -> None:
        usage_repo.add(
            TokenUsageRecord(
                id=str(uuid.uuid4()),
                provider=provider,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                user_id=user_id or "system",
                timestamp=datetime.now(timezone.utc),
                staff_name=staff_name or "",
                department_id=department_id or "",
                cache_read_tokens=cache_read_tokens,
                cache_creation_tokens=cache_creation_tokens,
            )
        )

    set_usage_recorder(_record)
    return True


def get_monitoring_service():
    from server.app.service.monitoring_service import MonitoringService

    init_usage_tracking()
    usage_repo, pricing_repo = _monitoring_stores()
    repos = _repos()
    return MonitoringService(
        usage=usage_repo,
        pricing=pricing_repo,
        users=_user_store(),
        staff=repos.staff,
        departments=repos.departments,
        tasks=repos.tasks,
        companies=repos.companies,
    )


def _resolve_active_model_config():
    """The active ``models:`` entry: DB override (Settings UI) if it names a
    currently-enabled model, else the config.yml resolution, else None (no
    `models:` entry at all — build_default_llm_provider raises in that case)."""
    enabled = get_enabled_models()
    if enabled:
        try:
            override = get_system_settings_repository().get_active_model()
        except Exception:  # noqa: BLE001 — DB unavailable must not block LLM startup
            override = None
        if override:
            match = next((m for m in enabled if m.name == override), None)
            if match:
                return match
    return get_model_config()


@lru_cache
def _llm_provider():
    init_usage_tracking()
    return build_default_llm_provider(model_config=_resolve_active_model_config())


def refresh_llm_provider() -> None:
    """Drop the cached LLM provider so the next call rebuilds it — call this
    after the Settings-UI active-model override changes."""
    _llm_provider.cache_clear()


def get_simulation_service() -> SimulationService:
    return SimulationService(_llm_provider())


def get_llm_service() -> LLMService | None:
    provider = _llm_provider()
    if not provider:
        return None
    return LLMService(provider)


def get_staff_graph_service(mode: str = "sequential") -> StaffGraphService | None:
    provider = _llm_provider()
    if not provider:
        return None
    if mode == "mesh":
        orchestrator = MultiAgentMeshOrchestrator()
    elif mode == "ring":
        orchestrator = LangGraphRingOrchestrator()
    elif mode == "supervisor":
        orchestrator = LangGraphSupervisorOrchestrator()
    elif mode == "tree":
        orchestrator = LangGraphTreeOrchestrator()
    elif mode == "custom":
        orchestrator = LangGraphCustomOrchestrator()
    else:
        orchestrator = LangGraphStaffOrchestrator()
    get_logger().info(f"{orchestrator.__class__.__name__} selected for mode='{mode}'")
    return StaffGraphService(provider, orchestrator)
