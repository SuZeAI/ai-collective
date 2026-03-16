from __future__ import annotations

from backend.application.ports.repositories import TaskRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Task


class TaskService:
    def __init__(self, repo: TaskRepository):
        self._repo = repo

    def list_tasks(self) -> list[Task]:
        return self._repo.list()

    def get_task(self, task_id: str) -> Task:
        task = self._repo.get(task_id)
        if not task:
            raise NotFoundError(f"Task '{task_id}' not found")
        return task

    def upsert_task(self, task: Task) -> Task:
        return self._repo.upsert(task)

    def delete_task(self, task_id: str) -> None:
        if not self._repo.get(task_id):
            raise NotFoundError(f"Task '{task_id}' not found")
        self._repo.delete(task_id)
