from __future__ import annotations
import os
from pathlib import Path
import dotenv

# Allow OAuth 2 on http://localhost for development (must be set before importing google_auth_oauthlib)
if os.environ.get("ENVIRONMENT", "development") == "development":
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

dotenv.load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.api.settings import settings
from backend.domain.errors import NotFoundError, ValidationError
from backend.api.routers import (
    activity_feed,
    admin_monitoring,
    agents,
    analytics,
    auth,
    connections,
    conversations,
    documents,
    health,
    llm,
    marketplace,
    office_builder,
    simulations,
    skills,
    tasks,
    teams,
    workspaces,
    webhook,
)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    # Persist LLM token usage from the very first request (admin monitoring).
    from backend.api.deps import init_usage_tracking
    init_usage_tracking()

    @app.on_event("startup")
    async def _bootstrap_store() -> None:
        """Seed the admin (from ADMIN_* env) and the default agents/skills/teams
        catalog into the store, so a fresh clone comes up ready to use."""
        from backend.api.deps import seed_admin_user, seed_default_data
        from backend.infrastructure.extensions.mcp_loader import seed_mcp_extensions
        seed_admin_user()
        seed_default_data()
        seed_mcp_extensions()

    @app.middleware("http")
    async def _monitoring_middleware(request, call_next):
        """Attribute LLM usage to the calling user + collect request metrics."""
        import time as _time

        from backend.infrastructure.llm.usage_tracker import current_usage_user
        from backend.infrastructure.monitoring import request_metrics

        user_id = "guest"
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                from backend.api.security import decode_access_token
                user_id = str(decode_access_token(authorization.split(" ", 1)[1]).get("sub") or "guest")
            except Exception:
                pass

        token = current_usage_user.set(user_id)
        start = _time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            current_usage_user.reset(token)
            request_metrics.record(status_code, (_time.perf_counter() - start) * 1000)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        # Explicit method/header allow-lists instead of wildcards. With
        # allow_credentials=True a wildcard is both insecure and ignored by the
        # browser anyway.
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    )

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    async def validation_handler(_, exc: ValidationError):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    app.include_router(health.router, prefix=settings.api_prefix)
    app.include_router(activity_feed.router, prefix=settings.api_prefix)
    app.include_router(agents.router, prefix=settings.api_prefix)
    app.include_router(skills.router, prefix=settings.api_prefix)
    app.include_router(teams.router, prefix=settings.api_prefix)
    app.include_router(tasks.router, prefix=settings.api_prefix)
    app.include_router(marketplace.router, prefix=settings.api_prefix)
    app.include_router(conversations.router, prefix=settings.api_prefix)
    app.include_router(documents.router, prefix=settings.api_prefix)
    app.include_router(analytics.router, prefix=settings.api_prefix)
    app.include_router(simulations.router, prefix=settings.api_prefix)
    app.include_router(llm.router, prefix=settings.api_prefix)
    app.include_router(office_builder.router, prefix=settings.api_prefix)
    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(workspaces.router, prefix=settings.api_prefix)
    app.include_router(connections.router, prefix=settings.api_prefix)
    app.include_router(webhook.router, prefix=settings.api_prefix)
    app.include_router(admin_monitoring.router, prefix=settings.api_prefix)

    static_dir = Path("static")
    static_dir.mkdir(exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")

    @app.on_event("shutdown")
    async def _shutdown_task_queue() -> None:
        from backend.infrastructure import task_queue
        task_queue.shutdown()

    return app


app = create_app()
