"""End-to-end coverage for the topologies that had no tests at all:
orchestrator (sequential), ring, tree, and custom. Mirrors the stub-LLM
pattern already used in test_fanout.py for mesh/supervisor.

These exist as a safety net before deduping shared boilerplate out of the
6 langgraph_*.py files into _graph_runtime.py — run before and after any
such refactor to confirm behavior is unchanged.
"""

from __future__ import annotations

import asyncio

from server.app.ports.staff_graph import CustomGraphSpec, GraphStaffDefinition
from server.domain.staff.langgraph_custom import LangGraphCustomOrchestrator
from server.domain.staff.langgraph_orchestrator import LangGraphStaffOrchestrator
from server.domain.staff.langgraph_ring import LangGraphRingOrchestrator
from server.domain.staff.langgraph_tree import LangGraphTreeOrchestrator


class _EchoLLM:
    """Always returns a fixed string; used where the topology doesn't parse
    control markers out of the output (orchestrator, ring, custom-fallback)."""

    def __init__(self, response: str = "ok"):
        self.response = response
        self.calls: list[str] = []

    async def chat(self, *, system, user=None, messages=None, tools=None,
                   parallel_tools=False, max_tool_rounds=None, **kwargs):
        self.calls.append(system)
        return self.response

    def get_chat_model(self):
        return None

    async def generate_json(self, *, system, user):
        return {}


def _agent(name: str, system_prompt: str = "sys") -> GraphStaffDefinition:
    return GraphStaffDefinition(name=name, role=f"role-{name}", system_prompt=system_prompt)


# --------------------------------------------------------------------------- #
# Sequential orchestrator                                                      #
# --------------------------------------------------------------------------- #

def test_orchestrator_e2e_runs_each_staff_once_in_order():
    agents = [_agent("A"), _agent("B")]
    llm = _EchoLLM("done")
    res = asyncio.run(LangGraphStaffOrchestrator().run(
        user_input="hi", staff=agents, llm=llm, max_rounds=2, conversation_id=None,
    ))
    names = [t.staff_name for t in res.turns]
    nums = [t.turn for t in res.turns]
    assert names == ["A", "B"]
    assert nums == [1, 2]
    assert res.final_staff == "B"
    assert res.final_response == "done"
    assert res.rounds == 2


def test_orchestrator_e2e_caps_at_max_rounds():
    agents = [_agent("A"), _agent("B"), _agent("C")]
    llm = _EchoLLM("done")
    res = asyncio.run(LangGraphStaffOrchestrator().run(
        user_input="hi", staff=agents, llm=llm, max_rounds=2, conversation_id=None,
    ))
    assert [t.staff_name for t in res.turns] == ["A", "B"]


# --------------------------------------------------------------------------- #
# Ring                                                                          #
# --------------------------------------------------------------------------- #

def test_ring_e2e_round_robin_order():
    agents = [_agent("A"), _agent("B")]
    llm = _EchoLLM("done")
    res = asyncio.run(LangGraphRingOrchestrator().run(
        user_input="hi", staff=agents, llm=llm, max_rounds=3, conversation_id=None,
    ))
    names = [t.staff_name for t in res.turns]
    nums = [t.turn for t in res.turns]
    assert names == ["A", "B", "A"]
    assert nums == [1, 2, 3]
    assert res.rounds == 3


# --------------------------------------------------------------------------- #
# Tree                                                                          #
# --------------------------------------------------------------------------- #

class _TreeLLM:
    """Root delegates down to the leaf on its first turn, then ends on its
    second turn (once the leaf has reported back)."""

    def __init__(self):
        self.root_calls = 0

    async def chat(self, *, system, user=None, messages=None, tools=None,
                   parallel_tools=False, max_tool_rounds=None, **kwargs):
        if system == "root-sys":
            self.root_calls += 1
            if self.root_calls == 1:
                return "Delegating.\n<DELEGATE_DOWN>Leaf</DELEGATE_DOWN><TASK>investigate</TASK>"
            return "Wrapping up.\n<TREE_END>final answer</TREE_END>"
        return "leaf did the work"

    def get_chat_model(self):
        return None

    async def generate_json(self, *, system, user):
        return {}


def test_tree_e2e_root_delegates_leaf_reports_root_ends():
    agents = [_agent("Root", "root-sys"), _agent("Leaf", "leaf-sys")]
    llm = _TreeLLM()
    res = asyncio.run(LangGraphTreeOrchestrator().run(
        user_input="hi", staff=agents, llm=llm, max_rounds=5, conversation_id=None,
    ))
    names = [t.staff_name for t in res.turns]
    assert names == ["Root", "Leaf", "Root"]
    assert res.final_staff == "Root"
    assert "final answer" in res.final_response


def test_tree_e2e_root_only_ends_when_rounds_exhausted_without_tree_end():
    """Regression: a root that never emits TREE_END or a delegation still
    terminates once max_rounds is hit (run_to_final_state bounds it)."""
    agents = [_agent("Root", "root-sys"), _agent("Leaf", "leaf-sys")]

    class _SilentRootLLM:
        async def chat(self, *, system, **kwargs):
            return "just thinking, no markers"

        def get_chat_model(self):
            return None

        async def generate_json(self, *, system, user):
            return {}

    res = asyncio.run(LangGraphTreeOrchestrator().run(
        user_input="hi", staff=agents, llm=_SilentRootLLM(), max_rounds=2, conversation_id=None,
    ))
    assert len(res.turns) <= 2
    assert res.turns[0].staff_name == "Root"


# --------------------------------------------------------------------------- #
# Custom (user-defined DAG)                                                    #
# --------------------------------------------------------------------------- #

def test_custom_e2e_falls_back_to_sequential_chain_without_edges():
    agents = [_agent("A"), _agent("B")]
    llm = _EchoLLM("done")
    res = asyncio.run(LangGraphCustomOrchestrator().run(
        user_input="hi", staff=agents, llm=llm, max_rounds=2, conversation_id=None,
        custom_graph=None,
    ))
    assert [t.staff_name for t in res.turns] == ["A", "B"]


def test_custom_e2e_honors_explicit_edges():
    agents = [_agent("A"), _agent("B"), _agent("C")]
    llm = _EchoLLM("done")
    # Wire A -> C directly, skipping B entirely.
    spec = CustomGraphSpec(edges=(("A", "C"),), entry=("A",))
    res = asyncio.run(LangGraphCustomOrchestrator().run(
        user_input="hi", staff=agents, llm=llm, max_rounds=3, conversation_id=None,
        custom_graph=spec,
    ))
    names = [t.staff_name for t in res.turns]
    assert names == ["A", "C"]
    assert "B" not in names
