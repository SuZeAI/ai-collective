"""Sandbox provider — manages AioSandbox instance lifecycle.

Architecture:
  - Uses LocalContainerBackend by default (manages Docker containers directly)
  - Uses RemoteSandboxBackend when SANDBOX_PROVISIONER_URL env var is set

Configuration via environment variables:
  SANDBOX_PROVISIONER_URL   — URL of provisioner service (enables K8s mode)
  SANDBOX_IMAGE             — Docker image for sandbox containers
  SANDBOX_BASE_PORT         — Base port for local containers (default: 8080)
  SANDBOX_CONTAINER_PREFIX  — Container name prefix (default: ai-collective-sandbox)
  SANDBOX_IDLE_TIMEOUT      — Idle timeout in seconds (default: 600)
  SANDBOX_REPLICAS          — Max concurrent sandbox containers (default: 3)
  SANDBOX_HOST              — Host that backends use to reach sandboxes (default: localhost)
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid

import requests

from .aio_sandbox import AioSandbox
from .local_backend import LocalContainerBackend
from .remote_backend import RemoteSandboxBackend
from .sandbox_info import SandboxInfo

logger = logging.getLogger(__name__)

DEFAULT_IMAGE = "enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest"
DEFAULT_IDLE_TIMEOUT = 600
DEFAULT_REPLICAS = 3
IDLE_CHECK_INTERVAL = 60


def _wait_for_sandbox_ready(sandbox_url: str, timeout: int = 60) -> bool:
    """Poll the sandbox health endpoint until ready."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{sandbox_url}/v1/sandbox", timeout=5)
            if resp.status_code == 200:
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    return False


