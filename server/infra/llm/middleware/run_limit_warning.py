"""Run-limit warning middleware — nudge the staff to answer before ModelCallLimit cuts it off."""

from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import SystemMessage

from server.infra.llm.middleware.helpers import message_text, state_messages
from server.share.log import get_logger

_MARKER = "[FINAL ROUND]"


class RunLimitWarningMiddleware(AgentMiddleware):
    """Warn the staff one round before ``ModelCallLimitMiddleware`` ends the run.

    ``ModelCallLimitMiddleware`` hard-stops silently once ``run_model_call_count``
    reaches ``run_limit``, replacing the answer with a synthetic "Model call
    limits exceeded" message — the staff never gets a chance to wrap up. This
    reads the same counter one round earlier (``run_limit - 1``, i.e. the last
    call ``ModelCallLimitMiddleware`` will still let through) and injects a
    firm nudge so the model uses that last round to answer instead of calling
    another tool.
    """

    def __init__(self, *, run_limit: int) -> None:
        super().__init__()
        self._run_limit = run_limit

    def before_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        if self._run_limit <= 1:
            return None
        run_count = state.get("run_model_call_count", 0) if isinstance(state, dict) else 0
        if run_count != self._run_limit - 1:
            return None

        messages = state_messages(state)
        for m in messages[-3:]:
            if isinstance(m, SystemMessage) and _MARKER in message_text(m):
                return None

        get_logger().warning(
            "RunLimitWarning: staff at round %d/%d, nudging for final answer",
            run_count + 1,
            self._run_limit,
        )
        return {
            "messages": [
                SystemMessage(
                    content=(
                        f"{_MARKER} This is your last allowed model call for this run. "
                        "Do not call any more tools — respond now with your best final "
                        "answer using the information you already have."
                    )
                )
            ]
        }
