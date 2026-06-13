"""MCP (Model Context Protocol) toolkit — exposes any MCP server as a skill.

A skill with ``tool_name = "mcp"`` turns an external MCP server into a regular
toolkit: at bind time the toolkit connects to the server, discovers its tools
(name, description, JSON input schema) and wraps each one as a LangChain
``BaseTool`` the agents can call like any built-in tool.

Supported transports (``transport`` config field):

- ``stdio``           — spawn a local server process (``command`` + ``args`` + ``env``)
- ``streamable_http`` — connect to a remote server over HTTP (``url`` + ``headers``)
- ``sse``             — legacy HTTP+SSE transport (``url`` + ``headers``)

Design notes:

- Tool discovery happens once, synchronously, when the toolkit is instantiated
  (skill bind time). It runs the async MCP handshake on a dedicated thread so
  it works whether or not the caller already sits inside an event loop.
- Tool calls open a fresh, short-lived session per invocation. This avoids the
  anyio cancel-scope pitfalls of keeping a long-lived session across LangGraph
  tasks, at the cost of a per-call handshake (cheap for HTTP; a process spawn
  for stdio). Results are cached nowhere — MCP servers own their own state.
- Config values arrive as strings from the skill UI; ``args``/``env``/
  ``headers`` accept both JSON and line-based formats (see parsers below).

See ``docs/MCP_GUIDE.md`` for the full configuration guide.
"""

from __future__ import annotations

import asyncio
import json
import shlex
import threading
from contextlib import asynccontextmanager
from typing import Any

from langchain.messages import ToolMessage
from langchain.tools import BaseTool

from backend.api.settings import settings
from backend.domain.tools.base import BaseToolkit
from backend.log import get_logger

logger = get_logger(__name__)

# Wall-clock ceiling for the initial list_tools handshake at bind time.
MCP_DISCOVERY_TIMEOUT_SECONDS = max(5, settings.mcp.discovery_timeout_seconds)
# Default per-tool-call timeout (overridable per skill via `timeout_seconds`).
MCP_CALL_TIMEOUT_SECONDS = max(5, settings.mcp.call_timeout_seconds)

_VALID_TRANSPORTS = ("stdio", "streamable_http", "sse")


# ------------------------------------------------------------------ #
# Config parsing (skill config fields arrive as strings from the UI)   #
# ------------------------------------------------------------------ #

def parse_args(raw: Any) -> list[str]:
    """Parse the ``args`` field: JSON array, or shell-style split string."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(a) for a in raw]
    text = str(raw).strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(a) for a in parsed]
        except Exception:  # noqa: BLE001 - fall through to shlex
            pass
    return shlex.split(text)


def parse_key_values(raw: Any) -> dict[str, str]:
    """Parse ``env``/``headers``: JSON object, or KEY=VALUE / KEY: VALUE lines."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return {str(k): str(v) for k, v in raw.items()}
    text = str(raw).strip()
    if not text:
        return {}
    if text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return {str(k): str(v) for k, v in parsed.items()}
        except Exception:  # noqa: BLE001 - fall through to line format
            pass
    result: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for sep in ("=", ":"):
            if sep in line:
                key, _, value = line.partition(sep)
                if key.strip():
                    result[key.strip()] = value.strip()
                break
    return result


def parse_allowed_tools(raw: Any) -> set[str]:
    """Parse the optional comma/newline-separated tool whitelist."""
    if raw is None:
        return set()
    if isinstance(raw, (list, set, tuple)):
        return {str(t).strip() for t in raw if str(t).strip()}
    text = str(raw).strip()
    if not text:
        return set()
    return {t.strip() for t in text.replace("\n", ",").split(",") if t.strip()}


def _parse_timeout(raw: Any, default: int) -> int:
    try:
        return max(5, int(float(str(raw).strip())))
    except Exception:  # noqa: BLE001 - any malformed value falls back
        return default


# ------------------------------------------------------------------ #
# Connection spec + session factory                                    #
# ------------------------------------------------------------------ #

