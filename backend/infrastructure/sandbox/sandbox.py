"""Abstract base classes and shared types for sandbox environments."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

from pydantic import BaseModel


class SandboxResult(BaseModel):
    output: str
    exit_code: int | None = None

    def __str__(self) -> str:
        if self.exit_code is not None:
            return f"{self.output}\n[exit_code: {self.exit_code}]"
        return self.output


class GrepMatch(BaseModel):
    path: str
    line_number: int
    line: str


class Sandbox(ABC):
    """Abstract base class for sandbox environments.

    Implementations:
        LocalSandboxAdapter — runs commands directly on the host (local/dev mode)
        AioSandbox          — runs commands inside a K8s pod via HTTP (k8s mode)
    """

    # ── Shell operations (session-based) ──────────────────────────────────────

    @abstractmethod
    async def exec_command(self, id: str, exec_dir: str, command: str) -> Any:
        """Execute a shell command in the given session and working directory."""
        ...

    @abstractmethod
    async def view_shell(self, id: str) -> Any:
        """Return current/last output for a shell session."""
        ...

    @abstractmethod
    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> Any:
        """Wait for the running process in a session to complete."""
        ...

    @abstractmethod
    async def write_to_process(self, id: str, input: str, press_enter: bool) -> Any:
        """Write input to an interactive process in a session."""
        ...

    @abstractmethod
    async def kill_process(self, id: str) -> Any:
        """Terminate the process running in a session."""
        ...

    # ── File operations ───────────────────────────────────────────────────────

    @abstractmethod
    async def read_file(
        self,
        path: str,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> str:
        """Read file content; optionally slice by 1-indexed line range."""
        ...

    @abstractmethod
    async def write_file(self, path: str, content: str, append: bool = False) -> None:
        """Write or append content to a file, auto-creating parent dirs."""
        ...

    @abstractmethod
    async def list_dir(self, path: str, max_depth: int = 2) -> list[str]:
        """Return all paths up to *max_depth* levels under *path*."""
        ...

    @abstractmethod
    async def glob_files(
        self,
        path: str,
        pattern: str,
        max_results: int = 200,
    ) -> tuple[list[str], bool]:
        """Glob *pattern* recursively under *path*; returns (matches, truncated)."""
        ...

    @abstractmethod
    async def grep_files(
        self,
        path: str,
        pattern: str,
        glob_filter: str | None = None,
        case_sensitive: bool = False,
        max_results: int = 100,
    ) -> tuple[list[GrepMatch], bool]:
        """Regex-search files under *path*; returns (matches, truncated)."""
        ...
