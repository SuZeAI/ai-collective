from __future__ import annotations

from backend.application.ports.repositories import WorkspaceRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Workspace


class WorkspaceService:
    def __init__(self, repo: WorkspaceRepository):
        self._repo = repo

    def list_workspaces(self) -> list[Workspace]:
        return self._repo.list()

    def get_workspace(self, workspace_id: str) -> Workspace:
        ws = self._repo.get(workspace_id)
        if ws is None:
            raise NotFoundError(f"Workspace {workspace_id!r} not found")
        return ws

    def upsert_workspace(self, workspace: Workspace) -> Workspace:
        return self._repo.upsert(workspace)

    def delete_workspace(self, workspace_id: str) -> None:
        self._repo.delete(workspace_id)