class MCPServerSpec:
    """Validated connection parameters for one MCP server."""

    def __init__(
        self,
        *,
        transport: str = "stdio",
        command: str = "",
        args: Any = None,
        env: Any = None,
        url: str = "",
        headers: Any = None,
    ):
        self.transport = (transport or "stdio").strip().lower()
        if self.transport == "http":  # friendly alias
            self.transport = "streamable_http"
        if self.transport not in _VALID_TRANSPORTS:
            raise ValueError(
                f"Unsupported MCP transport '{transport}'. "
                f"Use one of: {', '.join(_VALID_TRANSPORTS)}."
            )

        self.command = (command or "").strip()
        self.args = parse_args(args)
        self.env = parse_key_values(env)
        self.url = (url or "").strip()
        self.headers = parse_key_values(headers)

        if self.transport == "stdio" and not self.command:
            raise ValueError("MCP stdio transport requires a 'command' (e.g. npx, uvx, python).")
        if self.transport in ("streamable_http", "sse") and not self.url:
            raise ValueError(f"MCP {self.transport} transport requires a 'url'.")

    def describe(self) -> str:
        if self.transport == "stdio":
            return f"stdio:{self.command} {' '.join(self.args)}".strip()
        return f"{self.transport}:{self.url}"


@asynccontextmanager
async def _open_session(spec: MCPServerSpec):
    """Open a short-lived initialized MCP client session for ``spec``."""
    from mcp import ClientSession

    if spec.transport == "stdio":
        from mcp import StdioServerParameters
        from mcp.client.stdio import get_default_environment, stdio_client

        params = StdioServerParameters(
            command=spec.command,
            args=spec.args,
            env={**get_default_environment(), **spec.env},
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session
    elif spec.transport == "streamable_http":
        from mcp.client.streamable_http import streamablehttp_client

        async with streamablehttp_client(spec.url, headers=spec.headers or None) as (
            read,
            write,
            _get_session_id,
        ):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session
    else:  # sse
        from mcp.client.sse import sse_client

        async with sse_client(spec.url, headers=spec.headers or None) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session


def _run_coro_blocking(coro, timeout: float):
    """Run ``coro`` to completion on a dedicated thread with its own loop.

    Toolkit instantiation is synchronous but may happen inside a running event
    loop (FastAPI handlers); ``asyncio.run`` on a fresh thread works in both
    worlds without touching the caller's loop.
    """
    result: dict[str, Any] = {}

    def runner() -> None:
        try:
            result["value"] = asyncio.run(asyncio.wait_for(coro, timeout=timeout))
        except BaseException as exc:  # noqa: BLE001 - surfaced to caller below
            result["error"] = exc

    thread = threading.Thread(target=runner, name="mcp-discovery", daemon=True)
    thread.start()
    thread.join(timeout + 5)
    if thread.is_alive():
        raise TimeoutError(f"MCP discovery did not finish within {timeout}s")
    if "error" in result:
        raise result["error"]
    return result.get("value")


def _render_call_result(result: Any) -> str:
    """Flatten an MCP CallToolResult into plain text for the LLM."""
    parts: list[str] = []
    for block in getattr(result, "content", None) or []:
        text = getattr(block, "text", None)
        if isinstance(text, str) and text:
            parts.append(text)
            continue
        # Non-text blocks (images, resources): keep a compact reference.
        block_type = getattr(block, "type", block.__class__.__name__)
        uri = getattr(getattr(block, "resource", None), "uri", None) or getattr(block, "uri", None)
        parts.append(f"[{block_type}{f': {uri}' if uri else ''}]")
    structured = getattr(result, "structuredContent", None)
    if not parts and structured is not None:
        try:
            parts.append(json.dumps(structured, ensure_ascii=False, default=str))
        except Exception:  # noqa: BLE001
            parts.append(str(structured))
    text = "\n".join(parts).strip() or "(empty result)"
    if getattr(result, "isError", False):
        return f"[mcp tool error] {text}"
    return text


# ------------------------------------------------------------------ #
# Remote tool wrapper                                                  #
# ------------------------------------------------------------------ #

class MCPRemoteTool(BaseTool):
    """LangChain adapter for one remote MCP tool (fresh session per call)."""

    name: str = ""
    description: str = ""
    args_schema: dict | None = None

    def __init__(
        self,
        *,
        spec: MCPServerSpec,
        remote_name: str,
        exposed_name: str,
        description: str,
        input_schema: dict | None,
        timeout_seconds: int,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.name = exposed_name
        self.description = description or f"MCP tool '{remote_name}' on {spec.describe()}"
        self.args_schema = input_schema or {"type": "object", "properties": {}}
        self._spec = spec
        self._remote_name = remote_name
        self._timeout_seconds = timeout_seconds

    def _run(self, **kwargs: Any) -> Any:  # pragma: no cover - async-only path
        raise NotImplementedError("MCP tools are async-only; use ainvoke().")

    async def _call_remote(self, args: dict) -> str:
        async with asyncio.timeout(self._timeout_seconds):
            async with _open_session(self._spec) as session:
                result = await session.call_tool(self._remote_name, args or {})
                return _render_call_result(result)

    async def ainvoke(self, input: Any, config: Any = None, **kwargs: Any) -> ToolMessage:
        args = input.get("args", {}) if isinstance(input, dict) else {}
        tool_call_id = input.get("id", "") if isinstance(input, dict) else ""
        try:
            content = await self._call_remote(args)
        except asyncio.CancelledError:
            raise
        except TimeoutError:
            content = (
                f"[mcp timeout] '{self._remote_name}' on {self._spec.describe()} "
                f"did not answer within {self._timeout_seconds}s."
            )
        except Exception as exc:  # noqa: BLE001 - server errors are heterogeneous
            logger.exception("MCP tool '%s' failed (%s)", self._remote_name, self._spec.describe())
            content = f"[mcp error] '{self._remote_name}' failed: {exc}"
        return ToolMessage(tool_call_id=tool_call_id, name=self.name, content=content)


# ------------------------------------------------------------------ #
# Toolkit                                                              #
# ------------------------------------------------------------------ #

class MCPToolkit(BaseToolkit):
    """Toolkit exposing every tool of one MCP server, configured per skill."""

    name: str = "mcp"

    def __init__(
        self,
        *,
        transport: str = "stdio",
        command: str = "",
        args: Any = None,
        env: Any = None,
        url: str = "",
        headers: Any = None,
        allowed_tools: Any = None,
        timeout_seconds: Any = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self._spec = MCPServerSpec(
            transport=transport, command=command, args=args, env=env, url=url, headers=headers
        )
        self._timeout_seconds = _parse_timeout(timeout_seconds, MCP_CALL_TIMEOUT_SECONDS)
        whitelist = parse_allowed_tools(allowed_tools)
        suffix = ""
        override = kwargs.get("tool_name_override")
        if override:
            suffix = "_" + self._sanitize_tool_name(str(override))

        try:
            remote_tools = _run_coro_blocking(
                self._list_remote_tools(), MCP_DISCOVERY_TIMEOUT_SECONDS
            )
        except Exception as exc:  # noqa: BLE001 - fail fast with a clear message
            raise ValueError(
                f"Could not connect to MCP server ({self._spec.describe()}): {exc}"
            ) from exc

        skipped: list[str] = []
        for remote in remote_tools:
            if whitelist and remote.name not in whitelist:
                skipped.append(remote.name)
                continue
            exposed = self._sanitize_tool_name(remote.name) + suffix
            self.tools.append(
                MCPRemoteTool(
                    spec=self._spec,
                    remote_name=remote.name,
                    exposed_name=exposed,
                    description=remote.description or "",
                    input_schema=getattr(remote, "inputSchema", None),
                    timeout_seconds=self._timeout_seconds,
                )
            )
        if not self.tools:
            raise ValueError(
                f"MCP server ({self._spec.describe()}) exposed no usable tools"
                + (f" after whitelist filter (skipped: {', '.join(skipped)})" if skipped else "")
                + "."
            )
        logger.info(
            "MCP toolkit bound: server=%s tools=%s%s",
            self._spec.describe(),
            [t.name for t in self.tools],
            f" (skipped by whitelist: {skipped})" if skipped else "",
        )

    async def _list_remote_tools(self) -> list[Any]:
        async with _open_session(self._spec) as session:
            response = await session.list_tools()
            return list(response.tools)
