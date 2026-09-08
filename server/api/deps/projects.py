from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from server.api.deps._core import _mongo_db, _store
from server.api.settings import settings

if TYPE_CHECKING:
    from server.app.service.project_service import ProjectService
    from server.app.service.epic_service import EpicService
    from server.app.service.sprint_service import SprintService


@lru_cache
def _project_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories import MongoProjectRepository
        return MongoProjectRepository(_mongo_db())
    from server.infra.repositories.json_files import JsonProjectRepository
    return JsonProjectRepository(_store("projects.json"))


def get_project_service() -> "ProjectService":
    from server.app.service.project_service import ProjectService
    return ProjectService(_project_store())


@lru_cache
def _epic_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories import MongoEpicRepository
        return MongoEpicRepository(_mongo_db())
    from server.infra.repositories.json_files import JsonEpicRepository
    return JsonEpicRepository(_store("epics.json"))


def get_epic_service() -> "EpicService":
    from server.app.service.epic_service import EpicService
    return EpicService(_epic_store())


@lru_cache
def _sprint_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories import MongoSprintRepository
        return MongoSprintRepository(_mongo_db())
    from server.infra.repositories.json_files import JsonSprintRepository
    return JsonSprintRepository(_store("sprints.json"))


def get_sprint_service() -> "SprintService":
    from server.app.service.sprint_service import SprintService
    return SprintService(_sprint_store())
