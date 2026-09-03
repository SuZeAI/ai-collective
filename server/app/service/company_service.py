from __future__ import annotations

from server.app.ports.repositories import CompanyRepository
from server.domain.errors import NotFoundError
from server.domain.models import Company


class CompanyService:
    def __init__(self, repo: CompanyRepository):
        self._repo = repo

    def list_companies(self) -> list[Company]:
        return self._repo.list()

    def try_get_company(self, company_id: str) -> Company | None:
        return self._repo.get(company_id)

    def get_company(self, company_id: str) -> Company:
        ws = self.try_get_company(company_id)
        if ws is None:
            raise NotFoundError(f"Company {company_id!r} not found")
        return ws

    def upsert_workspace(self, workspace: Company) -> Company:
        return self._repo.upsert(workspace)

    def delete_company(self, company_id: str) -> None:
        self._repo.delete(company_id)
