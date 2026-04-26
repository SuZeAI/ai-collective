"""SandboxToolkit — high-level sandbox tools (bash, ls, glob, grep, read_file, write_file, str_replace).

The toolkit auto-creates a sandbox adapter from settings if none is provided.
Workspace directory is created automatically on first use.

Available tools:
  sandbox_bash        — execute a shell command
  sandbox_ls          — list directory contents
  sandbox_glob        — find files matching a glob pattern
  sandbox_grep        — search file contents with a regex
  sandbox_read_file   — read a file (with optional line range)
  sandbox_write_file  — write / append content to a file
  sandbox_str_replace — replace a substring in a file
"""
from __future__ import annotations

import re
from typing import Any, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

# Output truncation limits (characters).  0 = disabled.
_BASH_MAX_CHARS = 20_000
_READ_MAX_CHARS = 50_000
_LS_MAX_CHARS = 20_000


def _truncate_middle(output: str, max_chars: int) -> str:
    """Middle-truncate: preserve head + tail since errors can appear anywhere."""
    if max_chars == 0 or len(output) <= max_chars:
        return output
    total = len(output)
    marker = f"\n... [middle truncated: {total - max_chars} chars skipped] ...\n"
    kept = max(0, max_chars - len(marker))
    head = kept // 2
    tail = kept - head
    return f"{output[:head]}{marker}{output[-tail:] if tail else ''}"


def _truncate_head(output: str, max_chars: int, hint: str = "Use start_line/end_line to read a specific range") -> str:
    """Head-truncate: content is front-loaded (source code, ls)."""
    if max_chars == 0 or len(output) <= max_chars:
        return output
    total = len(output)
    marker = f"\n... [truncated: showing first {max_chars} of {total} chars. {hint}] ..."
    kept = max(0, max_chars - len(marker))
    return f"{output[:kept]}{marker}"


def _get_sandbox(sandbox=None):
    """Return *sandbox* as-is, or auto-create one from settings."""
    if sandbox is not None:
        return sandbox
    from backend.api.settings import settings
    from backend.infrastructure.sandbox.factory import create_sandbox_adapter
    return create_sandbox_adapter(
        mode=settings.sandbox_mode,
        sandbox_url=settings.sandbox_url,
        provisioner_url=settings.sandbox_provisioner_url,
        timeout=settings.sandbox_timeout,
    )


