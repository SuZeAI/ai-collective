from __future__ import annotations

from backend.application.ports.repositories import OfficeBuilderSessionRepository
from backend.domain.models import OfficeBuilderSession


class OfficeBuilderSessionService:
    def __init__(self, repo: OfficeBuilderSessionRepository):
        self._repo = repo

    def list_sessions(self) -> list[OfficeBuilderSession]:
        # Most recently touched first — that's the order the history panel shows.
        return sorted(self._repo.list(), key=lambda s: s.updated_at, reverse=True)

    def get_session(self, session_id: str) -> OfficeBuilderSession | None:
        return self._repo.get(session_id)

    def upsert_session(self, session: OfficeBuilderSession) -> OfficeBuilderSession:
        return self._repo.upsert(session)

    def delete_session(self, session_id: str) -> None:
        self._repo.delete(session_id)
