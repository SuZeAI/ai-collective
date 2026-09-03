"""Per-staff accumulating LLM message history, scoped to one graph run.

Complements ``_graph_runtime.py``'s ``TurnMessages`` (which builds the fresh
per-turn context+input pair sent every call) by giving each staff member a
real, growing transcript of what it has actually seen and said across the
whole run — ``[system, user, assistant, user, assistant, ...]`` — instead of
having to reconstruct its own history from windowed text logs each turn.

Scoped to a single in-memory run: no topology passes a checkpointer to
``.compile()``, so nothing here is persisted across task resumes.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Literal

# Turn-count window (not token-aware), mirroring the existing per-topology
# precedent (_RING_HISTORY_WINDOW=8, _TREE_LOG_WINDOW=8, _DELEGATION_LOG_WINDOW=6)
# instead of extending token_budget.py to be message-list-aware.
_STAFF_HISTORY_WINDOW = 8

StaffStatus = Literal["idle", "active", "done"]


@dataclass(frozen=True, slots=True)
class StaffState:
    """One staff member's accumulating LLM transcript + process-tracking
    fields, scoped to a single graph run."""

    name: str
    role: str
    status: StaffStatus = "idle"
    current_task: str = ""
    messages: tuple[dict[str, str], ...] = field(default_factory=tuple)
    # tuple + frozen dataclass: in-place mutation is a hard TypeError,
    # enforcing this repo's "never mutate LangGraph state in place" rule
    # at the type level.

    def llm_messages(self, *, window: int = _STAFF_HISTORY_WINDOW) -> list[dict[str, str]]:
        """LLM-call-safe subset: system entry stripped (system_prompt already
        goes through chat(system=...) separately — duplicating it as a
        "system"-role message here would reintroduce the create_agent bug of
        a duplicate system message), windowed to the last `window` exchanges.
        """
        non_system = [m for m in self.messages if m.get("role") != "system"]
        return non_system[-(window * 2):] if window > 0 else non_system

    def with_status(self, status: StaffStatus) -> "StaffState":
        return replace(self, status=status)

    def with_task(self, task: str) -> "StaffState":
        return replace(self, current_task=task)


def new_staff_state(*, name: str, role: str, system_prompt: str) -> StaffState:
    """Fresh StaffState seeded with its one-time system entry. Call once per
    staff at container-init time, not per turn."""
    return StaffState(name=name, role=role, messages=({"role": "system", "content": system_prompt},))


StaffStates = dict[str, StaffState]


def init_staff_states(staff: list) -> StaffStates:
    """Build the initial {name: StaffState} map. ``staff`` is
    list[GraphStaffDefinition]. Call once per run's initial-state
    constructor(s)."""
    return {a.name: new_staff_state(name=a.name, role=a.role, system_prompt=a.system_prompt) for a in staff}


def append_user_turn(states: StaffStates, name: str, content: str) -> StaffStates:
    """Copy-on-write: return a NEW dict with `name`'s history plus one new
    user-role message."""
    current = states.get(name)
    if current is None:
        return states  # defensive no-op; callers should init_staff_states first
    updated = replace(current, messages=current.messages + ({"role": "user", "content": content},))
    return {**states, name: updated}


def append_assistant_turn(states: StaffStates, name: str, content: str) -> StaffStates:
    """Copy-on-write: append one assistant-role message (the LLM's reply)."""
    current = states.get(name)
    if current is None:
        return states
    updated = replace(current, messages=current.messages + ({"role": "assistant", "content": content},))
    return {**states, name: updated}


def llm_ready_messages(states: StaffStates, name: str, *, window: int = _STAFF_HISTORY_WINDOW) -> list[dict[str, str]]:
    """Convenience: `name`'s windowed, system-stripped, LLM-call-safe message
    list, or [] if absent."""
    st = states.get(name)
    return st.llm_messages(window=window) if st is not None else []


def merge_staff_states(old: StaffStates, new: StaffStates) -> StaffStates:
    """LangGraph reducer for topologies with genuine concurrent-branch
    execution (langgraph_custom.py). Shallow-merges two partial updates keyed
    by staff name; `new` wins per-key on collision."""
    return {**old, **new}
