"""Sandbox adapter factory — creates the right Sandbox based on settings.sandbox_mode."""
from __future__ import annotations

from typing import Optional

from .sandbox import Sandbox


def create_sandbox_adapter(session_id: Optional[str] = None) -> Sandbox:
    """Return a Sandbox implementation based on settings.sandbox_mode.

    local  → LocalSandboxAdapter (direct host execution, no container)
    docker → AioSandbox backed by a local Docker container
    k8s    → AioSandbox backed by a K8s pod via the provisioner service
    """
    from backend.api.settings import settings

    if settings.sandbox_mode == "local":
        from .local_sandbox import LocalSandboxAdapter
        return LocalSandboxAdapter(
            timeout=settings.sandbox_timeout,
            workspace=settings.sandbox_workspace,
        )

    from .sandbox_provider import get_sandbox_provider
    provider = get_sandbox_provider()
    sandbox_id = provider.acquire(session_id or "default")
    sandbox = provider.get(sandbox_id)
    if sandbox is None:
        raise RuntimeError(f"Failed to acquire sandbox for session {session_id!r}")
    return sandbox
