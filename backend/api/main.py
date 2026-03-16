from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.settings import settings
from backend.domain.errors import NotFoundError, ValidationError
from backend.api.routers import (
    activity_feed,
    agents,
    analytics,
    conversations,
    health,
    llm,
    simulations,
    skills,
    tasks,
    teams,
)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"] ,
        allow_headers=["*"],
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
    app.include_router(conversations.router, prefix=settings.api_prefix)
    app.include_router(analytics.router, prefix=settings.api_prefix)
    app.include_router(simulations.router, prefix=settings.api_prefix)
    app.include_router(llm.router, prefix=settings.api_prefix)
    return app


app = create_app()
