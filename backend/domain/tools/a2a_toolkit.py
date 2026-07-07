"""A2A (Agent2Agent) toolkit — call another agent as a skill.

A skill with ``tool_name = "a2a"`` turns a remote A2A-compatible agent into a
regular toolkit: at bind time the toolkit fetches the remote *Agent Card*
(``/.well-known/agent-card.json``), discovers the agent's identity and skills,
and exposes a single LangChain tool the local agents can call to delegate work
to the remote agent over the A2A JSON-RPC protocol.

The remote agent advertises *skills* (capability descriptions), but A2A is a
message-passing protocol — you don't invoke a skill by name, you send the agent
a natural-language ``message`` and it routes internally. So this toolkit exposes
one ``call_agent`` tool whose description embeds the remote agent's name,
description and skill catalogue, giving the calling LLM everything it needs to
decide *when* and *what* to delegate.

Protocol (A2A over HTTP, JSON-RPC 2.0):

- Discovery — GET ``<base>/.well-known/agent-card.json`` (legacy fallback
  ``/.well-known/agent.json``; if ``url`` already points at a card JSON, use it).
  The card yields ``name``, ``description``, ``skills`` and the JSON-RPC ``url``.
- Send — POST ``message/send`` with a ``{role:"user", parts:[{kind:"text"}]}``
  message. The result is either a ``Message`` (immediate reply) or a ``Task``.
- Poll — for a ``Task`` that is not yet terminal, poll ``tasks/get`` until it
  reaches ``completed``/``failed``/``canceled``/``rejected``/``input-required``.

Design notes mirror ``mcp_toolkit.py``:

- Discovery happens once, synchronously, at skill bind time, run on a dedicated
  thread so it works inside or outside a running event loop.
- Each tool call opens a fresh, short-lived HTTP client. No long-lived sessions.
- Config values arrive as strings from the skill UI; ``headers`` accepts both
  JSON and KEY=VALUE / KEY: VALUE line formats (shared parsers from the MCP kit).
- LLM-supplied URLs are guarded against SSRF via ``validate_public_url``.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

import httpx
from langchain.messages import ToolMessage
from langchain.tools import BaseTool

from backend.api.settings import settings
from backend.domain.tools._ssrf import make_ssrf_safe_async_transport, validate_public_url
from backend.domain.tools.base import BaseToolkit
from backend.domain.tools.mcp_toolkit import (
    _parse_timeout,
    _run_coro_blocking,
    parse_key_values,
)
from backend.log import get_logger

logger = get_logger(__name__)

# Wall-clock ceiling for the initial agent-card fetch at bind time.
A2A_DISCOVERY_TIMEOUT_SECONDS = max(5, settings.mcp.discovery_timeout_seconds)
# Default per-call timeout (overridable per skill via `timeout_seconds`).
A2A_CALL_TIMEOUT_SECONDS = max(5, settings.mcp.call_timeout_seconds)

# Well-known agent-card locations, tried in order. The first is the current
# A2A spec path; the second is the pre-1.0 legacy path.
_WELL_KNOWN_PATHS = ("/.well-known/agent-card.json", "/.well-known/agent.json")

# Task states that mean the remote agent is done with this turn.
_TERMINAL_STATES = {"completed", "failed", "canceled", "cancelled", "rejected", "input-required"}


# ------------------------------------------------------------------ #
# Connection spec                                                      #
# ------------------------------------------------------------------ #

class A2AAgentSpec:
    """Validated connection parameters for one remote A2A agent."""

    def __init__(
        self,
        *,
        url: str = "",
        headers: Any = None,
    ):
        self.url = (url or "").strip().rstrip("/")
        if not self.url:
            raise ValueError("A2A skill requires the remote agent 'url'.")
        if not self.url.lower().startswith(("http://", "https://")):
            raise ValueError(f"A2A 'url' must be http(s): got {self.url!r}")
        self.headers = parse_key_values(headers)
        # Resolved from the agent card at discovery time; defaults to base url.
        self.rpc_url = self.url

    def describe(self) -> str:
        return f"a2a:{self.rpc_url}"

    def candidate_card_urls(self) -> list[str]:
        """URLs to try when fetching the agent card."""
        lowered = self.url.lower()
        # User pointed straight at a card document.
        if lowered.endswith(".json"):
            return [self.url]
        return [self.url + path for path in _WELL_KNOWN_PATHS]


def _request_headers(spec: A2AAgentSpec) -> dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    headers.update(spec.headers)
    return headers


# ------------------------------------------------------------------ #
# Agent card + response rendering                                      #
# ------------------------------------------------------------------ #

def _describe_skills(card: dict) -> str:
    """Render the remote agent's skill catalogue as a bullet list for the LLM."""
    skills = card.get("skills") or []
    lines: list[str] = []
    for skill in skills:
        if not isinstance(skill, dict):
            continue
        name = skill.get("name") or skill.get("id") or "skill"
        desc = (skill.get("description") or "").strip()
        tags = skill.get("tags") or []
        tag_str = f" (tags: {', '.join(str(t) for t in tags)})" if tags else ""
        lines.append(f"- {name}: {desc}{tag_str}" if desc else f"- {name}{tag_str}")
    return "\n".join(lines)


