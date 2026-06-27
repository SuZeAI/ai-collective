from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import TokenUsageRecord
from backend.infrastructure.repositories.json_store import JsonFileStore


def _parse_timestamp(value: object) -> datetime:
    try:
        ts = datetime.fromisoformat(str(value))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


class JsonTokenUsageRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[TokenUsageRecord] = []
        for item in data:
            try:
                self._items.append(
                    TokenUsageRecord(
                        id=str(item["id"]),
                        provider=str(item.get("provider", "")),
                        model=str(item.get("model", "")),
                        input_tokens=int(item.get("input_tokens", 0)),
                        output_tokens=int(item.get("output_tokens", 0)),
                        total_tokens=int(item.get("total_tokens", 0)),
                        user_id=str(item.get("user_id", "system")),
                        timestamp=_parse_timestamp(item.get("timestamp")),
                        staff_name=str(item.get("agent_name", "")),
                        department_id=str(item.get("department_id", "")),
                    )
                )
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": r.id,
                    "provider": r.provider,
                    "model": r.model,
                    "input_tokens": r.input_tokens,
                    "output_tokens": r.output_tokens,
                    "total_tokens": r.total_tokens,
                    "user_id": r.user_id,
                    "timestamp": r.timestamp.isoformat(),
                    "agent_name": r.staff_name,
                    "department_id": r.department_id,
                }
                for r in self._items
            ]
        )

    def add(self, record: TokenUsageRecord) -> TokenUsageRecord:
        with self._lock:
            self._items.append(record)
            self._persist()
        return record

    def list(self, since: datetime | None = None) -> list[TokenUsageRecord]:
        with self._lock:
            if since is None:
                return list(self._items)
            cutoff = since if since.tzinfo else since.replace(tzinfo=timezone.utc)
            return [r for r in self._items if r.timestamp >= cutoff]
