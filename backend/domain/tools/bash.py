from __future__ import annotations

from typing import Any, Optional, Protocol

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit


class SandboxPort(Protocol):
    async def exec_command(self, id: str, exec_dir: str, command: str) -> Any: ...

    async def view_shell(self, id: str) -> Any: ...

    async def wait_for_process(self, id: str, seconds: Optional[int] = None) -> Any: ...

    async def write_to_process(self, id: str, input: str, press_enter: bool) -> Any: ...

    async def kill_process(self, id: str) -> Any: ...


class BashToolkit(BaseToolkit):
    """Bash tool class for shell interaction."""

    name: str = "bash"

    def __init__(self, sandbox: SandboxPort, **kwargs):
        super().__init__(**kwargs)
        self.sandbox = sandbox

    @tool(parse_docstring=True)
    async def bash_exec(self, id: str, exec_dir: str, command: str) -> Any:
        """Execute commands in a specified shell session.

        Args:
            id: Unique identifier of the target shell session.
            exec_dir: Working directory for command execution (absolute path).
            command: Shell command to execute.
        """
        return await self.sandbox.exec_command(id, exec_dir, command)

    @tool(parse_docstring=True)
    async def bash_view(self, id: str) -> Any:
        """View the output of a specified shell session.

        Args:
            id: Unique identifier of the target shell session.
        """
        return await self.sandbox.view_shell(id)

    @tool(parse_docstring=True)
    async def bash_wait(self, id: str, seconds: Optional[int] = None) -> Any:
        """Wait for a running process in a specified shell session.

        Args:
            id: Unique identifier of the target shell session.
            seconds: Wait duration in seconds.
        """
        return await self.sandbox.wait_for_process(id, seconds)

    @tool(parse_docstring=True)
    async def bash_write_to_process(self, id: str, input: str, press_enter: bool) -> Any:
        """Write input to an interactive process in a shell session.

        Args:
            id: Unique identifier of the target shell session.
            input: Input content to write to the process.
            press_enter: Whether to press Enter after input.
        """
        return await self.sandbox.write_to_process(id, input, press_enter)

    @tool(parse_docstring=True)
    async def bash_kill_process(self, id: str) -> Any:
        """Terminate a running process in a specified shell session.

        Args:
            id: Unique identifier of the target shell session.
        """
        return await self.sandbox.kill_process(id)