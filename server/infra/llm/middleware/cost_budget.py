"""Cost-budget middleware — soft-stop a run that exceeds a token budget."""

from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import SystemMessage

from server.api.settings import settings
from server.infra.llm.middleware.helpers import (
    estimate_tokens,
    message_text,
    state_messages,
)
from server.share.log import get_logger


class CostBudgetMiddleware(AgentMiddleware):
    """Soft-stop a run that exceeds a token budget.

    Estimates cumulative history tokens before each model call; once past
    ``budget`` it injects a firm ``SystemMessage`` instructing the staff to stop
    calling tools and produce its final answer now. A soft cap (the run stays
    alive and yields a result) layered on top of the hard ``ModelCallLimit``.
    """

    def __init__(self, *, budget: int | None = None) -> None:
        super().__init__()
        self._budget = budget if budget is not None else settings.llm.run_token_budget

    def before_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        if self._budget <= 0:
            return None
        messages = state_messages(state)
        total = sum(estimate_tokens(message_text(m)) for m in messages)
        if total < self._budget:
            return None
        # Avoid re-nudging every turn once we've already asked to finalize.
        for m in messages[-3:]:
            if isinstance(m, SystemMessage) and "TOKEN BUDGET REACHED" in message_text(m):
                return None
        get_logger().warning("CostBudget: run hit ~%d tokens (budget %d)", total, self._budget)
        return {
            "messages": [
                SystemMessage(
                    content=(
                        "[TOKEN BUDGET REACHED] Stop calling tools and write your final "
                        "answer now using what you already have."
                    )
                )
            ]
        }
