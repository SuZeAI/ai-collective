from __future__ import annotations

from backend.app.ports.repositories import ConnectionRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Connection


class ConnectionService:
    def __init__(self, repo: ConnectionRepository):
        self._repo = repo

    def list_connections(
        self, company_id: str | None = None, kind: str | None = None
    ) -> list[Connection]:
        items = self._repo.list()
        if company_id is not None:
            items = [c for c in items if (c.company_id or "") == company_id]
        if kind is not None:
            items = [c for c in items if (c.kind or "outbound") == kind]
        return items

    def get_connection(self, conn_id: str) -> Connection:
        conn = self._repo.get(conn_id)
        if conn is None:
            raise NotFoundError(f"Connection {conn_id!r} not found")
        return conn

    def upsert_connection(self, conn: Connection) -> Connection:
        return self._repo.upsert(conn)

    def delete_connection(self, conn_id: str) -> None:
        self._repo.delete(conn_id)
