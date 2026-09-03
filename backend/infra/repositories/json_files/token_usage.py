from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import TokenUsageRecord
from backend.infra.repositories.json_store import JsonFileStore


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
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items.append(parsed)

    @staticmethod
    def _parse_item(item: dict) -> TokenUsageRecord | None:
        try:
            return TokenUsageRecord(
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
                cache_read_tokens=int(item.get("cache_read_tokens", 0) or 0),
                cache_creation_tokens=int(item.get("cache_creation_tokens", 0) or 0),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(r: TokenUsageRecord) -> dict:
        return {
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
            "cache_read_tokens": r.cache_read_tokens,
            "cache_creation_tokens": r.cache_creation_tokens,
        }

    def add(self, record: TokenUsageRecord) -> TokenUsageRecord:
        """Append into the *current on-disk* usage log (not just this
        process's in-memory cache), so concurrent instances recording usage at
        the same time can't clobber each other's billing/cost records
        (lost-update)."""
        with self._lock:
            def modify(current):
                raw_items = current if isinstance(current, list) else []
                existing = [p for p in (self._parse_item(r) for r in raw_items) if p is not None]
                return [self._serialize_item(p) for p in existing] + [self._serialize_item(record)]

            new_raw = self._store.read_modify_write(modify)
            self._items = [p for p in (self._parse_item(r) for r in new_raw) if p is not None]
        return record

    def list(self, since: datetime | None = None) -> list[TokenUsageRecord]:
        with self._lock:
            if since is None:
                return list(self._items)
            cutoff = since if since.tzinfo else since.replace(tzinfo=timezone.utc)
            return [r for r in self._items if r.timestamp >= cutoff]
