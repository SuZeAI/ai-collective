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
            try:
                user = User(
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
                self._items[user.id] = user
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
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
                for u in self._items.values()
            ]
        )

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
            self._items[user.id] = user
            self._persist()
        return user