class SandboxProvider:
    """Manages the lifecycle of AioSandbox instances.

    Provides acquire/get/release/shutdown operations with:
    - In-process caching for fast repeated access
    - Idle timeout management (background thread)
    - Warm pool: released containers kept alive for fast re-use
    - Optional K8s backend via SANDBOX_PROVISIONER_URL env var
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sandboxes: dict[str, AioSandbox] = {}
        self._sandbox_infos: dict[str, SandboxInfo] = {}
        self._last_activity: dict[str, float] = {}
        self._warm_pool: dict[str, tuple[SandboxInfo, float]] = {}

        self._idle_timeout = int(os.environ.get("SANDBOX_IDLE_TIMEOUT", DEFAULT_IDLE_TIMEOUT))
        self._replicas = int(os.environ.get("SANDBOX_REPLICAS", DEFAULT_REPLICAS))
        self._backend = self._create_backend()

        # Start idle checker
        if self._idle_timeout > 0:
            self._idle_stop = threading.Event()
            self._idle_thread = threading.Thread(
                target=self._idle_loop, name="sandbox-idle-checker", daemon=True
            )
            self._idle_thread.start()

    def _create_backend(self):
        provisioner_url = os.environ.get("SANDBOX_PROVISIONER_URL", "").strip()
        if provisioner_url:
            logger.info("Using remote provisioner backend at %s", provisioner_url)
            return RemoteSandboxBackend(provisioner_url=provisioner_url)

        image = os.environ.get("SANDBOX_IMAGE", DEFAULT_IMAGE)
        base_port = int(os.environ.get("SANDBOX_BASE_PORT", 8080))
        prefix = os.environ.get("SANDBOX_CONTAINER_PREFIX", "ai-collective-sandbox")
        logger.info("Using local Docker backend (image=%s, prefix=%s)", image, prefix)
        return LocalContainerBackend(image=image, base_port=base_port, container_prefix=prefix)

    # ── Core operations ──────────────────────────────────────────────────────

    def acquire(self, session_id: str) -> str:
        """Acquire a sandbox for a session. Returns the sandbox_id.

        If a sandbox already exists for this session, reuses it.
        Otherwise creates a new sandbox container.

        Args:
            session_id: Unique session/thread identifier.

        Returns:
            sandbox_id of the acquired sandbox.
        """
        with self._lock:
            # Check if we already have a live sandbox for this session
            existing_id = self._find_active_for_session(session_id)
            if existing_id:
                self._last_activity[existing_id] = time.time()
                return existing_id

        sandbox_id = self._deterministic_id(session_id)

        # Check warm pool
        with self._lock:
            if sandbox_id in self._warm_pool:
                info, _ = self._warm_pool.pop(sandbox_id)
                sandbox = AioSandbox(id=sandbox_id, base_url=info.sandbox_url)
                self._sandboxes[sandbox_id] = sandbox
                self._sandbox_infos[sandbox_id] = info
                self._last_activity[sandbox_id] = time.time()
                logger.info("Reclaimed warm-pool sandbox %s", sandbox_id)
                return sandbox_id

        # Create new sandbox
        return self._create(session_id, sandbox_id)

    def get(self, sandbox_id: str) -> AioSandbox | None:
        """Get a sandbox by ID."""
        with self._lock:
            sandbox = self._sandboxes.get(sandbox_id)
            if sandbox:
                self._last_activity[sandbox_id] = time.time()
            return sandbox

    def release(self, sandbox_id: str) -> None:
        """Release sandbox into warm pool (container keeps running)."""
        with self._lock:
            sandbox = self._sandboxes.pop(sandbox_id, None)
            info = self._sandbox_infos.pop(sandbox_id, None)
            self._last_activity.pop(sandbox_id, None)
            if info and sandbox_id not in self._warm_pool:
                self._warm_pool[sandbox_id] = (info, time.time())
        logger.info("Released sandbox %s to warm pool", sandbox_id)

    def destroy(self, sandbox_id: str) -> None:
        """Stop and destroy a sandbox container."""
        with self._lock:
            self._sandboxes.pop(sandbox_id, None)
            info = self._sandbox_infos.pop(sandbox_id, None)
            self._last_activity.pop(sandbox_id, None)
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
        """Shutdown all sandboxes (called at app exit)."""
        if hasattr(self, "_idle_stop"):
            self._idle_stop.set()

        with self._lock:
            active_ids = list(self._sandboxes.keys())
            warm_items = list(self._warm_pool.items())
            self._warm_pool.clear()

        for sandbox_id in active_ids:
            try:
                self.destroy(sandbox_id)
            except Exception as e:
                logger.error("Failed to destroy sandbox %s during shutdown: %s", sandbox_id, e)

        for sandbox_id, (info, _) in warm_items:
            try:
                self._backend.destroy(info)
            except Exception as e:
                logger.error("Failed to destroy warm sandbox %s during shutdown: %s", sandbox_id, e)

    # ── Internal helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _deterministic_id(session_id: str) -> str:
        import hashlib
        return hashlib.sha256(session_id.encode()).hexdigest()[:8]

    def _find_active_for_session(self, session_id: str) -> str | None:
        """Find an active sandbox_id whose ID matches session deterministic hash."""
        target = self._deterministic_id(session_id)
        return target if target in self._sandboxes else None

    def _create(self, session_id: str, sandbox_id: str) -> str:
        """Create a new sandbox via the backend."""
        # Enforce replicas soft cap
        with self._lock:
            total = len(self._sandboxes) + len(self._warm_pool)
        if total >= self._replicas:
            self._evict_oldest_warm()

        info = self._backend.create(session_id, sandbox_id)

        if not _wait_for_sandbox_ready(info.sandbox_url, timeout=60):
            self._backend.destroy(info)
            raise RuntimeError(
                f"Sandbox {sandbox_id} failed to become ready at {info.sandbox_url}"
            )

        sandbox = AioSandbox(id=sandbox_id, base_url=info.sandbox_url)
        with self._lock:
            self._sandboxes[sandbox_id] = sandbox
            self._sandbox_infos[sandbox_id] = info
            self._last_activity[sandbox_id] = time.time()

        logger.info("Created sandbox %s at %s", sandbox_id, info.sandbox_url)
        return sandbox_id

    def _evict_oldest_warm(self) -> None:
        """Destroy the oldest warm-pool container to free capacity."""
        with self._lock:
            if not self._warm_pool:
                return
            oldest_id = min(self._warm_pool, key=lambda sid: self._warm_pool[sid][1])
            info, _ = self._warm_pool.pop(oldest_id)
        try:
            self._backend.destroy(info)
            logger.info("Evicted warm-pool sandbox %s", oldest_id)
        except Exception as e:
            logger.error("Failed to evict sandbox %s: %s", oldest_id, e)

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
            for sid, (info, _) in stale_warm:
                del self._warm_pool[sid]

        for sid in stale_active:
            self.destroy(sid)
        for sid, info in stale_warm:
            try:
                self._backend.destroy(info)
                logger.info("Destroyed idle warm-pool sandbox %s", sid)
            except Exception as e:
                logger.error("Failed to destroy idle sandbox %s: %s", sid, e)


# ── Module-level singleton ──────────────────────────────────────────────────

_provider: SandboxProvider | None = None
_provider_lock = threading.Lock()


def get_sandbox_provider() -> SandboxProvider:
    """Return the process-level singleton SandboxProvider."""
    global _provider
    if _provider is None:
        with _provider_lock:
            if _provider is None:
                _provider = SandboxProvider()
    return _provider


def reset_sandbox_provider() -> None:
    """Reset the singleton (for testing)."""
    global _provider
    with _provider_lock:
        _provider = None
