from __future__ import annotations
import os
from pathlib import Path
import dotenv

from server.api.settings import settings

# Allow OAuth 2 on http://localhost for development (must be set before importing google_auth_oauthlib)
if settings.environment == "development":
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

dotenv.load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server.domain.errors import NotFoundError, ValidationError
from server.share.log import get_logger
from server.api.routers import (
    activity_feed,
    admin_monitoring,
    staff,
    analytics,
    auth,
    connections,
    consumption,
    meetings,
    documents,
    epics,
    health,
    llm,
    recruiting,
    office_builder,
    planner,
    projects,
    simulations,
    skills,
    sprints,
    tasks,
    departments,
    companies,
    webhook,
)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    # Persist LLM token usage from the very first request (admin monitoring).
    from server.api.deps import init_usage_tracking
    init_usage_tracking()

    @app.on_event("startup")
    async def _bootstrap_store() -> None:
        """Seed the admin (from ADMIN_* env) and the default agents/skills/teams
        catalog into the store, so a fresh clone comes up ready to use."""
        from server.api.deps import seed_admin_user, seed_default_data
        seed_admin_user()
        seed_default_data()

    @app.middleware("http")
    async def _monitoring_middleware(request, call_next):
        """Attribute LLM usage to the calling user + collect request metrics."""
        import time as _time

        from server.infra.llm.usage_tracker import current_usage_user
        from server.infra.monitoring import request_metrics

        user_id = "guest"
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                from server.api.security import decode_access_token
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

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_, exc: Exception):
        # Catch-all so unexpected errors (ValueError, KeyError, etc. that
        # aren't NotFoundError/ValidationError) return a structured 500
        # instead of falling through to FastAPI's bare default response.
        get_logger(__name__).exception("Unhandled exception", exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.include_router(health.router, prefix=settings.api_prefix)
    app.include_router(activity_feed.router, prefix=settings.api_prefix)
    app.include_router(staff.router, prefix=settings.api_prefix)
    app.include_router(skills.router, prefix=settings.api_prefix)
    app.include_router(departments.router, prefix=settings.api_prefix)
    app.include_router(tasks.router, prefix=settings.api_prefix)
    app.include_router(projects.router, prefix=settings.api_prefix)
    app.include_router(epics.router, prefix=settings.api_prefix)
    app.include_router(sprints.router, prefix=settings.api_prefix)
    app.include_router(planner.router, prefix=settings.api_prefix)
    app.include_router(recruiting.router, prefix=settings.api_prefix)
    app.include_router(meetings.router, prefix=settings.api_prefix)
    app.include_router(documents.router, prefix=settings.api_prefix)
    app.include_router(analytics.router, prefix=settings.api_prefix)
    app.include_router(consumption.router, prefix=settings.api_prefix)
    app.include_router(simulations.router, prefix=settings.api_prefix)
    app.include_router(llm.router, prefix=settings.api_prefix)
    app.include_router(office_builder.router, prefix=settings.api_prefix)
    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(companies.router, prefix=settings.api_prefix)
    app.include_router(connections.router, prefix=settings.api_prefix)
    app.include_router(webhook.router, prefix=settings.api_prefix)
    app.include_router(admin_monitoring.router, prefix=settings.api_prefix)

    static_dir = Path("static")
    static_dir.mkdir(exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")

    @app.on_event("shutdown")
    async def _shutdown_task_queue() -> None:
        from server.infra import task_queue
        task_queue.shutdown()

    return app


app = create_app()
