from __future__ import annotations

import threading
from contextlib import contextmanager
from functools import lru_cache
from typing import Generator

from backend.log import get_logger

logger = get_logger(__name__)


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
                logger.debug("[Lock/threading] created new RLock | key=%s", key)
            lock = self._locks[key]
        logger.debug("[Lock/threading] acquire | key=%s", key)
        with lock:
            yield
        logger.debug("[Lock/threading] release | key=%s", key)


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
        redis_key = f"json_repo:{key}"
        lock = self._client.lock(
            redis_key,
            timeout=self._timeout,
            blocking_timeout=self._blocking_timeout,
        )
        logger.debug("[Lock/redis] acquire | key=%s", redis_key)
        if not lock.acquire(blocking=True):
            logger.error("[Lock/redis] TIMEOUT acquiring lock | key=%s", redis_key)
            raise TimeoutError(f"Could not acquire Redis lock for key '{key}'")
        logger.debug("[Lock/redis] acquired | key=%s", redis_key)
        try:
            yield
        finally:
            try:
                lock.release()
                logger.debug("[Lock/redis] released | key=%s", redis_key)
            except Exception:
                logger.warning("[Lock/redis] release failed (lock may have expired) | key=%s", redis_key)


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
        p = RedisLockProvider(redis_url)
        logger.info("[Lock] initialised Redis lock provider | url=%s", redis_url)
        return p
    p = ThreadingLockProvider()
    logger.info("[Lock] initialised threading lock provider")
    return p


@lru_cache
def get_shared_lock_provider() -> "ThreadingLockProvider | RedisLockProvider":
    """Process-wide singleton lock provider, configured from settings.

    Callers that need distributed locking outside the JsonFileStore path
    (e.g. working_memory_store, long_term_memory_store, thread_files — which
    do their own raw file I/O rather than going through a repository) should
    use this instead of a private ``threading.Lock``, so they honor
    ``LOCK_BACKEND=redis`` in multi-instance deployments like every JSON
    repository does.
    """
    from backend.api.settings import settings

    return create_lock_provider(backend=settings.lock_backend, redis_url=settings.redis_url)