def _extract_text_from_parts(parts: Any) -> list[str]:
    out: list[str] = []
    for part in parts or []:
        if not isinstance(part, dict):
            continue
        # A2A uses {"kind": "text", "text": ...}; some servers use {"type": ...}.
        kind = part.get("kind") or part.get("type")
        text = part.get("text")
        if kind == "text" and isinstance(text, str) and text:
            out.append(text)
        elif isinstance(text, str) and text:
            out.append(text)
        else:
            data = part.get("data") or part.get("file")
            if data is not None:
                out.append(json.dumps(data, ensure_ascii=False, default=str))
    return out


def _render_result(result: Any) -> str:
    """Flatten an A2A ``Message`` or ``Task`` result into plain text."""
    if not isinstance(result, dict):
        return str(result) if result is not None else "(empty result)"

    parts: list[str] = []

    # Direct Message reply.
    if result.get("kind") == "message" or "parts" in result and "status" not in result:
        parts.extend(_extract_text_from_parts(result.get("parts")))

    # Task: prefer artifacts, then the status message, then last history turn.
    artifacts = result.get("artifacts") or []
    for artifact in artifacts:
        if isinstance(artifact, dict):
            parts.extend(_extract_text_from_parts(artifact.get("parts")))

    status = result.get("status") or {}
    if isinstance(status, dict):
        status_msg = status.get("message")
        if isinstance(status_msg, dict):
            parts.extend(_extract_text_from_parts(status_msg.get("parts")))

    if not parts:
        history = result.get("history") or []
        if history and isinstance(history[-1], dict):
            parts.extend(_extract_text_from_parts(history[-1].get("parts")))

    text = "\n".join(p for p in parts if p).strip()
    state = status.get("state") if isinstance(status, dict) else None
    if state in ("failed", "rejected", "canceled", "cancelled"):
        return f"[a2a task {state}] {text or '(no detail)'}"
    if state == "input-required":
        return f"[a2a needs more input] {text or '(the remote agent asked for clarification)'}"
    return text or "(empty result)"


# ------------------------------------------------------------------ #
# Remote agent tool wrapper                                            #
# ------------------------------------------------------------------ #

class A2AAgentTool(BaseTool):
    """LangChain adapter that delegates a message to one remote A2A agent."""

    name: str = ""
    description: str = ""
    args_schema: dict | None = None

    def __init__(
        self,
        *,
        spec: A2AAgentSpec,
        exposed_name: str,
        agent_name: str,
        description: str,
        timeout_seconds: int,
        poll_interval_seconds: float = 1.5,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.name = exposed_name
        self.description = description
        self.args_schema = {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": (
                        f"The task or question to send to the '{agent_name}' agent, "
                        "in natural language. Include all context the remote agent needs."
                    ),
                }
            },
            "required": ["message"],
        }
        self._spec = spec
        self._agent_name = agent_name
        self._timeout_seconds = timeout_seconds
        self._poll_interval = poll_interval_seconds

    def _run(self, **kwargs: Any) -> Any:  # pragma: no cover - async-only path
        raise NotImplementedError("A2A tools are async-only; use ainvoke().")

    async def _rpc(self, client: httpx.AsyncClient, method: str, params: dict) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": uuid.uuid4().hex,
            "method": method,
            "params": params,
        }
        resp = await client.post(self._spec.rpc_url, json=payload, headers=_request_headers(self._spec))
        resp.raise_for_status()
        body = resp.json()
        if isinstance(body, dict) and body.get("error"):
            err = body["error"]
            raise RuntimeError(f"{err.get('code')}: {err.get('message')}")
        return body.get("result", {}) if isinstance(body, dict) else {}

    async def _send(self, message_text: str) -> str:
        validate_public_url(self._spec.rpc_url)
        deadline = self._timeout_seconds
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(deadline), transport=make_ssrf_safe_async_transport()
        ) as client:
            params = {
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": message_text}],
                    "messageId": uuid.uuid4().hex,
                }
            }
            result = await self._rpc(client, "message/send", params)

            # A direct Message reply needs no polling.
            if result.get("kind") == "message" or "status" not in result:
                return _render_result(result)

            # Task: poll until terminal.
            task_id = result.get("id")
            state = (result.get("status") or {}).get("state")
            polls = 0
            max_polls = max(1, int(self._timeout_seconds / max(0.5, self._poll_interval)))
            while task_id and state not in _TERMINAL_STATES and polls < max_polls:
                await asyncio.sleep(self._poll_interval)
                result = await self._rpc(client, "tasks/get", {"id": task_id})
                state = (result.get("status") or {}).get("state")
                polls += 1
            return _render_result(result)

    async def ainvoke(self, input: Any, config: Any = None, **kwargs: Any) -> ToolMessage:
        args = input.get("args", {}) if isinstance(input, dict) else {}
        tool_call_id = input.get("id", "") if isinstance(input, dict) else ""
        message_text = (args or {}).get("message", "") if isinstance(args, dict) else ""
        try:
            async with asyncio.timeout(self._timeout_seconds + 5):
                content = await self._send(str(message_text))
        except asyncio.CancelledError:
            raise
        except TimeoutError:
            content = (
                f"[a2a timeout] agent '{self._agent_name}' ({self._spec.describe()}) "
                f"did not answer within {self._timeout_seconds}s."
            )
        except httpx.HTTPStatusError as exc:
            content = f"[a2a error] '{self._agent_name}' returned HTTP {exc.response.status_code}."
        except Exception as exc:  # noqa: BLE001 - remote agents fail heterogeneously
            logger.exception("A2A call to '%s' failed (%s)", self._agent_name, self._spec.describe())
            content = f"[a2a error] call to '{self._agent_name}' failed: {exc}"
        return ToolMessage(tool_call_id=tool_call_id, name=self.name, content=content)


