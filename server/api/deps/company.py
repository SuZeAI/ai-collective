from __future__ import annotations

from server.api.deps._core import _repos
from server.api.deps.documents import get_document_library_service
from server.api.deps.projects import get_project_service
from server.api.deps.staff import (
    get_department_service,
    get_skill_service,
    get_staff_service,
    get_task_service,
)
from server.app.service.company_service import CompanyService
from server.app.service.connection_service import ConnectionService


def get_company_service() -> CompanyService:
    return CompanyService(
        _repos().companies,
        get_department_service(),
        get_staff_service(),
        get_skill_service(),
        get_task_service(),
        get_document_library_service(),
        get_project_service(),
    )


def get_connection_service() -> ConnectionService:
    return ConnectionService(_repos().connections)
