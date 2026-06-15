"""Sandbox adapter factory — creates the right Sandbox based on settings.sandbox_mode."""
from __future__ import annotations

import os
from typing import Optional

from .sandbox import Sandbox


def create_sandbox_adapter(session_id: Optional[str] = None) -> Sandbox:
    """Return a Sandbox implementation based on settings.sandbox_mode.

    local  → LocalSandboxAdapter (direct host execution, no container)
    docker → AioSandbox backed by a local Docker container
    k8s    → AioSandbox backed by a K8s pod via the provisioner service

    When *session_id* is a conversation-scoped thread id (``conv-...``) the
    sandbox is keyed by it, so every agent in a chat reuses one container/Pod.
    In docker mode the conversation's host workspace is bind-mounted into the
    container so uploaded files are visible inside it.
    """
    from backend.api.settings import settings

    if settings.sandbox_mode == "local":
        from .local_sandbox import LocalSandboxAdapter
        return LocalSandboxAdapter(
            timeout=settings.sandbox_timeout,
            workspace=settings.sandbox_workspace,
        )

    extra_mounts = _conversation_mounts(session_id, settings)

    from .sandbox_provider import get_sandbox_provider
    provider = get_sandbox_provider()
    sandbox_id = provider.acquire(session_id or "default", extra_mounts=extra_mounts)
    sandbox = provider.get(sandbox_id)
    if sandbox is None:
        raise RuntimeError(f"Failed to acquire sandbox for session {session_id!r}")
    return sandbox


def _conversation_mounts(session_id: Optional[str], settings):
    """Bind-mount tuple for a conversation workspace, or None.

    Only meaningful in docker mode (the local container backend honors
    ``extra_mounts``); the k8s provisioner ignores host paths, so files reach
    the Pod via the push/restore path instead.
    """
    if not session_id or not session_id.startswith("conv-"):
        return None
    if settings.sandbox_mode != "docker":
        return None
    base = settings.sandbox_workspace or os.path.join(
        os.path.expanduser("~"), "sandbox_workspace"
    )
    host_path = os.path.join(base, session_id)
    try:
        os.makedirs(host_path, exist_ok=True)
    except OSError:
        return None
    container_path = f"/workspace/{session_id}"
    return [(host_path, container_path, False)]
