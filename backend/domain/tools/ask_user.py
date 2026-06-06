"""ask_user tool — agent-initiated human-in-the-loop interrupt.

Lets an agent pause mid-turn to ask the user a question (a clarification, a
choice between options, an approval) and block until the user answers — the
same UX as LangGraph's ``interrupt()`` primitive, but built on this project's
custom-stream events instead of checkpointers:

1. The tool emits a ``user_input_request`` event through the LangGraph custom
   stream writer (the SSE stream the frontend already consumes).
2. The frontend renders a question card (options become buttons, plus an
   optional free-text box) and posts the answer to
   ``POST /llm/agent-graph/respond``.
3. The answer lands in a per-run slot in ``task_run_registry``; the tool's
   poll loop picks it up and returns it to the LLM, which continues its turn.

The wait releases on run cancellation/unregistration, and on timeout the tool
returns a graceful "no response" message so the agent can proceed on its own
judgement instead of dying.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any
from uuid import uuid4

from langchain.tools import tool

from backend.domain.event.schema import EventType
from backend.domain.tools.base import BaseToolkit
from backend.log import get_logger

logger = get_logger(__name__)

# How long ask_user waits for an answer before giving up, and how often it
# re-checks the response slot.
ASK_USER_TIMEOUT_SECONDS = max(30, int(os.getenv("AGENT_ASK_USER_TIMEOUT_SECONDS", "600")))
_POLL_SECONDS = 0.25
_HEARTBEAT_EVERY_POLLS = max(1, int(15 / _POLL_SECONDS))  # ~15s, keeps SSE alive


def _emit_event(payload: dict) -> None:
    """Best-effort custom stream event (no-op outside a LangGraph node)."""
    try:
        from langgraph.config import get_stream_writer

        writer = get_stream_writer()
        if writer is not None:
            writer(payload)
    except Exception:
        pass


class AskUserToolkit(BaseToolkit):
    """Toolkit exposing a single ``ask_user`` tool for mid-run user input."""

    name: str = "ask_user"

    def __init__(
        self,
        conversation_id: str,
        agent_name: str | None = None,
        timeout_seconds: int = ASK_USER_TIMEOUT_SECONDS,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self._conversation_id = conversation_id
        self._agent_name = agent_name
        self._timeout_seconds = max(5, int(timeout_seconds))

    @tool(parse_docstring=True)
    async def ask_user(
        self,
        question: str,
        options: list[str] | None = None,
        allow_free_text: bool = True,
    ) -> str:
        """Pause and ask the human user a question, waiting for their answer.

        Use this when you genuinely need the user's input to proceed: choosing
        between approaches, confirming a risky/irreversible action, or getting
        a clarification that the task description does not answer. Do NOT use
        it for questions you can resolve yourself. The run blocks until the
        user answers (or a timeout expires), so ask only when necessary and
        bundle related questions into one call.

        Args:
            question: The complete question to show the user. Be specific and
                give enough context for them to answer without scrolling back.
            options: Optional list of 2-6 short choice labels rendered as
                buttons. Omit for a free-form question.
            allow_free_text: Whether the user may type a custom answer instead
                of (or in addition to) picking an option. Defaults to True.
        """
        from backend.infrastructure import task_run_registry

        question = (question or "").strip()
        if not question:
            return "[ask_user error] question must not be empty."

        clean_options = [str(o).strip() for o in (options or []) if str(o).strip()][:6]

        request_id = uuid4().hex
        if not task_run_registry.open_user_request(self._conversation_id, request_id):
            return (
                "[ask_user unavailable] No active interactive run — proceed on "
                "your best judgement and state the assumption you made."
            )

        payload = {
            "type": EventType.USER_INPUT_REQUEST.value,
            "request_id": request_id,
            "agent_name": self._agent_name,
            "question": question,
            "options": clean_options,
            "allow_free_text": bool(allow_free_text) or not clean_options,
        }
        _emit_event(payload)
        logger.info(
            "ask_user: agent=%s conversation=%s request=%s options=%d",
            self._agent_name, self._conversation_id, request_id, len(clean_options),
        )

        polls = 0
        max_polls = int(self._timeout_seconds / _POLL_SECONDS)
        try:
            while polls < max_polls:
                await asyncio.sleep(_POLL_SECONDS)
                polls += 1

                response = task_run_registry.take_user_response(self._conversation_id, request_id)
                if response is not None:
                    _emit_event({
                        "type": EventType.USER_INPUT_RECEIVED.value,
                        "request_id": request_id,
                        "agent_name": self._agent_name,
                    })
                    return f"The user answered: {response}"

                if task_run_registry.is_cancelled(self._conversation_id):
                    return "[ask_user cancelled] The run was stopped before the user answered."

                # Heartbeat: re-announce the open question so idle SSE
                # connections survive proxy timeouts (UI dedupes by request_id).
                if polls % _HEARTBEAT_EVERY_POLLS == 0:
                    _emit_event({**payload, "heartbeat": True})

            _emit_event({
                "type": EventType.USER_INPUT_RECEIVED.value,
                "request_id": request_id,
                "agent_name": self._agent_name,
                "timed_out": True,
            })
            return (
                f"[ask_user timeout] The user did not answer within "
                f"{self._timeout_seconds}s. Proceed on your best judgement and "
                "state the assumption you made."
            )
        finally:
            task_run_registry.close_user_request(self._conversation_id, request_id)