class SandboxToolkit(BaseToolkit):
    """All-in-one sandbox toolkit: shell + file system operations.

    The *sandbox* parameter is optional. When omitted, a sandbox adapter is
    created automatically from the application settings
    (``SANDBOX_MODE``, ``SANDBOX_URL``, ``SANDBOX_PROVISIONER_URL``).

    Workspace directory is created on first use (local mode only).
    """

    name: str = "sandbox"

    def __init__(self, sandbox=None, workspace: str | None = None, **kwargs):
        super().__init__(**kwargs)
        self.sandbox = _get_sandbox(sandbox)
        # Workspace is resolved lazily — only created on first tool call.
        # Defaults: local → ~/sandbox_workspace, remote → /workspace
        from backend.infrastructure.sandbox.local_sandbox import LocalSandboxAdapter
        if workspace:
            self.workspace = workspace
        elif isinstance(self.sandbox, LocalSandboxAdapter):
            self.workspace = self.sandbox._workspace  # read default, don't create yet
        else:
            self.workspace = "/workspace"

    # ── Shell ─────────────────────────────────────────────────────────────────

    @tool(parse_docstring=True)
    async def sandbox_bash(self, description: str, command: str, session_id: str = "default") -> Any:
        """Execute a bash command inside the sandbox.

        The workspace directory is auto-created if it does not exist.
        Use absolute paths. For Python code, prefer the sandbox workspace.

        Args:
            description: Brief explanation of why this command is being run.
            command: The bash command to execute (supports multi-line with &&).
            session_id: Unique identifier for this shell session (default: "default").
        """
        # Ensure local workspace exists
        from backend.infrastructure.sandbox.local_sandbox import LocalSandboxAdapter
        if isinstance(self.sandbox, LocalSandboxAdapter):
            self.sandbox.ensure_workspace()

        result = await self.sandbox.exec_command(session_id, self.workspace, command)
        return _truncate_middle(str(result), _BASH_MAX_CHARS)

    # ── File system ───────────────────────────────────────────────────────────

    @tool(parse_docstring=True)
    async def sandbox_ls(self, description: str, path: str) -> Any:
        """List the contents of a directory up to 2 levels deep.

        Args:
            description: Brief explanation of why you are listing this directory.
            path: Absolute path to the directory to list.
        """
        try:
            entries = await self.sandbox.list_dir(path)
            if not entries:
                return "(empty)"
            return _truncate_head("\n".join(entries), _LS_MAX_CHARS, "Use a more specific path")
        except FileNotFoundError:
            return f"Error: Directory not found: {path}"
        except PermissionError:
            return f"Error: Permission denied: {path}"
        except Exception as exc:
            return f"Error: {exc}"

    @tool(parse_docstring=True)
    async def sandbox_glob(
        self,
        description: str,
        pattern: str,
        path: str,
        max_results: int = 200,
    ) -> Any:
        """Find files matching a glob pattern under a root directory.

        Args:
            description: Brief explanation of why you are searching for these paths.
            pattern: Glob pattern relative to root, e.g. ``**/*.py``.
            path: Absolute root directory to search under.
            max_results: Maximum number of paths to return (default 200, max 1000).
        """
        try:
            limit = max(1, min(max_results, 1000))
            matches, truncated = await self.sandbox.glob_files(path, pattern, limit)
            if not matches:
                return f"No files matched pattern '{pattern}' under {path}"
            lines = [f"Found {len(matches)} paths under {path}" + (" (truncated)" if truncated else "")]
            lines.extend(f"{i}. {p}" for i, p in enumerate(matches, 1))
            if truncated:
                lines.append("Results truncated — narrow the pattern or path.")
            return "\n".join(lines)
        except FileNotFoundError:
            return f"Error: Directory not found: {path}"
        except Exception as exc:
            return f"Error: {exc}"

    @tool(parse_docstring=True)
    async def sandbox_grep(
        self,
        description: str,
        pattern: str,
        path: str,
        glob_filter: Optional[str] = None,
        literal: bool = False,
        case_sensitive: bool = False,
        max_results: int = 100,
    ) -> Any:
        """Search for matching lines inside files under a root directory.

        Args:
            description: Brief explanation of why you are searching file contents.
            pattern: String or regex pattern to search for.
            path: Absolute root directory to search under.
            glob_filter: Optional file glob to filter candidates, e.g. ``**/*.py``.
            literal: Treat pattern as a plain string (default False).
            case_sensitive: Case-sensitive matching (default False).
            max_results: Maximum matching lines to return (default 100, max 500).
        """
        try:
            if literal:
                pattern = re.escape(pattern)
            limit = max(1, min(max_results, 500))
            matches, truncated = await self.sandbox.grep_files(
                path, pattern,
                glob_filter=glob_filter,
                case_sensitive=case_sensitive,
                max_results=limit,
            )
            if not matches:
                return f"No matches found under {path}"
            lines = [f"Found {len(matches)} matches under {path}" + (" (truncated)" if truncated else "")]
            lines.extend(f"{m.path}:{m.line_number}: {m.line}" for m in matches)
            if truncated:
                lines.append("Results truncated — narrow the path or add a glob filter.")
            return "\n".join(lines)
        except re.error as exc:
            return f"Error: Invalid regex pattern: {exc}"
        except FileNotFoundError:
            return f"Error: Directory not found: {path}"
        except ValueError as exc:
            return f"Error: {exc}"
        except Exception as exc:
            return f"Error: {exc}"

    @tool(parse_docstring=True)
    async def sandbox_read_file(
        self,
        description: str,
        path: str,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
    ) -> Any:
        """Read the contents of a text file.

        Args:
            description: Brief explanation of why you are reading this file.
            path: Absolute path to the file to read.
            start_line: Starting line number, 1-indexed inclusive (optional).
            end_line: Ending line number, 1-indexed inclusive (optional).
        """
        try:
            content = await self.sandbox.read_file(path, start_line, end_line)
            return _truncate_head(content, _READ_MAX_CHARS)
        except FileNotFoundError:
            return f"Error: File not found: {path}"
        except IsADirectoryError:
            return f"Error: Path is a directory, not a file: {path}"
        except PermissionError:
            return f"Error: Permission denied: {path}"
        except Exception as exc:
            return f"Error: {exc}"

    @tool(parse_docstring=True)
    async def sandbox_write_file(
        self,
        description: str,
        path: str,
        content: str,
        append: bool = False,
    ) -> Any:
        """Write text content to a file (creates parent directories automatically).

        Args:
            description: Brief explanation of why you are writing this file.
            path: Absolute path to the file to write.
            content: Text content to write.
            append: Append to the file instead of overwriting (default False).
        """
        try:
            await self.sandbox.write_file(path, content, append)
            return "OK"
        except PermissionError:
            return f"Error: Permission denied writing to: {path}"
        except IsADirectoryError:
            return f"Error: Path is a directory: {path}"
        except OSError as exc:
            return f"Error: Failed to write file '{path}': {exc}"
        except Exception as exc:
            return f"Error: {exc}"

    @tool(parse_docstring=True)
    async def sandbox_str_replace(
        self,
        description: str,
        path: str,
        old_str: str,
        new_str: str,
        replace_all: bool = False,
    ) -> Any:
        """Replace a substring in a file.

        When replace_all is False (default), old_str must appear exactly once.

        Args:
            description: Brief explanation of why you are replacing this string.
            path: Absolute path to the file to modify.
            old_str: The substring to replace.
            new_str: The replacement substring.
            replace_all: Replace every occurrence (default False).
        """
        try:
            content = await self.sandbox.read_file(path)
            if old_str not in content:
                return f"Error: String not found in file: {path}"
            if not replace_all and content.count(old_str) > 1:
                return (
                    f"Error: String appears {content.count(old_str)} times — "
                    "provide a more specific old_str or set replace_all=True"
                )
            updated = content.replace(old_str, new_str) if replace_all else content.replace(old_str, new_str, 1)
            await self.sandbox.write_file(path, updated)
            return "OK"
        except FileNotFoundError:
            return f"Error: File not found: {path}"
        except PermissionError:
            return f"Error: Permission denied: {path}"
        except Exception as exc:
            return f"Error: {exc}"
