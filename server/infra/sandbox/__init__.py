"""Sandbox infrastructure package.

Provides:
    SandboxProvider      — abstract base class for sandbox lifecycle managers
    SandboxBackend       — abstract base class for provisioning backends

    LocalSandboxAdapter  — runs commands directly on the host (local mode)
    AioSandbox           — runs commands inside a K8s pod via HTTP (k8s mode)

    AioSandboxProvider   — manages AioSandbox lifecycle (warm pool, idle timeout, orphan recovery)
    RemoteSandboxBackend  — provisions K8s pods via provisioner service

    create_sandbox_adapter() — factory: returns the right Sandbox for settings.sandbox_mode
    get_sandbox_provider()   — singleton AioSandboxProvider

The Sandbox port itself (abstract base class + GrepMatch/SandboxResult) lives
in server.app.ports.sandbox — import it from there.

Modes (SANDBOX_MODE env var):
    local — direct host execution (dev-only, no isolation)
    k8s   — K8s/k3s pods via SANDBOX_PROVISIONER_URL
"""

from .aio_sandbox import AioSandbox
from .backend import SandboxBackend, wait_for_sandbox_ready
from .factory import create_sandbox_adapter
from .local_sandbox import LocalSandboxAdapter
from .remote_backend import RemoteSandboxBackend
from .sandbox_info import SandboxInfo
from .sandbox_provider import (
    AioSandboxProvider,
    SandboxProvider,
    get_sandbox_provider,
    reset_sandbox_provider,
    shutdown_sandbox_provider,
)
from .sandbox_session import (
    meeting_thread_id,
    ensure_meeting_workspace,
    get_current_thread_id,
    get_thread_workspace,
    new_thread_id,
    set_current_thread_id,
    use_meeting_thread,
)

__all__ = [
    "AioSandbox",
    "AioSandboxProvider",
    "LocalSandboxAdapter",
    "RemoteSandboxBackend",
    "SandboxBackend",
    "SandboxInfo",
    "SandboxProvider",
    "meeting_thread_id",
    "create_sandbox_adapter",
    "ensure_meeting_workspace",
    "get_current_thread_id",
    "get_sandbox_provider",
    "get_thread_workspace",
    "new_thread_id",
    "reset_sandbox_provider",
    "set_current_thread_id",
    "shutdown_sandbox_provider",
    "use_meeting_thread",
    "wait_for_sandbox_ready",
]
