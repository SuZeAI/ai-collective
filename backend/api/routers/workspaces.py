from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

import logging

from backend.api.deps import (
    current_owner_id_dep,
    get_document_library_service,
    get_office_builder_session_service,
    get_team_service,
    get_workspace_service,
)
from backend.api.schemas.workspace import WorkspaceSchema, UpsertWorkspaceRequest
from backend.application.service.document_library_service import DocumentLibraryService
from backend.application.service.office_builder_session_service import OfficeBuilderSessionService
from backend.application.service.team_service import TeamService
from backend.application.service.workspace_service import WorkspaceService
from backend.domain.errors import NotFoundError
from backend.domain.models import PlatformHook, Workspace, can_delete, can_modify, is_visible_to
from backend.domain.thirty_part.registry import list_platforms

logger = logging.getLogger(__name__)

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
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can edit shared default items")
    created_at = existing.created_at if existing else datetime.now(timezone.utc)
    workspace = Workspace(
        id=ws_id,
        name=req.name,
        description=req.description or "",
        team_ids=list(req.teamIds or []),
        primary_team_id=req.primaryTeamId or "",
        platform_hooks=hooks,
        created_at=created_at,
        company_type=(req.type or (existing.company_type if existing else None) or "general"),
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
    documents: DocumentLibraryService = Depends(get_document_library_service),
    office_sessions: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
    teams: TeamService = Depends(get_team_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    existing = service._repo.get(workspace_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Workspace {workspace_id!r} not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")

    # Cascade: remove everything that belongs to this company so no orphans are
    # left behind. Each cleanup is best-effort — a failure on related data must
    # not block deleting the workspace itself.

    # Departments (teams) that are still referenced by another company must be
    # kept — they are shared. Only delete the ones unique to this company.
    other_team_ids: set[str] = set()
    for ws in service.list_workspaces():
        if ws.id == workspace_id:
            continue
        other_team_ids.update(ws.team_ids)

    removed_teams = 0
    if existing is not None:
        own_team_ids = set(existing.team_ids)
        for team in teams.list_teams():
            if team.id not in own_team_ids or team.id in other_team_ids:
                continue
            if not can_delete(owner_id, team.owner_id):
                continue
            try:
                teams.delete_team(team.id)
                removed_teams += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("failed to delete team %s for workspace %s: %s", team.id, workspace_id, exc)

    removed_documents = 0
    for doc in documents.list_documents():
        if doc.workspace_id != workspace_id:
            continue
        try:
            documents.delete_document(doc)
            removed_documents += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete document %s for workspace %s: %s", doc.id, workspace_id, exc)

    removed_sessions = 0
    for session in office_sessions.list_sessions():
        if session.workspace_id != workspace_id:
            continue
        try:
            office_sessions.delete_session(session.id)
            removed_sessions += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete office-builder session %s for workspace %s: %s", session.id, workspace_id, exc)

    service.delete_workspace(workspace_id)
    return {
        "deleted": True,
        "removed_teams": removed_teams,
        "removed_documents": removed_documents,
        "removed_office_builder_sessions": removed_sessions,
    }


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