# ------------------------------------------------------------------ #
# Toolkit                                                              #
# ------------------------------------------------------------------ #

class A2AToolkit(BaseToolkit):
    """Toolkit exposing one remote A2A agent as a callable skill, per skill config."""

    name: str = "a2a"

    def __init__(
        self,
        *,
        url: str = "",
        headers: Any = None,
        timeout_seconds: Any = None,
        poll_interval_seconds: Any = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self._spec = A2AAgentSpec(url=url, headers=headers)
        self._timeout_seconds = _parse_timeout(timeout_seconds, A2A_CALL_TIMEOUT_SECONDS)
        try:
            self._poll_interval = max(0.5, float(str(poll_interval_seconds).strip()))
        except Exception:  # noqa: BLE001 - any malformed value falls back
            self._poll_interval = 1.5

        suffix = ""
        override = kwargs.get("tool_name_override")
        if override:
            suffix = "_" + self._sanitize_tool_name(str(override))

        try:
            card = _run_coro_blocking(self._fetch_agent_card(), A2A_DISCOVERY_TIMEOUT_SECONDS)
        except Exception as exc:  # noqa: BLE001 - fail fast with a clear message
            raise ValueError(
                f"Could not fetch A2A agent card ({self._spec.url}): {exc}"
            ) from exc

        agent_name = (card.get("name") or "remote agent").strip()
        agent_desc = (card.get("description") or "").strip()
        skills_block = _describe_skills(card)

        description = f"Delegate a task to the remote A2A agent '{agent_name}'."
        if agent_desc:
            description += f" {agent_desc}"
        if skills_block:
            description += f"\n\nThis agent can:\n{skills_block}"
        description += (
            "\n\nSend a clear, self-contained 'message' describing the task; "
            "the response is the remote agent's reply."
        )

        exposed = self._sanitize_tool_name(f"call_agent_{agent_name}") + suffix
        self.tools.append(
            A2AAgentTool(
                spec=self._spec,
                exposed_name=exposed,
                agent_name=agent_name,
                description=description,
                timeout_seconds=self._timeout_seconds,
                poll_interval_seconds=self._poll_interval,
            )
        )
        logger.info(
            "A2A toolkit bound: agent=%r endpoint=%s skills=%d",
            agent_name,
            self._spec.rpc_url,
            len(card.get("skills") or []),
        )

    async def _fetch_agent_card(self) -> dict:
        validate_public_url(self._spec.url)
        last_error: Exception | None = None
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(A2A_DISCOVERY_TIMEOUT_SECONDS),
            follow_redirects=True,
            transport=make_ssrf_safe_async_transport(),
        ) as client:
            for card_url in self._spec.candidate_card_urls():
                try:
                    resp = await client.get(card_url, headers=_request_headers(self._spec))
                    resp.raise_for_status()
                    card = resp.json()
                    if not isinstance(card, dict):
                        raise ValueError("agent card is not a JSON object")
                    # The card's `url` is the JSON-RPC endpoint; fall back to base.
                    rpc_url = (card.get("url") or "").strip()
                    if rpc_url:
                        validate_public_url(rpc_url)
                        self._spec.rpc_url = rpc_url.rstrip("/")
                    return card
                except Exception as exc:  # noqa: BLE001 - try the next candidate
                    last_error = exc
                    continue
        raise last_error or ValueError("no agent card found")
