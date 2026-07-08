from __future__ import annotations

import threading

from backend.domain.models import User
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonUserRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, User] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> User | None:
        try:
            return User(
                id=str(item["id"]),
                name=str(item.get("name", "")),
                email=str(item.get("email", "")),
                hashed_password=str(item.get("hashed_password", "")),
                role=str(item.get("role", "user")),
                joined_at=str(item.get("joined_at", "")),
                avatar=str(item.get("avatar", "")),
                provider=str(item.get("provider", "local")),
                provider_id=str(item.get("provider_id", "")),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(u: User) -> dict:
        return {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "hashed_password": u.hashed_password,
            "role": u.role,
            "joined_at": u.joined_at,
            "avatar": u.avatar,
            "provider": u.provider,
            "provider_id": u.provider_id,
        }

    def list(self) -> list[User]:
        with self._lock:
            return list(self._items.values())

    def find_by_id(self, user_id: str) -> User | None:
        with self._lock:
            return self._items.get(user_id)

    def find_by_email(self, email: str) -> User | None:
        with self._lock:
            email_lower = email.strip().lower()
            return next((u for u in self._items.values() if u.email.lower() == email_lower), None)

    def find_by_provider_id(self, provider: str, provider_id: str) -> User | None:
        with self._lock:
            return next(
                (u for u in self._items.values() if u.provider == provider and u.provider_id == provider_id),
                None,
            )

    def save(self, user: User) -> User:
        with self._lock:
            self._items = self._merge_and_persist({user.id: user}, remove_ids=())
        return user

    def _merge_and_persist(
        self, upserts: dict[str, User], remove_ids: tuple[str, ...]
    ) -> dict[str, User]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update) — critical here since this store holds auth
        credentials."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for user_id in remove_ids:
                merged.pop(user_id, None)
            for user_id, user in upserts.items():
                merged[user_id] = self._serialize_item(user)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, User] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
