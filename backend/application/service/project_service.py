from __future__ import annotations

from backend.application.ports.repositories import ProjectRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Project


class ProjectService:
    def __init__(self, repo: ProjectRepository):
        self._repo = repo

    def list_projects(self) -> list[Project]:
        return self._repo.list()

    def try_get_project(self, project_id: str) -> Project | None:
        return self._repo.get(project_id)

    def get_project(self, project_id: str) -> Project:
        project = self.try_get_project(project_id)
        if not project:
            raise NotFoundError(f"Project '{project_id}' not found")
        return project

    def upsert_project(self, project: Project) -> Project:
        return self._repo.upsert(project)

    def delete_project(self, project_id: str) -> None:
        if not self.try_get_project(project_id):
            raise NotFoundError(f"Project '{project_id}' not found")
        self._repo.delete(project_id)

    def allocate_issue_number(self, project_id: str) -> int:
        return self._repo.allocate_issue_number(project_id)
