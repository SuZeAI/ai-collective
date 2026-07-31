"""Abstract base class for sandbox provisioning backends."""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

import requests

from .sandbox_info import SandboxInfo

logger = logging.getLogger(__name__)


def wait_for_sandbox_ready(sandbox_url: str, timeout: int = 60) -> bool:
    """Poll the sandbox health endpoint until ready or timeout."""
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


class SandboxBackend(ABC):
    """Abstract base for sandbox container provisioning.

    Sole implementation: RemoteSandboxBackend, which delegates to the K8s/k3s
    provisioner service. (settings.sandbox_mode == "local" never reaches a
    SandboxBackend at all — factory.py routes it straight to
    LocalSandboxAdapter, in-process on the backend itself.)
    """

    @abstractmethod
    def create(self, thread_id: Optional[str], sandbox_id: str) -> SandboxInfo:
        """Create/provision a new sandbox and return its connection info."""
        ...

    @abstractmethod
    def destroy(self, info: SandboxInfo) -> None:
        """Destroy/cleanup a sandbox and release its resources."""
        ...

    @abstractmethod
    def is_alive(self, info: SandboxInfo) -> bool:
        """Lightweight check whether a sandbox is still alive."""
        ...

    @abstractmethod
    def discover(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """Try to discover an existing sandbox by its deterministic ID."""
        ...

    def list_running(self) -> list[SandboxInfo]:
        """Enumerate all running sandboxes managed by this backend.

        Default returns empty list — backends that don't manage local containers
        (e.g. RemoteSandboxBackend) rely on the provisioner for cleanup.
        """
        return []
