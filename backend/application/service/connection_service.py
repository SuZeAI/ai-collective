from __future__ import annotations

from backend.application.ports.repositories import ConnectionRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import ThirdPartyConnection


class ConnectionService:
    def __init__(self, repo: ConnectionRepository):
        self._repo = repo

    def list_connections(self) -> list[ThirdPartyConnection]:
        return self._repo.list()

    def get_connection(self, conn_id: str) -> ThirdPartyConnection:
        conn = self._repo.get(conn_id)
        if conn is None:
            raise NotFoundError(f"Connection {conn_id!r} not found")
        return conn

    def upsert_connection(self, conn: ThirdPartyConnection) -> ThirdPartyConnection:
        return self._repo.upsert(conn)

    def delete_connection(self, conn_id: str) -> None:
        self._repo.delete(conn_id)
