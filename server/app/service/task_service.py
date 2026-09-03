from __future__ import annotations

from server.app.ports.repositories import TaskRepository
from server.domain.errors import NotFoundError
from server.domain.models import Task


class TaskService:
    def __init__(self, repo: TaskRepository):
        self._repo = repo

    def list_tasks(self) -> list[Task]:
        return self._repo.list()

    def try_get_task(self, task_id: str) -> Task | None:
        return self._repo.get(task_id)

    def get_task(self, task_id: str) -> Task:
        task = self.try_get_task(task_id)
        if not task:
            raise NotFoundError(f"Task '{task_id}' not found")
        return task

    def upsert_task(self, task: Task) -> Task:
        return self._repo.upsert(task)

    def delete_task(self, task_id: str) -> None:
        if not self.try_get_task(task_id):
            raise NotFoundError(f"Task '{task_id}' not found")
        self._repo.delete(task_id)
