"""AIO Sandbox implementation — connects to a running sandbox container via HTTP API.

The sandbox container exposes a REST API for executing shell commands,
reading/writing files, etc. This class wraps that API and implements the
SandboxPort protocol expected by BashToolkit.
"""

from __future__ import annotations

import logging
import shlex
import threading
import uuid
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

_ERROR_OBSERVATION_SIGNATURE = "'ErrorObservation' object has no attribute 'exit_code'"

# Default timeout for sandbox API calls (seconds)
DEFAULT_TIMEOUT = 600


class SandboxAPIError(Exception):
    """Raised when the sandbox HTTP API returns an error."""


def _post(base_url: str, path: str, payload: dict, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Helper: POST to sandbox API and return JSON response data."""
    url = f"{base_url}{path}"
    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise SandboxAPIError(f"Sandbox API error at {url}: {e}") from e


def _get(base_url: str, path: str, timeout: int = 30) -> dict:
    """Helper: GET from sandbox API and return JSON response data."""
    url = f"{base_url}{path}"
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise SandboxAPIError(f"Sandbox API error at {url}: {e}") from e


class AioSandbox:
    """Sandbox that connects to a running AIO sandbox container via HTTP API.

    Implements the SandboxPort protocol required by BashToolkit:
        - exec_command(id, exec_dir, command)
        - view_shell(id)
        - wait_for_process(id, seconds)
        - write_to_process(id, input, press_enter)
        - kill_process(id)

    The AIO sandbox container must be reachable at `base_url` and expose:
        POST /v1/sandbox/shell/exec       — execute a command
        GET  /v1/sandbox/shell/{id}       — view shell session output
        POST /v1/sandbox/shell/{id}/write — write to running process
        DELETE /v1/sandbox/shell/{id}     — kill process

    A threading lock serializes shell commands to prevent concurrent requests
    from corrupting the container's single persistent session.
    """

    def __init__(self, id: str, base_url: str):
        """Initialize the AIO sandbox.

        Args:
            id: Unique identifier for this sandbox instance.
            base_url: URL of the sandbox API (e.g., http://localhost:8080).
        """
        self._id = id
        self._base_url = base_url.rstrip("/")
        self._lock = threading.Lock()
        # Track currently running shell session IDs → last output
        self._last_output: dict[str, str] = {}

    @property
    def id(self) -> str:
        return self._id

    @property
    def base_url(self) -> str:
        return self._base_url

    # ── SandboxPort protocol implementation ──────────────────────────────────

    async def exec_command(self, id: str, exec_dir: str, command: str) -> Any:
        """Execute a shell command in the sandbox.

        Args:
            id: Shell session identifier.
            exec_dir: Working directory for the command.
            command: Shell command to execute.

        Returns:
            Command output string.
        """
        with self._lock:
            try:
                # Build full command with cd prefix if exec_dir is given
                full_command = command
                if exec_dir:
                    full_command = f"cd {shlex.quote(exec_dir)} && {command}"

                data = _post(self._base_url, "/v1/sandbox/shell/exec", {
                    "id": id,
                    "command": full_command,
                })

                output = data.get("output", "")

                # Detect and recover from ErrorObservation (sandbox corruption)
                if output and _ERROR_OBSERVATION_SIGNATURE in output:
                    logger.warning(
                        "ErrorObservation in sandbox output for session %s, retrying with fresh session", id
                    )
                    fresh_id = str(uuid.uuid4())
                    data = _post(self._base_url, "/v1/sandbox/shell/exec", {
                        "id": fresh_id,
                        "command": full_command,
                    })
                    output = data.get("output", "")

                result = output if output else "(no output)"
                self._last_output[id] = result
                return result

            except SandboxAPIError as e:
                logger.error("exec_command failed for session %s: %s", id, e)
                return f"Error: {e}"

    async def view_shell(self, id: str) -> Any:
        """View the output of a shell session.

        Args:
            id: Shell session identifier.

        Returns:
            Last known output for this session.
        """
        # Return cached output from last exec
        return self._last_output.get(id, "(no output)")

    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> Any:
        """Wait for a running process in a shell session.

        For the AIO sandbox, commands are synchronous so this is a no-op
        that simply returns the last cached output.

        Args:
            id: Shell session identifier.
            seconds: Maximum wait time in seconds (unused for sync sandbox).

        Returns:
            Last known output for this session.
        """
        return self._last_output.get(id, "(process complete)")

    async def write_to_process(self, id: str, input: str, press_enter: bool) -> Any:
        """Write input to an interactive process in a shell session.

        Args:
            id: Shell session identifier.
            input: Input content to write to the process.
            press_enter: Whether to press Enter after input.

        Returns:
            Result string.
        """
        with self._lock:
            try:
                text = input + ("\n" if press_enter else "")
                data = _post(self._base_url, f"/v1/sandbox/shell/{id}/write", {
                    "input": text,
                })
                output = data.get("output", "")
                if output:
                    self._last_output[id] = output
                return output if output else "(wrote to process)"
            except SandboxAPIError as e:
                logger.error("write_to_process failed for session %s: %s", id, e)
                return f"Error: {e}"

    async def kill_process(self, id: str) -> Any:
        """Terminate a running process in a shell session.

        Args:
            id: Shell session identifier.

        Returns:
            Result string.
        """
        with self._lock:
            try:
                url = f"{self._base_url}/v1/sandbox/shell/{id}"
                resp = requests.delete(url, timeout=10)
                self._last_output.pop(id, None)
                if resp.ok:
                    return "Process killed"
                return f"Kill returned status {resp.status_code}"
            except requests.RequestException as e:
                logger.error("kill_process failed for session %s: %s", id, e)
                return f"Error: {e}"

    # ── Direct file/command operations (used by Sandbox abstract interface) ──

    def execute_command(self, command: str) -> str:
        """Execute a bash command synchronously (blocking).

        Args:
            command: The command to execute.

        Returns:
            The output of the command.
        """
        with self._lock:
            try:
                session_id = str(uuid.uuid4())[:8]
                data = _post(self._base_url, "/v1/sandbox/shell/exec", {
                    "id": session_id,
                    "command": command,
                })
                output = data.get("output", "")
                return output if output else "(no output)"
            except SandboxAPIError as e:
                logger.error("execute_command failed: %s", e)
                return f"Error: {e}"
