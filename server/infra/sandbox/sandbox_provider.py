"""Sandbox provider — manages AioSandbox lifecycle for the K8s backend.

Architecture:
    SandboxProvider (ABC)
        └── AioSandboxProvider   — manages K8s sandbox Pods (settings.sandbox_mode == "k8s")

Features of AioSandboxProvider:
    - In-process sandbox caching (fast reuse within same process)
    - Warm pool (released containers kept running for fast cold-start avoidance)
    - Idle timeout management via background thread
    - Startup orphan reconciliation (adopts containers from previous processes)
    - Graceful shutdown via atexit + signal handlers (SIGTERM, SIGINT, SIGHUP)
"""
from __future__ import annotations

import atexit
import hashlib
import logging
import signal
import threading
import time
from abc import ABC, abstractmethod
from typing import Optional

from .aio_sandbox import AioSandbox
from .backend import SandboxBackend, wait_for_sandbox_ready
from .remote_backend import RemoteSandboxBackend
from .sandbox import Sandbox
from .sandbox_info import SandboxInfo

logger = logging.getLogger(__name__)

DEFAULT_IDLE_TIMEOUT = 600
DEFAULT_REPLICAS = 3
IDLE_CHECK_INTERVAL = 60


# ── Abstract SandboxProvider ──────────────────────────────────────────────────

class SandboxProvider(ABC):
    """Abstract base class for sandbox providers."""

    @abstractmethod
    def acquire(self, session_id: Optional[str] = None) -> str:
        """Acquire a sandbox and return its sandbox_id."""
        ...

    @abstractmethod
    def get(self, sandbox_id: str) -> Optional[Sandbox]:
        """Get a sandbox instance by ID."""
        ...

    @abstractmethod
    def release(self, sandbox_id: str) -> None:
        """Release a sandbox into the warm pool (container keeps running)."""
        ...

    @abstractmethod
    def destroy(self, sandbox_id: str) -> None:
        """Stop and permanently destroy a sandbox."""
        ...

    @abstractmethod
    def shutdown(self) -> None:
        """Shutdown all sandboxes gracefully."""
        ...


# ── Concrete AioSandboxProvider ───────────────────────────────────────────────

