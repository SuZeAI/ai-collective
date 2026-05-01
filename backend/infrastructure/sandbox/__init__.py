"""Sandbox infrastructure package.

Provides:
    Sandbox              — abstract base class for all sandbox implementations
    SandboxProvider      — abstract base class for sandbox lifecycle managers
    SandboxBackend       — abstract base class for provisioning backends

    LocalSandboxAdapter  — runs commands directly on the host (local mode)
    AioSandbox           — runs commands inside a container via HTTP (docker/k8s mode)

    AioSandboxProvider   — manages AioSandbox lifecycle (warm pool, idle timeout, orphan recovery)
    LocalContainerBackend — provisions Docker containers locally
    RemoteSandboxBackend  — provisions K8s pods via provisioner service

    create_sandbox_adapter() — factory: returns the right Sandbox for settings.sandbox_mode
    get_sandbox_provider()   — singleton AioSandboxProvider

Modes (SANDBOX_MODE env var):
    local  — direct host execution (dev-only, no isolation)
    docker — local Docker containers
    k8s    — K8s/k3s pods via SANDBOX_PROVISIONER_URL
"""

from .aio_sandbox import AioSandbox
from .backend import SandboxBackend, wait_for_sandbox_ready
from .factory import create_sandbox_adapter
from .local_backend import LocalContainerBackend
from .local_sandbox import LocalSandboxAdapter
from .remote_backend import RemoteSandboxBackend
from .sandbox import GrepMatch, Sandbox, SandboxResult
from .sandbox_info import SandboxInfo
from .sandbox_provider import (
    AioSandboxProvider,
    SandboxProvider,
    get_sandbox_provider,
    reset_sandbox_provider,
    shutdown_sandbox_provider,
)

__all__ = [
    "AioSandbox",
    "AioSandboxProvider",
    "GrepMatch",
    "LocalContainerBackend",
    "LocalSandboxAdapter",
    "RemoteSandboxBackend",
    "Sandbox",
    "SandboxBackend",
    "SandboxInfo",
    "SandboxProvider",
    "SandboxResult",
    "create_sandbox_adapter",
    "get_sandbox_provider",
    "reset_sandbox_provider",
    "shutdown_sandbox_provider",
    "wait_for_sandbox_ready",
]
