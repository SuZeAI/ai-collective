from __future__ import annotations

from server.domain.memory.long_term_memory import MemoryRecord, MemoryScope
from server.infra.repositories.json_store import JsonFileStore


class JsonLongTermMemoryRepository:
    """File-backed long-term memory store (one JSON map id -> record)."""

    def __init__(self, store: JsonFileStore) -> None:
        self._store = store
        data = store.read()
        self._records: dict[str, MemoryRecord] = {}
        if isinstance(data, dict):
            for rec_id, raw in data.items():
                if isinstance(raw, dict):
                    record = MemoryRecord.from_dict(raw)
                    if record.id:
                        self._records[record.id] = record

    def _persist(self) -> None:
        self._store.write({rid: r.to_dict() for rid, r in self._records.items()})

    def get(self, record_id: str) -> MemoryRecord | None:
        return self._records.get(record_id)

    def upsert(self, record: MemoryRecord) -> MemoryRecord:
        self._records[record.id] = record
        self._persist()
        return record

    def delete(self, record_id: str) -> None:
        if self._records.pop(record_id, None) is not None:
            self._persist()

    def query_scope(self, scope: MemoryScope) -> list[MemoryRecord]:
        scope = scope.normalized()
        return [r for r in self._records.values() if scope.matches(r)]
