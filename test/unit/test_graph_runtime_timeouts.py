"""Regression test for a real race condition found during a manual full-system
pass (2026-09-16): safe_chat()'s outer wall-clock timeout
(LLM_CALL_TIMEOUT_SECONDS) was computed as
``max(LLM_TIMEOUT_SECONDS, ask_user_timeout_seconds)`` -- equal to, not
strictly greater than, ask_user's own internal timeout. When a staff called
`ask_user` and nobody answered, both timeouts expired at (near) the same
instant; the outer `asyncio.timeout` sometimes cancelled the call before
ask_user's own polling loop could return its intended graceful
"[ask_user timeout] ..." message, producing safe_chat's
"[error] The model call timed out after ...s." instead -- which
`raise_if_llm_failed` treats as fatal, killing the entire multi-staff run with
a generic "Internal error while running the staff graph" instead of letting
the staff continue on its own judgement as ask_user.py's docstring promises.

Reproduced live via a real `ring`-mode run against DeepSeek where no client
ever called POST /llm/staff-graph/respond.
"""

from __future__ import annotations

from server.api.settings import settings
from server.domain.staff._graph_runtime import LLM_CALL_TIMEOUT_SECONDS


def test_llm_call_timeout_leaves_headroom_over_ask_user_timeout():
    assert LLM_CALL_TIMEOUT_SECONDS > settings.staff.ask_user_timeout_seconds, (
        "the outer LLM-call timeout must expire strictly after ask_user's own "
        "timeout, or an unanswered ask_user can race the outer timeout and "
        "crash the whole run instead of returning its graceful fallback"
    )
