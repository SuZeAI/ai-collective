"""Sandbox infrastructure package.

Provides:
    - AioSandbox: connects to a running sandbox container via HTTP (SandboxPort-compatible)
    - SandboxProvider: manages sandbox lifecycle (Docker or K8s via provisioner)
    - LocalContainerBackend: manages Docker containers locally
    - RemoteSandboxBackend: delegates to K8s provisioner service
    - SandboxInfo: sandbox metadata dataclass
    - get_sandbox_provider(): process-level singleton factory

Environment variables (all optional):
    SANDBOX_PROVISIONER_URL   — enables K8s mode (default: local Docker mode)
    SANDBOX_IMAGE             — sandbox container image
    SANDBOX_BASE_PORT         — base port for local containers (default: 8080)
    SANDBOX_CONTAINER_PREFIX  — container name prefix
    SANDBOX_IDLE_TIMEOUT      — idle eviction timeout in seconds (default: 600)
    SANDBOX_REPLICAS          — max concurrent sandbox containers (default: 3)
    SANDBOX_HOST              — hostname for sandbox access (default: localhost)
"""

from .aio_sandbox import AioSandbox
from .local_backend import LocalContainerBackend
from .provider import SandboxProvider, get_sandbox_provider, reset_sandbox_provider
from .remote_backend import RemoteSandboxBackend
from .sandbox_info import SandboxInfo

__all__ = [
    "AioSandbox",
    "LocalContainerBackend",
    "RemoteSandboxBackend",
    "SandboxInfo",
    "SandboxProvider",
    "get_sandbox_provider",
    "reset_sandbox_provider",
]
