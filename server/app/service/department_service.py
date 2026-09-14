from __future__ import annotations

from server.app.ports.repositories import DepartmentRepository
from server.app.service._helpers import get_or_raise
from server.domain.models import Department


class DepartmentService:
    def __init__(self, repo: DepartmentRepository):
        self._repo = repo

    def list_departments(self) -> list[Department]:
        return self._repo.list()

    def try_get_department(self, department_id: str) -> Department | None:
        return self._repo.get(department_id)

    def get_department(self, department_id: str) -> Department:
        return get_or_raise(self.try_get_department, "Department", department_id)

    def upsert_department(self, department: Department) -> Department:
        return self._repo.upsert(department)

    def delete_department(self, department_id: str) -> None:
        get_or_raise(self.try_get_department, "Department", department_id)
        self._repo.delete(department_id)
