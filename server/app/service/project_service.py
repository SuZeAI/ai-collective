from __future__ import annotations

from server.app.ports.repositories import ProjectRepository
from server.app.service._helpers import get_or_raise
from server.domain.models import Project


class ProjectService:
    def __init__(self, repo: ProjectRepository):
        self._repo = repo

    def list_projects(self) -> list[Project]:
        return self._repo.list()

    def try_get_project(self, project_id: str) -> Project | None:
        return self._repo.get(project_id)

    def get_project(self, project_id: str) -> Project:
        return get_or_raise(self.try_get_project, "Project", project_id)

    def upsert_project(self, project: Project) -> Project:
        return self._repo.upsert(project)

    def delete_project(self, project_id: str) -> None:
        get_or_raise(self.try_get_project, "Project", project_id)
        self._repo.delete(project_id)

    def allocate_issue_number(self, project_id: str) -> int:
        return self._repo.allocate_issue_number(project_id)
