from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.api.deps import (
    STORAGE_DIR,
    _llm_provider,
    _resolve_active_model_config,
    current_user_dep,
    get_monitoring_service,
    get_system_settings_repository,
    refresh_llm_provider,
)
from backend.api.schemas.admin import (
    ActiveModelSchema,
    EntityCountsSchema,
    FileStorageStatsSchema,
    LLMHealthSchema,
    ModelPricingSchema,
    RequestMetricsSchema,
    StorageHealthSchema,
    SystemHealthSchema,
    UsageSummarySchema,
    UserActivitySchema,
)
from backend.api.settings import settings
from backend.application.service.monitoring_service import MonitoringService
from backend.infrastructure.llm.config import get_enabled_models
from backend.infrastructure.llm.factory import DEFAULT_PROVIDER_MODELS
from backend.infrastructure.monitoring import request_metrics


router = APIRouter(prefix="/admin/monitoring", tags=["admin"])


def require_admin(user=Depends(current_user_dep)):
    """Only users with the admin (or legacy system) role may hit /admin/*."""
    if getattr(user, "role", "") not in ("admin", "system"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user


@router.get("/usage", response_model=UsageSummarySchema)
def get_usage(
    days: int = Query(default=30, ge=1, le=365),
    _: object = Depends(require_admin),
    service: MonitoringService = Depends(get_monitoring_service),
) -> UsageSummarySchema:
    return UsageSummarySchema.from_summary(service.get_usage_summary(days))


@router.get("/pricing", response_model=list[ModelPricingSchema])
def list_pricing(
    _: object = Depends(require_admin),
    service: MonitoringService = Depends(get_monitoring_service),
) -> list[ModelPricingSchema]:
    return [ModelPricingSchema.from_domain(p) for p in service.list_pricing()]


@router.put("/pricing", response_model=ModelPricingSchema)
def upsert_pricing(
    payload: ModelPricingSchema,
    _: object = Depends(require_admin),
    service: MonitoringService = Depends(get_monitoring_service),
) -> ModelPricingSchema:
    return ModelPricingSchema.from_domain(service.upsert_pricing(payload.to_domain()))


@router.put("/active-model", response_model=ActiveModelSchema)
def set_active_model(
    payload: ActiveModelSchema,
    _: object = Depends(require_admin),
) -> ActiveModelSchema:
    """Switch the app-wide active LLM model (Settings UI). Must name a
    `models:` entry with `enabled: true` in config.yml; persists via
    SystemSettingsRepository and drops the cached LLM provider so the next
    call rebuilds it against the new model."""
    name = payload.name.strip()
    enabled_names = {m.name for m in get_enabled_models()}
    if name not in enabled_names:
        raise HTTPException(
            status_code=422,
            detail=f"'{name}' is not an enabled model. Enabled: {sorted(enabled_names)}",
        )
    get_system_settings_repository().set_active_model(name)
    refresh_llm_provider()
    return ActiveModelSchema(name=name)


# Model is a query param (not a path segment) because OpenRouter-style model
# ids contain slashes (e.g. "qwen/qwen3...").
@router.delete("/pricing")
def delete_pricing(
    model: str = Query(...),
    _: object = Depends(require_admin),
    service: MonitoringService = Depends(get_monitoring_service),
) -> dict[str, bool]:
    service.delete_pricing(model)
    return {"deleted": True}


@router.get("/users", response_model=list[UserActivitySchema])
def get_user_activity(
    days: int = Query(default=30, ge=1, le=365),
    _: object = Depends(require_admin),
    service: MonitoringService = Depends(get_monitoring_service),
) -> list[UserActivitySchema]:
    return [UserActivitySchema.from_activity(a) for a in service.get_user_activity(days)]


def _check_storage() -> StorageHealthSchema:
    backend = settings.storage_backend
    if backend == "mongo":
        try:
            import pymongo

            client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
            client.admin.command("ping")
            return StorageHealthSchema(backend="mongo", ok=True, detail=settings.mongo_db)
        except Exception as e:
            return StorageHealthSchema(backend="mongo", ok=False, detail=str(e))
    try:
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        ok = STORAGE_DIR.is_dir()
        return StorageHealthSchema(backend="json", ok=ok, detail=str(STORAGE_DIR))
    except Exception as e:
        return StorageHealthSchema(backend="json", ok=False, detail=str(e))


@router.get("/file-storage", response_model=FileStorageStatsSchema)
def get_file_storage(
    _: object = Depends(require_admin),
) -> FileStorageStatsSchema:
    """File byte-store status: local⇄s3 backend, MinIO connectivity, and usage."""
    from backend.infrastructure.storage.file_store import workspace_base

    backend = settings.file_storage_backend
    minio_cfg = settings.minio

    # Library metadata (cheap, accurate — from the repository).
    lib_count, lib_bytes = 0, 0
    try:
        from backend.api.deps import _library_document_store

        docs = _library_document_store().list()
        lib_count = len(docs)
        lib_bytes = sum(int(getattr(d, "size", 0) or 0) for d in docs)
    except Exception:  # noqa: BLE001
        pass

    connected = False
    minio_error = ""
    sb_count = sb_bytes = lib_obj_count = lib_obj_bytes = 0
    if backend == "s3" and minio_cfg.enabled:
        try:
            from backend.infrastructure.sandbox.backup import create_backup_service

            sandbox_store = create_backup_service(key_root="sandbox")
            connected = sandbox_store.ping()
            if connected:
                sb_count, sb_bytes = sandbox_store.usage()
                lib_obj_count, lib_obj_bytes = create_backup_service(key_root="library").usage()
            else:
                minio_error = "Cannot reach MinIO bucket (is `make dev PROFILES=minio` running?)"
        except Exception as e:  # noqa: BLE001
            minio_error = str(e)

    return FileStorageStatsSchema(
        backend=backend,
        sandboxMode=settings.sandbox_mode,
        workspaceBase=workspace_base(),
        minioEnabled=minio_cfg.enabled,
        minioConnected=connected,
        minioEndpoint=minio_cfg.endpoint if minio_cfg.enabled else "",
        minioBucket=minio_cfg.bucket if minio_cfg.enabled else "",
        minioError=minio_error,
        libraryDocCount=lib_count,
        libraryTotalBytes=lib_bytes,
        sandboxObjectCount=sb_count,
        sandboxTotalBytes=sb_bytes,
        libraryObjectCount=lib_obj_count,
        libraryObjectBytes=lib_obj_bytes,
    )


@router.get("/health", response_model=SystemHealthSchema)
def get_system_health(
    _: object = Depends(require_admin),
    service: MonitoringService = Depends(get_monitoring_service),
) -> SystemHealthSchema:
    storage = _check_storage()

    try:
        llm_configured = _llm_provider() is not None
    except Exception:
        llm_configured = False
    active = _resolve_active_model_config()
    if active is not None:
        llm = LLMHealthSchema(provider=active.provider_name or "", model=active.model, configured=llm_configured)
    else:
        llm = LLMHealthSchema(
            provider=settings.llm_provider,
            model=settings.llm_model
            or DEFAULT_PROVIDER_MODELS.get(settings.llm_provider.strip().lower(), ""),
            configured=llm_configured,
        )

    metrics = request_metrics.snapshot()
    counts = service.get_entity_counts()
    healthy = storage.ok and llm.configured

    return SystemHealthSchema(
        status="ok" if healthy else "degraded",
        environment=settings.environment,
        uptimeSeconds=metrics["uptime_seconds"],
        requests=RequestMetricsSchema(
            totalRequests=metrics["total_requests"],
            errorRequests=metrics["error_requests"],
            errorRate=metrics["error_rate"],
            avgLatencyMs=metrics["avg_latency_ms"],
        ),
        storage=storage,
        llm=llm,
        taskQueueBackend=settings.task_queue_backend,
        lockBackend=settings.lock_backend,
        counts=EntityCountsSchema(**counts),
    )
