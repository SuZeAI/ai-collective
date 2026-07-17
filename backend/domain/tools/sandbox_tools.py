"""SandboxToolkit — high-level sandbox tools (bash, ls, glob, grep, read_file, write_file, str_replace).

All operations are strictly confined to the staff run's thread workspace:
  {SANDBOX_WORKSPACE}/{thread_id}/

File tools reject any path outside that boundary.
Bash commands run with HOME/TMPDIR set to the workspace and 'cd' restricted
to prevent escaping (best-effort in local mode; hard-enforced in k8s).

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

import os
import re
from typing import Any, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

# Output truncation limits (characters).  0 = disabled.
_BASH_MAX_CHARS = 20_000
_READ_MAX_CHARS = 50_000
_LS_MAX_CHARS = 20_000


def _truncate_middle(output: str, max_chars: int) -> str:
    if max_chars == 0 or len(output) <= max_chars:
        return output
    total = len(output)
    marker = f"\n... [middle truncated: {total - max_chars} chars skipped] ...\n"
    kept = max(0, max_chars - len(marker))
    head = kept // 2
    tail = kept - head
    return f"{output[:head]}{marker}{output[-tail:] if tail else ''}"


def _truncate_head(output: str, max_chars: int, hint: str = "Use start_line/end_line to read a specific range") -> str:
    if max_chars == 0 or len(output) <= max_chars:
        return output
    total = len(output)
    marker = f"\n... [truncated: showing first {max_chars} of {total} chars. {hint}] ..."
    kept = max(0, max_chars - len(marker))
    return f"{output[:kept]}{marker}"


def _get_sandbox(sandbox=None, session_id: str | None = None):
    if sandbox is not None:
        return sandbox
    from backend.infrastructure.sandbox.factory import create_sandbox_adapter
    return create_sandbox_adapter(session_id=session_id)


class SandboxToolkit(BaseToolkit):
    """All-in-one sandbox toolkit with strict workspace confinement.

    Every staff run is isolated inside ``{SANDBOX_WORKSPACE}/{thread_id}/``.
    All file operations reject paths outside that directory; bash commands
    start in that directory with HOME/TMPDIR scoped there and cd restricted.
    """

    name: str = "sandbox"

    def __init__(self, sandbox=None, workspace: str | None = None, session_id: str | None = None, **kwargs):
        super().__init__(**kwargs)
        # session_id keys the underlying sandbox (e.g. per-conversation Pod in
        # k8s mode); ignored for the local host-FS adapter.
        self.sandbox = _get_sandbox(sandbox, session_id=session_id)
        from backend.infrastructure.sandbox.local_sandbox import LocalSandboxAdapter
        if workspace:
            self._base_workspace = workspace
        elif isinstance(self.sandbox, LocalSandboxAdapter):
            self._base_workspace = self.sandbox._workspace
        else:
            self._base_workspace = "/workspace"
        self.workspace = self._base_workspace

    # ── Workspace helpers ─────────────────────────────────────────────────────

    def _resolve_workspace(self, thread_id: str | None) -> str:
        """Return ``{_base_workspace}/{thread_id}`` or base when no thread_id."""
        if thread_id:
            return os.path.join(self._base_workspace, thread_id)
        return self._base_workspace

    def _confine_path(self, path: str, workspace: str) -> str:
        """Resolve *path* and assert it is inside *workspace*.

        Relative paths are anchored to *workspace*.
        Raises ``PermissionError`` for any path that escapes the boundary,
        including ``..`` traversal and symlink targets outside the workspace.
        """
        # Anchor relative paths to workspace
        if not os.path.isabs(path):
            path = os.path.join(workspace, path)

        # Normalize to collapse .. without following symlinks
        norm_path = os.path.normpath(path)
        norm_ws = os.path.normpath(workspace)

        if norm_path != norm_ws and not norm_path.startswith(norm_ws + os.sep):
            raise PermissionError(
                f"Sandbox violation: '{path}' is outside the thread workspace "
                f"'{workspace}'. All operations must stay within the workspace."
            )

        # Guard against symlink escape for existing paths
        if os.path.exists(norm_path):
            real_path = os.path.realpath(norm_path)
            real_ws = os.path.realpath(norm_ws)
            if real_path != real_ws and not real_path.startswith(real_ws + os.sep):
                raise PermissionError(
                    f"Sandbox violation: '{path}' resolves via symlink to "
                    f"'{real_path}' which is outside the thread workspace."
                )

        return norm_path

    def _bash_prelude(self, workspace: str) -> str:
        """Return bash code that confines the shell session to *workspace*.

        Sets HOME/TMPDIR to workspace and overrides ``cd`` so it cannot
        navigate outside the workspace boundary.
        """
        # Escape workspace for single-quoted bash assignment
        ws_sq = workspace.replace("'", "'\\''")
        return (
            f"__SANDBOX_WS='{ws_sq}'\n"
            "cd() {\n"
            "    local __t=\"${1:-$__SANDBOX_WS}\"\n"
            "    local __here=\"$PWD\"\n"
            "    builtin cd \"$__t\" 2>/dev/null || "
            "{ echo \"sandbox: no such directory: $__t\" >&2; return 1; }\n"
            "    case \"$PWD\" in\n"
            "        \"$__SANDBOX_WS\"|\"$__SANDBOX_WS\"/*) ;;\n"
            "        *) builtin cd \"$__here\"; "
            "echo \"sandbox: cd restricted to $__SANDBOX_WS\" >&2; return 1 ;;\n"
            "    esac\n"
            "}\n"
            "export HOME=\"$__SANDBOX_WS\"\n"
            "export TMPDIR=\"$__SANDBOX_WS/.tmp\"\n"
            "mkdir -p \"$TMPDIR\"\n"
        )

    # ── Shell ─────────────────────────────────────────────────────────────────

    @tool(parse_docstring=True)
    async def sandbox_bash(self, description: str, command: str, session_id: str = "default") -> Any:
        """Execute a bash command inside the sandbox workspace.

        The command runs inside the staff's isolated workspace directory.
        ``cd`` is restricted so the shell cannot leave the workspace.
        HOME and TMPDIR are scoped to the workspace.

        Args:
            description: Brief explanation of why this command is being run.
            command: The bash command to execute (supports multi-line with &&).
            session_id: Named sub-session within this staff run (default: "default").
        """
        from backend.infrastructure.sandbox.local_sandbox import LocalSandboxAdapter
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id

        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)

        if isinstance(self.sandbox, LocalSandboxAdapter):
            os.makedirs(workspace, exist_ok=True)

        scoped_session = f"{thread_id}:{session_id}" if thread_id else session_id

        # Prepend bash prelude that confines cd, HOME, TMPDIR to workspace
        confined_command = self._bash_prelude(workspace) + command

        result = await self.sandbox.exec_command(scoped_session, workspace, confined_command)
        return _truncate_middle(str(result), _BASH_MAX_CHARS)

    # ── File system ───────────────────────────────────────────────────────────

    @tool(parse_docstring=True)
    async def sandbox_ls(self, description: str, path: str) -> Any:
        """List the contents of a directory up to 2 levels deep.

        Path must be inside the staff's sandbox workspace.

        Args:
            description: Brief explanation of why you are listing this directory.
            path: Path to the directory to list (absolute or relative to workspace).
        """
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id
        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)
        try:
            safe_path = self._confine_path(path, workspace)
            entries = await self.sandbox.list_dir(safe_path)
            if not entries:
                return "(empty)"
            return _truncate_head("\n".join(entries), _LS_MAX_CHARS, "Use a more specific path")
        except PermissionError as exc:
            return f"Error: {exc}"
        except FileNotFoundError:
            return f"Error: Directory not found: {path}"
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
        """Find files matching a glob pattern under a directory in the workspace.

        Path must be inside the staff's sandbox workspace.

        Args:
            description: Brief explanation of why you are searching for these paths.
            pattern: Glob pattern relative to root, e.g. ``**/*.py``.
            path: Root directory to search under (absolute or relative to workspace).
            max_results: Maximum number of paths to return (default 200, max 1000).
        """
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id
        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)
        try:
            safe_path = self._confine_path(path, workspace)
            limit = max(1, min(max_results, 1000))
            matches, truncated = await self.sandbox.glob_files(safe_path, pattern, limit)
            if not matches:
                return f"No files matched pattern '{pattern}' under {safe_path}"
            lines = [f"Found {len(matches)} paths under {safe_path}" + (" (truncated)" if truncated else "")]
            lines.extend(f"{i}. {p}" for i, p in enumerate(matches, 1))
            if truncated:
                lines.append("Results truncated — narrow the pattern or path.")
            return "\n".join(lines)
        except PermissionError as exc:
            return f"Error: {exc}"
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
        """Search for matching lines inside files within the workspace.

        Path must be inside the staff's sandbox workspace.

        Args:
            description: Brief explanation of why you are searching file contents.
            pattern: String or regex pattern to search for.
            path: Root directory to search under (absolute or relative to workspace).
            glob_filter: Optional file glob to filter candidates, e.g. ``**/*.py``.
            literal: Treat pattern as a plain string (default False).
            case_sensitive: Case-sensitive matching (default False).
            max_results: Maximum matching lines to return (default 100, max 500).
        """
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id
        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)
        try:
            if literal:
                pattern = re.escape(pattern)
            safe_path = self._confine_path(path, workspace)
            limit = max(1, min(max_results, 500))
            matches, truncated = await self.sandbox.grep_files(
                safe_path, pattern,
                glob_filter=glob_filter,
                case_sensitive=case_sensitive,
                max_results=limit,
            )
            if not matches:
                return f"No matches found under {safe_path}"
            lines = [f"Found {len(matches)} matches under {safe_path}" + (" (truncated)" if truncated else "")]
            lines.extend(f"{m.path}:{m.line_number}: {m.line}" for m in matches)
            if truncated:
                lines.append("Results truncated — narrow the path or add a glob filter.")
            return "\n".join(lines)
        except PermissionError as exc:
            return f"Error: {exc}"
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
        """Read the contents of a file inside the workspace.

        Path must be inside the staff's sandbox workspace.

        Args:
            description: Brief explanation of why you are reading this file.
            path: Path to the file (absolute or relative to workspace).
            start_line: Starting line number, 1-indexed inclusive (optional).
            end_line: Ending line number, 1-indexed inclusive (optional).
        """
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id
        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)
        try:
            safe_path = self._confine_path(path, workspace)
            content = await self.sandbox.read_file(safe_path, start_line, end_line)
            return _truncate_head(content, _READ_MAX_CHARS)
        except PermissionError as exc:
            return f"Error: {exc}"
        except FileNotFoundError:
            return f"Error: File not found: {path}"
        except IsADirectoryError:
            return f"Error: Path is a directory, not a file: {path}"
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
        """Write text content to a file inside the workspace.

        Parent directories are created automatically.
        Path must be inside the staff's sandbox workspace.

        Args:
            description: Brief explanation of why you are writing this file.
            path: Path to the file (absolute or relative to workspace).
            content: Text content to write.
            append: Append to the file instead of overwriting (default False).
        """
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id
        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)
        try:
            safe_path = self._confine_path(path, workspace)
            await self.sandbox.write_file(safe_path, content, append)
            return "OK"
        except PermissionError as exc:
            return f"Error: {exc}"
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
        """Replace a substring in a file inside the workspace.

        When replace_all is False (default), old_str must appear exactly once.
        Path must be inside the staff's sandbox workspace.

        Args:
            description: Brief explanation of why you are replacing this string.
            path: Path to the file to modify (absolute or relative to workspace).
            old_str: The substring to replace.
            new_str: The replacement substring.
            replace_all: Replace every occurrence (default False).
        """
        from backend.infrastructure.sandbox.sandbox_session import get_current_thread_id
        thread_id = get_current_thread_id()
        workspace = self._resolve_workspace(thread_id)
        try:
            safe_path = self._confine_path(path, workspace)
            content = await self.sandbox.read_file(safe_path)
            if old_str not in content:
                return f"Error: String not found in file: {safe_path}"
            if not replace_all and content.count(old_str) > 1:
                return (
                    f"Error: String appears {content.count(old_str)} times — "
                    "provide a more specific old_str or set replace_all=True"
                )
            updated = content.replace(old_str, new_str) if replace_all else content.replace(old_str, new_str, 1)
            await self.sandbox.write_file(safe_path, updated)
            return "OK"
        except PermissionError as exc:
            return f"Error: {exc}"
        except FileNotFoundError:
            return f"Error: File not found: {path}"
        except Exception as exc:
            return f"Error: {exc}"
