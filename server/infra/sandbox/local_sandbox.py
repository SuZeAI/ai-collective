"""Local sandbox — executes commands directly on the host (dev-only, no isolation).

Each exec_command call is an independent subprocess; exec_dir is passed explicitly
so agents don't need stateful `cd` sessions.
"""
from __future__ import annotations

import asyncio
import glob as _glob_module
import os
import re
import shlex
from pathlib import Path
from typing import Any, Optional

from server.share.log import get_logger

from server.app.ports.sandbox import GrepMatch, Sandbox, SandboxResult

logger = get_logger()

_IGNORE_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".tox", "dist", "build"}

# Deliberate secret-scrubbing, not a sandboxing claim: exec_command spawns a
# real shell on the host with no process isolation (see class docstring), so
# passing the backend's full environment through would let any LLM-generated
# command (including one reached via prompt injection) read out API keys,
# JWT secrets, and DB/queue credentials via `env`/`printenv`. Only pass a
# minimal allowlist a normal shell session needs to function.
_SANDBOX_ENV_ALLOWLIST = {"PATH", "HOME", "LANG", "LC_ALL", "TERM", "TZ", "SHELL", "USER", "PWD", "TMPDIR"}


def _sandbox_subprocess_env() -> dict[str, str]:
    return {k: v for k, v in os.environ.items() if k in _SANDBOX_ENV_ALLOWLIST}


class LocalSandboxAdapter(Sandbox):
    """Sandbox implementation that runs commands directly on the host.

    Each exec_command spawns an independent subprocess. File operations use
    native Python I/O. The workspace directory is auto-created on first use.
    """

    def __init__(self, timeout: int = 60, workspace: str | None = None):
        self._timeout = timeout
        self._workspace = workspace or os.path.join(os.path.expanduser("~"), "sandbox_workspace")
        self._results: dict[str, SandboxResult] = {}
        self._procs: dict[str, asyncio.subprocess.Process] = {}
        self._workspace_ready = False

    def ensure_workspace(self) -> str:
        """Create the workspace directory if it doesn't exist and return its path."""
        if not self._workspace_ready:
            os.makedirs(self._workspace, exist_ok=True)
            self._workspace_ready = True
        return self._workspace

    # ── Shell operations ──────────────────────────────────────────────────────

    async def exec_command(self, id: str, exec_dir: str, command: str) -> SandboxResult:
        if exec_dir == self._workspace:
            self.ensure_workspace()
        safe_dir = shlex.quote(exec_dir)
        shell_cmd = f"cd {safe_dir} 2>&1 || true; {command}"
        try:
            proc = await asyncio.create_subprocess_shell(
                shell_cmd,
                executable="/bin/bash",  # bash required for builtin/function overrides in prelude
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=_sandbox_subprocess_env(),
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
                result = SandboxResult(output=f"Command timed out after {self._timeout}s", exit_code=124)
        except Exception as exc:
            logger.error(f"LocalSandbox exec error for session {id!r}: {exc}")
            result = SandboxResult(output=f"Execution error: {exc}", exit_code=1)

        self._results[id] = result
        self._procs.pop(id, None)
        return result

    async def view_shell(self, id: str) -> SandboxResult:
        return self._results.get(id, SandboxResult(output="No session found"))

    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> SandboxResult:
        proc = self._procs.get(id)
        if proc and proc.returncode is None:
            try:
                await asyncio.wait_for(proc.wait(), timeout=seconds)
            except asyncio.TimeoutError:
                pass
        return await self.view_shell(id)

    async def write_to_process(self, id: str, input: str, press_enter: bool) -> Any:
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

    async def kill_process(self, id: str) -> Any:
        proc = self._procs.pop(id, None)
        if proc and proc.returncode is None:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        self._results.pop(id, None)
        return {"success": True}

    # ── File operations ───────────────────────────────────────────────────────

    async def read_file(
        self,
        path: str,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> str:
        with open(path, "r", errors="replace") as f:
            content = f.read()
        if not content:
            return "(empty)"
        if start_line is not None or end_line is not None:
            lines = content.splitlines()
            s = (start_line or 1) - 1
            e = end_line or len(lines)
            content = "\n".join(lines[s:e])
        return content

    async def write_file(self, path: str, content: str, append: bool = False) -> None:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        mode = "a" if append else "w"
        with open(path, mode, encoding="utf-8") as f:
            f.write(content)

    async def list_dir(self, path: str, max_depth: int = 2) -> list[str]:
        results: list[str] = []
        base = Path(path)
        for root, dirs, files in os.walk(base):
            rel_root = Path(root).relative_to(base)
            depth = len(rel_root.parts)
            dirs[:] = sorted(d for d in dirs if d not in _IGNORE_DIRS and depth < max_depth)
            for fname in sorted(files):
                results.append(str(Path(root) / fname))
            if len(results) >= 500:
                break
        return results

    async def glob_files(
        self,
        path: str,
        pattern: str,
        max_results: int = 200,
    ) -> tuple[list[str], bool]:
        all_matches = _glob_module.glob(os.path.join(path, "**", pattern), recursive=True)
        filtered = [
            m for m in all_matches
            if not any(part in _IGNORE_DIRS for part in Path(m).parts)
        ]
        truncated = len(filtered) > max_results
        return filtered[:max_results], truncated

    async def grep_files(
        self,
        path: str,
        pattern: str,
        glob_filter: str | None = None,
        case_sensitive: bool = False,
        max_results: int = 100,
    ) -> tuple[list[GrepMatch], bool]:
        flags = 0 if case_sensitive else re.IGNORECASE
        try:
            regex = re.compile(pattern, flags)
        except re.error as exc:
            raise ValueError(f"Invalid regex pattern: {exc}") from exc

        if glob_filter:
            candidates = _glob_module.glob(os.path.join(path, "**", glob_filter), recursive=True)
        else:
            candidates = []
            for root, dirs, files in os.walk(path):
                dirs[:] = [d for d in dirs if d not in _IGNORE_DIRS]
                for fname in files:
                    candidates.append(os.path.join(root, fname))

        matches: list[GrepMatch] = []
        truncated = False
        for filepath in candidates:
            if any(part in _IGNORE_DIRS for part in Path(filepath).parts):
                continue
            try:
                with open(filepath, "r", errors="replace") as f:
                    for lineno, line in enumerate(f, 1):
                        if regex.search(line):
                            matches.append(GrepMatch(path=filepath, line_number=lineno, line=line.rstrip()))
                            if len(matches) >= max_results:
                                truncated = True
                                return matches, truncated
            except (OSError, UnicodeDecodeError):
                continue
        return matches, truncated
