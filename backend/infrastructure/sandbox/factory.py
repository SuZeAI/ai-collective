"""Sandbox adapter factory — creates the right SandboxPort based on mode config."""
from __future__ import annotations

from typing import Literal


def create_sandbox_adapter(
    mode: Literal["local", "remote"] = "local",
    sandbox_url: str | None = None,
    provisioner_url: str | None = None,
    timeout: int = 60,
    workspace: str | None = None,
):
    """Return a SandboxPort implementation based on *mode*.

    Args:
        mode:            "local" for direct host execution, "remote" for AIO container.
        sandbox_url:     Direct URL of a running AIO sandbox container (remote mode).
        provisioner_url: URL of the provisioner service that manages sandbox Pods (remote mode).
        timeout:         Default command execution timeout in seconds.
        workspace:       Local workspace directory (local mode only). Auto-created on first use.

    Returns:
        LocalSandboxAdapter  when mode == "local"
        RemoteSandboxAdapter when mode == "remote"
    """
    if mode == "remote":
        from .remote_sandbox import RemoteSandboxAdapter
        return RemoteSandboxAdapter(
            sandbox_url=sandbox_url,
            provisioner_url=provisioner_url,
            cmd_timeout=timeout,
        )

    from .local_sandbox import LocalSandboxAdapter
    return LocalSandboxAdapter(timeout=timeout, workspace=workspace)
