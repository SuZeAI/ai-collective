from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Generator


class ThreadingLockProvider:
    """Per-key threading.RLock — default for single-process deployments."""

    def __init__(self) -> None:
        self._locks: dict[str, threading.RLock] = {}
        self._meta = threading.Lock()

    @contextmanager
    def acquire(self, key: str) -> Generator[None, None, None]:
        with self._meta:
            if key not in self._locks:
                self._locks[key] = threading.RLock()
            lock = self._locks[key]
        with lock:
            yield


class RedisLockProvider:
    """Redis-based distributed lock — for multi-process / multi-instance deployments.

    Requires the ``redis`` package (``pip install redis``).
    Set LOCK_BACKEND=redis and REDIS_URL=redis://localhost:6379/0 in your .env.
    """

    def __init__(
        self,
        redis_url: str,
        timeout: float = 30,
        blocking_timeout: float = 15,
    ) -> None:
        try:
            import redis as redis_lib
        except ImportError as exc:
            raise RuntimeError(
                "Package 'redis' is not installed. Run: pip install redis"
            ) from exc
        self._client = redis_lib.from_url(redis_url)
        self._timeout = timeout
        self._blocking_timeout = blocking_timeout

    @contextmanager
    def acquire(self, key: str) -> Generator[None, None, None]:
        lock = self._client.lock(
            f"json_repo:{key}",
            timeout=self._timeout,
            blocking_timeout=self._blocking_timeout,
        )
        if not lock.acquire(blocking=True):
            raise TimeoutError(f"Could not acquire Redis lock for key '{key}'")
        try:
            yield
        finally:
            try:
                lock.release()
            except Exception:
                pass


def create_lock_provider(
    backend: str = "threading",
    redis_url: str | None = None,
) -> ThreadingLockProvider | RedisLockProvider:
    """Factory — returns the configured lock provider singleton.

    backend: "threading" (default) | "redis"
    """
    if backend == "redis":
        if not redis_url:
            raise ValueError("REDIS_URL must be set when LOCK_BACKEND=redis")
        return RedisLockProvider(redis_url)
    return ThreadingLockProvider()