class AioSandboxProvider(SandboxProvider):
    """Manages AioSandbox instances backed by K8s Pods.

    Only reached when settings.sandbox_mode == "k8s" — "local" is handled by
    LocalSandboxAdapter directly in factory.py, never via a SandboxBackend.
    """

    def __init__(self) -> None:
        from server.api.settings import settings as _settings

        self._lock = threading.Lock()
        self._sandboxes: dict[str, AioSandbox] = {}
        self._sandbox_infos: dict[str, SandboxInfo] = {}
        self._session_sandboxes: dict[str, str] = {}   # session_id → sandbox_id
        self._last_activity: dict[str, float] = {}
        self._warm_pool: dict[str, tuple[SandboxInfo, float]] = {}
        self._shutdown_called = False
        self._idle_stop = threading.Event()

        self._idle_timeout = _settings.sandbox_idle_timeout
        self._replicas = _settings.sandbox_replicas
        self._backend: SandboxBackend = self._create_backend(_settings)

        atexit.register(self.shutdown)
        self._register_signal_handlers()
        self._reconcile_orphans()

        if self._idle_timeout > 0:
            self._idle_thread = threading.Thread(
                target=self._idle_loop, name="sandbox-idle-checker", daemon=True
            )
            self._idle_thread.start()
            logger.info(
                "Sandbox idle checker started (timeout=%ds, replicas=%d)",
                self._idle_timeout, self._replicas,
            )

    def _create_backend(self, settings) -> SandboxBackend:
        if settings.sandbox_mode != "k8s":
            raise ValueError(
                f"Unsupported SANDBOX_MODE {settings.sandbox_mode!r} for AioSandboxProvider "
                "(only 'k8s' is; 'local' is handled by LocalSandboxAdapter instead)"
            )
        if not settings.sandbox_provisioner_url:
            raise ValueError("SANDBOX_PROVISIONER_URL must be set when SANDBOX_MODE=k8s")
        logger.info("Sandbox backend: K8s provisioner at %s", settings.sandbox_provisioner_url)
        return RemoteSandboxBackend(provisioner_url=settings.sandbox_provisioner_url)

    # ── Core operations ───────────────────────────────────────────────────────

    def acquire(self, session_id: Optional[str] = None) -> str:
        """Acquire a sandbox for *session_id* and return its sandbox_id.

        Priority: in-process cache → warm pool → backend discovery → create.
        """
        session_id = session_id or "default"
        sandbox_id = self._deterministic_id(session_id)

        with self._lock:
            # Layer 1: in-process cache
            if sandbox_id in self._sandboxes:
                self._last_activity[sandbox_id] = time.time()
                return sandbox_id

            # Layer 2: warm pool (container still running, no cold-start)
            if sandbox_id in self._warm_pool:
                info, _ = self._warm_pool.pop(sandbox_id)
                sandbox = AioSandbox(id=sandbox_id, base_url=info.sandbox_url)
                self._sandboxes[sandbox_id] = sandbox
                self._sandbox_infos[sandbox_id] = info
                self._last_activity[sandbox_id] = time.time()
                self._session_sandboxes[session_id] = sandbox_id
                logger.info("Reclaimed warm-pool sandbox %s for session %s", sandbox_id, session_id)
                return sandbox_id

        return self._discover_or_create(session_id, sandbox_id)

    def get(self, sandbox_id: str) -> Optional[AioSandbox]:
        with self._lock:
            sandbox = self._sandboxes.get(sandbox_id)
            if sandbox:
                self._last_activity[sandbox_id] = time.time()
            return sandbox

    def release(self, sandbox_id: str) -> None:
        """Release sandbox to warm pool; container keeps running for fast reuse."""
        with self._lock:
            self._sandboxes.pop(sandbox_id, None)
            info = self._sandbox_infos.pop(sandbox_id, None)
            self._last_activity.pop(sandbox_id, None)
            for s in [s for s, sid in self._session_sandboxes.items() if sid == sandbox_id]:
                del self._session_sandboxes[s]
            if info and sandbox_id not in self._warm_pool:
                self._warm_pool[sandbox_id] = (info, time.time())
        logger.info("Released sandbox %s to warm pool", sandbox_id)

    def destroy(self, sandbox_id: str) -> None:
        """Stop and permanently destroy a sandbox."""
        info = None
        with self._lock:
            self._sandboxes.pop(sandbox_id, None)
            info = self._sandbox_infos.pop(sandbox_id, None)
            self._last_activity.pop(sandbox_id, None)
            for s in [s for s, sid in self._session_sandboxes.items() if sid == sandbox_id]:
                del self._session_sandboxes[s]
            if info is None and sandbox_id in self._warm_pool:
                info, _ = self._warm_pool.pop(sandbox_id)
            else:
                self._warm_pool.pop(sandbox_id, None)
        if info:
            try:
                self._backend.destroy(info)
                logger.info("Destroyed sandbox %s", sandbox_id)
            except Exception as e:
                logger.error("Failed to destroy sandbox %s: %s", sandbox_id, e)

    def shutdown(self) -> None:
        """Shutdown all sandboxes. Thread-safe and idempotent."""
        with self._lock:
            if self._shutdown_called:
                return
            self._shutdown_called = True
            active_ids = list(self._sandboxes.keys())
            warm_items = list(self._warm_pool.items())
            self._warm_pool.clear()

        self._idle_stop.set()
        if hasattr(self, "_idle_thread") and self._idle_thread.is_alive():
            self._idle_thread.join(timeout=5)

        logger.info(
            "Shutting down %d active + %d warm-pool sandbox(es)",
            len(active_ids), len(warm_items),
        )
        for sandbox_id in active_ids:
            try:
                self.destroy(sandbox_id)
            except Exception as e:
                logger.error("Failed to destroy sandbox %s during shutdown: %s", sandbox_id, e)
        for sandbox_id, (info, _) in warm_items:
            try:
                self._backend.destroy(info)
                logger.info("Destroyed warm-pool sandbox %s during shutdown", sandbox_id)
            except Exception as e:
                logger.error("Failed to destroy warm sandbox %s during shutdown: %s", sandbox_id, e)

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _deterministic_id(session_id: str) -> str:
        return hashlib.sha256(session_id.encode()).hexdigest()[:8]

    def _discover_or_create(self, session_id: str, sandbox_id: str) -> str:
        """Layer 3: backend discovery + create (handles cross-process races)."""
        # Enforce replicas soft cap (evict oldest warm pool entry if at limit)
        with self._lock:
            total = len(self._sandboxes) + len(self._warm_pool)
        if total >= self._replicas:
            self._evict_oldest_warm()

        # Try to discover a container started by another process
        discovered = self._backend.discover(sandbox_id)
        if discovered:
            sandbox = AioSandbox(id=discovered.sandbox_id, base_url=discovered.sandbox_url)
            with self._lock:
                self._sandboxes[discovered.sandbox_id] = sandbox
                self._sandbox_infos[discovered.sandbox_id] = discovered
                self._last_activity[discovered.sandbox_id] = time.time()
                self._session_sandboxes[session_id] = discovered.sandbox_id
            logger.info(
                "Discovered existing sandbox %s for session %s at %s",
                discovered.sandbox_id, session_id, discovered.sandbox_url,
            )
            return discovered.sandbox_id

        info = self._backend.create(session_id, sandbox_id)
        if not wait_for_sandbox_ready(info.sandbox_url, timeout=60):
            self._backend.destroy(info)
            raise RuntimeError(f"Sandbox {sandbox_id} failed to become ready at {info.sandbox_url}")

        sandbox = AioSandbox(id=sandbox_id, base_url=info.sandbox_url)
        with self._lock:
            self._sandboxes[sandbox_id] = sandbox
            self._sandbox_infos[sandbox_id] = info
            self._last_activity[sandbox_id] = time.time()
            self._session_sandboxes[session_id] = sandbox_id

        logger.info("Created sandbox %s for session %s at %s", sandbox_id, session_id, info.sandbox_url)
        return sandbox_id

    def _evict_oldest_warm(self) -> None:
        with self._lock:
            if not self._warm_pool:
                return
            oldest_id = min(self._warm_pool, key=lambda sid: self._warm_pool[sid][1])
            info, _ = self._warm_pool.pop(oldest_id)
        try:
            self._backend.destroy(info)
            logger.info("Evicted warm-pool sandbox %s to stay within replicas limit", oldest_id)
        except Exception as e:
            logger.error("Failed to evict sandbox %s: %s", oldest_id, e)

    def _reconcile_orphans(self) -> None:
        """Adopt containers from previous process runs into the warm pool."""
        try:
            running = self._backend.list_running()
        except Exception as e:
            logger.warning("Startup reconciliation failed: %s", e)
            return
        now = time.time()
        adopted = 0
        for info in running:
            with self._lock:
                if info.sandbox_id in self._sandboxes or info.sandbox_id in self._warm_pool:
                    continue
                self._warm_pool[info.sandbox_id] = (info, now)
            adopted += 1
            logger.info("Adopted orphaned container %s into warm pool", info.sandbox_id)
        if adopted:
            logger.info("Startup reconciliation: adopted %d orphaned sandbox(es)", adopted)

    # ── Idle timeout management ───────────────────────────────────────────────

    def _idle_loop(self) -> None:
        while not self._idle_stop.wait(timeout=IDLE_CHECK_INTERVAL):
            try:
                self._cleanup_idle()
            except Exception as e:
                logger.error("Idle checker error: %s", e)

    def _cleanup_idle(self) -> None:
        now = time.time()
        with self._lock:
            stale_active = [
                sid for sid, ts in self._last_activity.items()
                if now - ts > self._idle_timeout
            ]
            stale_warm = [
                (sid, info) for sid, (info, ts) in list(self._warm_pool.items())
                if now - ts > self._idle_timeout
            ]
            for sid, _ in stale_warm:
                del self._warm_pool[sid]

        for sid in stale_active:
            with self._lock:
                ts = self._last_activity.get(sid)
                if ts is None or (time.time() - ts) < self._idle_timeout:
                    continue
            self.destroy(sid)
            logger.info("Destroyed idle sandbox %s", sid)

        for sid, info in stale_warm:
            try:
                self._backend.destroy(info)
                logger.info("Destroyed idle warm-pool sandbox %s", sid)
            except Exception as e:
                logger.error("Failed to destroy idle sandbox %s: %s", sid, e)

    # ── Signal handling ───────────────────────────────────────────────────────

    def _register_signal_handlers(self) -> None:
        self._original_sigterm = signal.getsignal(signal.SIGTERM)
        self._original_sigint = signal.getsignal(signal.SIGINT)
        self._original_sighup = signal.getsignal(signal.SIGHUP) if hasattr(signal, "SIGHUP") else None

        def _handler(signum, frame):
            self.shutdown()
            if signum == signal.SIGTERM:
                original = self._original_sigterm
            elif hasattr(signal, "SIGHUP") and signum == signal.SIGHUP:
                original = self._original_sighup
            else:
                original = self._original_sigint
            if callable(original):
                original(signum, frame)
            elif original == signal.SIG_DFL:
                signal.signal(signum, signal.SIG_DFL)
                signal.raise_signal(signum)

        try:
            signal.signal(signal.SIGTERM, _handler)
            signal.signal(signal.SIGINT, _handler)
            if hasattr(signal, "SIGHUP"):
                signal.signal(signal.SIGHUP, _handler)
        except ValueError:
            logger.debug("Could not register signal handlers (not main thread)")


# ── Module-level singleton ────────────────────────────────────────────────────

_provider: Optional[AioSandboxProvider] = None
_provider_lock = threading.Lock()


def get_sandbox_provider() -> AioSandboxProvider:
    """Return the process-level AioSandboxProvider singleton."""
    global _provider
    if _provider is None:
        with _provider_lock:
            if _provider is None:
                _provider = AioSandboxProvider()
    return _provider


def reset_sandbox_provider() -> None:
    """Reset the singleton (for testing)."""
    global _provider
    with _provider_lock:
        _provider = None


def shutdown_sandbox_provider() -> None:
    """Shutdown and reset the singleton."""
    global _provider
    with _provider_lock:
        if _provider is not None:
            _provider.shutdown()
            _provider = None
