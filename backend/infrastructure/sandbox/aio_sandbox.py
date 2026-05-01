"""AIO Sandbox — HTTP client to a running all-in-one sandbox container.

Implements the Sandbox ABC: session-based shell operations + file operations.
A threading lock serializes shell commands to prevent concurrent requests from
corrupting the container's single persistent shell session.
"""
from __future__ import annotations

import base64
import logging
import shlex
import threading
import uuid
from typing import Any, Optional

import requests

from .sandbox import GrepMatch, Sandbox, SandboxResult

logger = logging.getLogger(__name__)

_ERROR_OBSERVATION_SIGNATURE = "'ErrorObservation' object has no attribute 'exit_code'"
DEFAULT_TIMEOUT = 600


class SandboxAPIError(Exception):
    """Raised when the sandbox HTTP API returns an error."""


def _post(base_url: str, path: str, payload: dict, timeout: int = DEFAULT_TIMEOUT) -> dict:
    url = f"{base_url}{path}"
    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise SandboxAPIError(f"Sandbox API error at {url}: {e}") from e


class AioSandbox(Sandbox):
    """Sandbox that connects to a running AIO sandbox container via HTTP API.

    The AIO sandbox container must be reachable at `base_url` and expose:
        POST /v1/sandbox/shell/exec       — execute a command
        POST /v1/sandbox/shell/{id}/write — write to running process
        DELETE /v1/sandbox/shell/{id}     — kill process
    """

    def __init__(self, id: str, base_url: str):
        self._id = id
        self._base_url = base_url.rstrip("/")
        self._lock = threading.Lock()
        self._last_output: dict[str, SandboxResult] = {}

    @property
    def id(self) -> str:
        return self._id

    @property
    def base_url(self) -> str:
        return self._base_url

    # ── Shell operations ──────────────────────────────────────────────────────

    async def exec_command(self, id: str, exec_dir: str, command: str) -> SandboxResult:
        with self._lock:
            try:
                full_command = f"cd {shlex.quote(exec_dir)} && {command}" if exec_dir else command
                data = _post(self._base_url, "/v1/sandbox/shell/exec", {"id": id, "command": full_command})
                output = data.get("output", "")

                if output and _ERROR_OBSERVATION_SIGNATURE in output:
                    logger.warning("ErrorObservation in sandbox output for session %s, retrying", id)
                    data = _post(self._base_url, "/v1/sandbox/shell/exec", {
                        "id": str(uuid.uuid4()),
                        "command": full_command,
                    })
                    output = data.get("output", "")

                result = SandboxResult(output=output or "(no output)", exit_code=data.get("exit_code"))
                self._last_output[id] = result
                return result
            except SandboxAPIError as e:
                logger.error("exec_command failed for session %s: %s", id, e)
                return SandboxResult(output=f"Error: {e}", exit_code=1)

    async def view_shell(self, id: str) -> SandboxResult:
        return self._last_output.get(id, SandboxResult(output="(no output)"))

    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> SandboxResult:
        return self._last_output.get(id, SandboxResult(output="(process complete)"))

    async def write_to_process(self, id: str, input: str, press_enter: bool) -> Any:
        with self._lock:
            try:
                text = input + ("\n" if press_enter else "")
                data = _post(self._base_url, f"/v1/sandbox/shell/{id}/write", {"input": text})
                output = data.get("output", "")
                if output:
                    self._last_output[id] = SandboxResult(output=output)
                return output or "(wrote to process)"
            except SandboxAPIError as e:
                logger.error("write_to_process failed for session %s: %s", id, e)
                return f"Error: {e}"

    async def kill_process(self, id: str) -> Any:
        with self._lock:
            try:
                resp = requests.delete(f"{self._base_url}/v1/sandbox/shell/{id}", timeout=10)
                self._last_output.pop(id, None)
                return "Process killed" if resp.ok else f"Kill returned status {resp.status_code}"
            except requests.RequestException as e:
                logger.error("kill_process failed for session %s: %s", id, e)
                return f"Error: {e}"

    # ── File operations (via shell commands inside the container) ─────────────

    async def read_file(
        self,
        path: str,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> str:
        if start_line is not None and end_line is not None:
            cmd = f"sed -n '{start_line},{end_line}p' {shlex.quote(path)} 2>&1"
        elif start_line is not None:
            cmd = f"tail -n +{start_line} {shlex.quote(path)} 2>&1"
        else:
            cmd = f"cat {shlex.quote(path)} 2>&1"
        result = await self.exec_command(f"_read_{uuid.uuid4().hex[:6]}", "/", cmd)
        return result.output

    async def write_file(self, path: str, content: str, append: bool = False) -> None:
        encoded = base64.b64encode(content.encode("utf-8")).decode()
        mode = "ab" if append else "wb"
        py_cmd = (
            f"python3 -c \""
            f"import base64,os; os.makedirs(os.path.dirname(os.path.abspath({path!r})), exist_ok=True); "
            f"open({path!r}, {mode!r}).write(base64.b64decode('{encoded}'))\""
        )
        await self.exec_command(f"_write_{uuid.uuid4().hex[:6]}", "/", py_cmd)

    async def list_dir(self, path: str, max_depth: int = 2) -> list[str]:
        cmd = (
            f"find {shlex.quote(path)} -maxdepth {max_depth} "
            r"\( -name .git -o -name __pycache__ -o -name node_modules \) -prune -o -print 2>/dev/null "
            "| head -500"
        )
        result = await self.exec_command(f"_ls_{uuid.uuid4().hex[:6]}", "/", cmd)
        return [line.strip() for line in result.output.splitlines() if line.strip()]

    async def glob_files(
        self,
        path: str,
        pattern: str,
        max_results: int = 200,
    ) -> tuple[list[str], bool]:
        cmd = (
            f"find {shlex.quote(path)} -name {shlex.quote(pattern)} "
            r"\( -path '*/.git/*' -o -path '*/__pycache__/*' -o -path '*/node_modules/*' \) -prune -o -print 2>/dev/null "
            f"| head -{max_results + 1}"
        )
        result = await self.exec_command(f"_glob_{uuid.uuid4().hex[:6]}", "/", cmd)
        lines = [line.strip() for line in result.output.splitlines() if line.strip()]
        truncated = len(lines) > max_results
        return lines[:max_results], truncated

    async def grep_files(
        self,
        path: str,
        pattern: str,
        glob_filter: str | None = None,
        case_sensitive: bool = False,
        max_results: int = 100,
    ) -> tuple[list[GrepMatch], bool]:
        flags = "" if case_sensitive else "i"
        include = f"--include={shlex.quote(glob_filter)}" if glob_filter else ""
        cmd = (
            f"grep -rn{flags} {include} -m {max_results + 1} "
            f"-e {shlex.quote(pattern)} {shlex.quote(path)} 2>/dev/null "
            f"| head -{max_results + 1}"
        )
        result = await self.exec_command(f"_grep_{uuid.uuid4().hex[:6]}", "/", cmd)
        matches: list[GrepMatch] = []
        for line in result.output.splitlines():
            parts = line.split(":", 2)
            if len(parts) >= 3:
                try:
                    matches.append(GrepMatch(path=parts[0], line_number=int(parts[1]), line=parts[2]))
                except ValueError:
                    continue
        truncated = len(matches) > max_results
        return matches[:max_results], truncated
