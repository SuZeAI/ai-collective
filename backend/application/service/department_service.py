from __future__ import annotations

from backend.application.ports.repositories import DepartmentRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Department


class DepartmentService:
    def __init__(self, repo: DepartmentRepository):
        self._repo = repo

    def list_departments(self) -> list[Department]:
        return self._repo.list()

    def try_get_department(self, department_id: str) -> Department | None:
        return self._repo.get(department_id)

    def get_department(self, department_id: str) -> Department:
        department = self.try_get_department(department_id)
        if not department:
            raise NotFoundError(f"Department '{department_id}' not found")
        return department

    def upsert_department(self, department: Department) -> Department:
        return self._repo.upsert(department)

    def delete_department(self, department_id: str) -> None:
        if not self.try_get_department(department_id):
            raise NotFoundError(f"Department '{department_id}' not found")
        self._repo.delete(department_id)
