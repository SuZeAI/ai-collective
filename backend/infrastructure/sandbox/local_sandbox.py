"""Local sandbox — executes shell commands directly on the host via asyncio subprocess.

WARNING: Not a security isolation boundary. Use only for local/trusted environments.
Each exec_command is an independent subprocess; exec_dir is passed explicitly per-call
so agents don't need stateful `cd` sessions.
"""
from __future__ import annotations

import asyncio
import shlex
from typing import Any, Optional

from pydantic import BaseModel

from backend.log import get_logger

logger = get_logger()


class SandboxResult(BaseModel):
    output: str
    exit_code: int | None = None

    def __str__(self) -> str:
        if self.exit_code is not None:
            return f"{self.output}\n[exit_code: {self.exit_code}]"
        return self.output


class LocalSandboxAdapter:
    """SandboxPort implementation that runs commands directly on the host.

    Each call to exec_command spawns an independent subprocess.
    Results are cached by session ID so view_shell / wait_for_process work.
    """

    def __init__(self, timeout: int = 60):
        self._timeout = timeout
        self._results: dict[str, SandboxResult] = {}
        self._procs: dict[str, asyncio.subprocess.Process] = {}

    async def exec_command(self, id: str, exec_dir: str, command: str) -> SandboxResult:
        """Run *command* inside *exec_dir*, return stdout+stderr output."""
        safe_dir = shlex.quote(exec_dir)
        shell_cmd = f"cd {safe_dir} 2>&1 || true; {command}"
        try:
            proc = await asyncio.create_subprocess_shell(
                shell_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            self._procs[id] = proc
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=self._timeout)
                result = SandboxResult(
                    output=stdout.decode(errors="replace").strip() or "(no output)",
                    exit_code=proc.returncode,
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                result = SandboxResult(
                    output=f"Command timed out after {self._timeout}s",
                    exit_code=124,
                )
        except Exception as exc:
            logger.error(f"LocalSandbox exec error for session {id!r}: {exc}")
            result = SandboxResult(output=f"Execution error: {exc}", exit_code=1)

        self._results[id] = result
        self._procs.pop(id, None)
        return result

    async def view_shell(self, id: str) -> SandboxResult:
        """Return cached output for session *id*."""
        return self._results.get(id, SandboxResult(output="No session found", exit_code=None))

    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> SandboxResult:
        """Wait for a running process; for local mode commands are synchronous."""
        proc = self._procs.get(id)
        if proc and proc.returncode is None:
            try:
                await asyncio.wait_for(proc.wait(), timeout=seconds)
            except asyncio.TimeoutError:
                pass
        return await self.view_shell(id)

    async def write_to_process(self, id: str, input: str, press_enter: bool) -> dict[str, Any]:
        """Write to stdin of a running process (long-running commands only)."""
        proc = self._procs.get(id)
        if proc and proc.stdin and proc.returncode is None:
            data = (input + "\n") if press_enter else input
            proc.stdin.write(data.encode())
            try:
                await proc.stdin.drain()
            except Exception:
                pass
            return {"success": True}
        return {"success": False, "error": "No running process for this session"}

    async def kill_process(self, id: str) -> dict[str, Any]:
        """Terminate a running process."""
        proc = self._procs.pop(id, None)
        if proc and proc.returncode is None:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        self._results.pop(id, None)
        return {"success": True}
