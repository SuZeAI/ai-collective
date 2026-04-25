"""Remote sandbox — executes shell commands inside an AIO sandbox container via HTTP.

Supports two sub-modes:
  - direct:      sandbox_url points to a running AIO container (e.g. http://localhost:8080)
  - provisioner: provisioner_url points to the provisioner service that creates
                 per-session sandbox Pods (K8s / docker-compose-dev).

AIO sandbox HTTP API (agent-infra/all-in-one-sandbox container):
  POST {url}/shell/exec          body: {"command": "...", "id": "..."}
                                 resp: {"data": {"output": "...", "exit_code": 0}}
  GET  {url}/shell/view/{id}     resp: {"data": {"output": "...", "exit_code": null}}
  POST {url}/shell/kill/{id}     resp: {"data": {"success": true}}

Provisioner API (remote_backend.py pattern):
  POST {provisioner}/api/sandboxes   body: {"sandbox_id": "...", "thread_id": "..."}
                                     resp: {"sandbox_url": "..."}
  DELETE {provisioner}/api/sandboxes/{id}
  GET    {provisioner}/api/sandboxes/{id}  resp: {"status": "Running", "sandbox_url": "..."}
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import httpx

from .local_sandbox import SandboxResult

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0)


class RemoteSandboxAdapter:
    """SandboxPort implementation that delegates execution to an AIO sandbox container.

    Usage (direct URL):
        adapter = RemoteSandboxAdapter(sandbox_url="http://localhost:8080")

    Usage (provisioner):
        adapter = RemoteSandboxAdapter(provisioner_url="http://provisioner:8002")
        # Sandboxes are created on-demand per session ID via the provisioner.
    """

    def __init__(
        self,
        sandbox_url: str | None = None,
        provisioner_url: str | None = None,
        cmd_timeout: int = 120,
    ):
        if not sandbox_url and not provisioner_url:
            raise ValueError("RemoteSandboxAdapter requires either sandbox_url or provisioner_url")
        self._static_url: str | None = sandbox_url.rstrip("/") if sandbox_url else None
        self._provisioner_url: str | None = provisioner_url.rstrip("/") if provisioner_url else None
        self._cmd_timeout = cmd_timeout
        # Cache of session_id → sandbox_url (for provisioner mode)
        self._session_urls: dict[str, str] = {}
        self._client = httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT)

    # ── URL resolution ────────────────────────────────────────────────────────

    async def _get_sandbox_url(self, session_id: str) -> str:
        """Return the sandbox base URL, provisioning one if needed."""
        if self._static_url:
            return self._static_url
        if session_id in self._session_urls:
            return self._session_urls[session_id]
        url = await self._provision_sandbox(session_id)
        self._session_urls[session_id] = url
        return url

    async def _provision_sandbox(self, sandbox_id: str) -> str:
        """Ask the provisioner to create a new sandbox Pod and return its URL."""
        try:
            resp = await self._client.post(
                f"{self._provisioner_url}/api/sandboxes",
                json={"sandbox_id": sandbox_id, "thread_id": sandbox_id},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            sandbox_url = data["sandbox_url"].rstrip("/")
            logger.info(f"Provisioner created sandbox {sandbox_id!r}: {sandbox_url}")
            return sandbox_url
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Provisioner create failed for {sandbox_id!r}: {exc}") from exc

    # ── SandboxPort implementation ────────────────────────────────────────────

    async def exec_command(self, id: str, exec_dir: str, command: str) -> SandboxResult:
        """Execute *command* in *exec_dir* inside the remote sandbox container."""
        base_url = await self._get_sandbox_url(id)
        full_cmd = f"cd {exec_dir!r} 2>&1 || true; {command}"
        try:
            resp = await self._client.post(
                f"{base_url}/shell/exec",
                json={"command": full_cmd, "id": id},
                timeout=httpx.Timeout(connect=10.0, read=float(self._cmd_timeout + 10), write=10.0, pool=10.0),
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            return SandboxResult(
                output=data.get("output", "(no output)") or "(no output)",
                exit_code=data.get("exit_code"),
            )
        except httpx.TimeoutException:
            return SandboxResult(output=f"Remote command timed out after {self._cmd_timeout}s", exit_code=124)
        except Exception as exc:
            logger.error(f"RemoteSandbox exec error for session {id!r}: {exc}")
            return SandboxResult(output=f"Remote execution error: {exc}", exit_code=1)

    async def view_shell(self, id: str) -> SandboxResult:
        """Fetch current shell output for session *id*."""
        try:
            base_url = await self._get_sandbox_url(id)
            resp = await self._client.get(f"{base_url}/shell/view/{id}", timeout=10)
            resp.raise_for_status()
            data = resp.json().get("data", {})
            return SandboxResult(
                output=data.get("output", "(no output)") or "(no output)",
                exit_code=data.get("exit_code"),
            )
        except Exception as exc:
            logger.warning(f"RemoteSandbox view_shell error for {id!r}: {exc}")
            return SandboxResult(output=f"Error fetching shell output: {exc}", exit_code=None)

    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> SandboxResult:
        """Poll the remote sandbox until the process completes or timeout is reached."""
        timeout = seconds or self._cmd_timeout
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            result = await self.view_shell(id)
            if result.exit_code is not None:
                return result
            await asyncio.sleep(0.5)
        return SandboxResult(output="Process wait timed out", exit_code=None)

    async def write_to_process(self, id: str, input: str, press_enter: bool) -> dict[str, Any]:
        """Send input to an interactive shell session."""
        try:
            base_url = await self._get_sandbox_url(id)
            payload = {"input": input + ("\n" if press_enter else ""), "id": id}
            resp = await self._client.post(f"{base_url}/shell/write", json=payload, timeout=10)
            resp.raise_for_status()
            return resp.json().get("data", {"success": True})
        except Exception as exc:
            logger.warning(f"RemoteSandbox write_to_process error for {id!r}: {exc}")
            return {"success": False, "error": str(exc)}

    async def kill_process(self, id: str) -> dict[str, Any]:
        """Terminate the shell session in the remote sandbox."""
        try:
            base_url = await self._get_sandbox_url(id)
            resp = await self._client.post(f"{base_url}/shell/kill/{id}", timeout=10)
            resp.raise_for_status()
            result = resp.json().get("data", {"success": True})
        except Exception as exc:
            logger.warning(f"RemoteSandbox kill_process error for {id!r}: {exc}")
            result = {"success": False, "error": str(exc)}

        # Clean up provisioner-managed sandbox on kill
        if self._provisioner_url and id in self._session_urls:
            await self._destroy_provisioner_sandbox(id)

        return result

    async def _destroy_provisioner_sandbox(self, sandbox_id: str) -> None:
        url = self._session_urls.pop(sandbox_id, None)
        if not url:
            return
        try:
            await self._client.delete(
                f"{self._provisioner_url}/api/sandboxes/{sandbox_id}", timeout=10
            )
            logger.info(f"Provisioner destroyed sandbox {sandbox_id!r}")
        except Exception as exc:
            logger.warning(f"Provisioner destroy failed for {sandbox_id!r}: {exc}")

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
