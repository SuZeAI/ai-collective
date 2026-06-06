from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.api.deps import current_owner_id_dep, get_workspace_service
from backend.api.schemas.workspace import WorkspaceSchema, UpsertWorkspaceRequest
from backend.application.service.workspace_service import WorkspaceService
from backend.domain.errors import NotFoundError
from backend.domain.models import PlatformHook, Workspace, can_delete, is_visible_to
from backend.domain.thirty_part.registry import list_platforms

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceSchema])
def list_workspaces(
    service: WorkspaceService = Depends(get_workspace_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    return [
        WorkspaceSchema.from_domain(w)
        for w in service.list_workspaces()
        if is_visible_to(owner_id, w.owner_id)
    ]


@router.post("", response_model=WorkspaceSchema)
def upsert_workspace(
    req: UpsertWorkspaceRequest,
    service: WorkspaceService = Depends(get_workspace_service),
    owner_id: str = Depends(current_owner_id_dep),
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
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Workspace {ws_id!r} not found")
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
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_workspace(workspace)
    return WorkspaceSchema.from_domain(saved)


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    service: WorkspaceService = Depends(get_workspace_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    existing = service._repo.get(workspace_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Workspace {workspace_id!r} not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")
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
    owner_id: str = Depends(current_owner_id_dep),
):
    workspace = service.get_workspace(workspace_id)
    if not is_visible_to(owner_id, workspace.owner_id):
        raise NotFoundError(f"Workspace {workspace_id!r} not found")
    return WorkspaceSchema.from_domain(workspace)
