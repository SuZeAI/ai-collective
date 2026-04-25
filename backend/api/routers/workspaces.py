from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Request

from backend.api.deps import get_workspace_service
from backend.api.schemas.workspace import WorkspaceSchema, UpsertWorkspaceRequest
from backend.application.service.workspace_service import WorkspaceService
from backend.domain.models import PlatformHook, Workspace
from backend.domain.thirty_part.registry import list_platforms

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceSchema])
def list_workspaces(service: WorkspaceService = Depends(get_workspace_service)):
    return [WorkspaceSchema.from_domain(w) for w in service.list_workspaces()]


@router.post("", response_model=WorkspaceSchema)
def upsert_workspace(
    req: UpsertWorkspaceRequest,
    service: WorkspaceService = Depends(get_workspace_service),
):
    ws_id = req.id or f"ws_{uuid4().hex}"
    hooks = [
        PlatformHook(
            id=h.id or f"hook_{uuid4().hex}",
            platform=h.platform,
            name=h.name,
            config=dict(h.config or {}),
            description=h.description or "",
            enabled=h.enabled,
        )
        for h in (req.platformHooks or [])
    ]
    existing = service._repo.get(ws_id)
    created_at = existing.created_at if existing else datetime.now(timezone.utc)
    workspace = Workspace(
        id=ws_id,
        name=req.name,
        description=req.description or "",
        team_ids=list(req.teamIds or []),
        primary_team_id=req.primaryTeamId or "",
        platform_hooks=hooks,
        created_at=created_at,
        avatar=(req.avatar or "").strip() or req.name[:1].upper() or "W",
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
    )
    saved = service.upsert_workspace(workspace)
    return WorkspaceSchema.from_domain(saved)


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    service: WorkspaceService = Depends(get_workspace_service),
):
    service.delete_workspace(workspace_id)
    return {"deleted": True}


@router.get("/platforms")
def get_platforms():
    """Return all supported platform definitions and their config field schemas."""
    return list_platforms()


@router.get("/{workspace_id}", response_model=WorkspaceSchema)
def get_workspace(
    workspace_id: str,
    service: WorkspaceService = Depends(get_workspace_service),
):
    return WorkspaceSchema.from_domain(service.get_workspace(workspace_id))
