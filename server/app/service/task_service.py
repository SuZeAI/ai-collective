from __future__ import annotations

from server.app.ports.repositories import TaskRepository
from server.app.service._helpers import get_or_raise
from server.domain.models import Task


class TaskService:
    def __init__(self, repo: TaskRepository):
        self._repo = repo

    def list_tasks(self) -> list[Task]:
        return self._repo.list()

    def try_get_task(self, task_id: str) -> Task | None:
        return self._repo.get(task_id)

    def get_task(self, task_id: str) -> Task:
        return get_or_raise(self.try_get_task, "Task", task_id)

    def upsert_task(self, task: Task) -> Task:
        return self._repo.upsert(task)

    def delete_task(self, task_id: str) -> None:
        get_or_raise(self.try_get_task, "Task", task_id)
        self._repo.delete(task_id)
