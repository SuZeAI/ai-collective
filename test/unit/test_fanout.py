"""Tests for topology-level parallel fan-out (mesh + supervisor).

Covers the `<FANOUT>` parser on both orchestrators and the shared
`run_fanout_wave` helper: concurrency, deterministic turn numbering, and
error tolerance (one branch failing must not kill the wave).

No pytest-asyncio in this repo, so async paths are driven via asyncio.run().
"""

from __future__ import annotations

import asyncio
import time

from server.app.ports.staff_graph import GraphStaffDefinition
from server.domain.staff._graph_runtime import (
    MESH_FANOUT_MAX_CONCURRENT,
    run_fanout_wave,
)
from server.domain.staff.langgraph_mesh import MultiAgentMeshOrchestrator
from server.domain.staff.langgraph_supervisor import LangGraphSupervisorOrchestrator
from server.infra.sandbox.sandbox_session import get_current_thread_id


# --------------------------------------------------------------------------- #
# Parser tests                                                                 #
# --------------------------------------------------------------------------- #

def _mesh() -> MultiAgentMeshOrchestrator:
    return MultiAgentMeshOrchestrator()


def _sup() -> LangGraphSupervisorOrchestrator:
    return LangGraphSupervisorOrchestrator()


_TWO = (
    "reasoning here\n<FANOUT>"
    "<DELEGATE_TO>A</DELEGATE_TO><TASK>do x</TASK>"
    "<DELEGATE_TO>B</DELEGATE_TO><TASK>do y</TASK>"
    "</FANOUT>"
)


def test_mesh_parse_two_targets():
    pairs = _mesh()._parse_fanout(_TWO, ["Hub", "A", "B"], "Hub")
    assert pairs == [("A", "do x"), ("B", "do y")]


def test_mesh_parse_single_target_falls_back():
    payload = "<FANOUT><DELEGATE_TO>A</DELEGATE_TO><TASK>x</TASK></FANOUT>"
    assert _mesh()._parse_fanout(payload, ["Hub", "A", "B"], "Hub") == []


def test_mesh_parse_excludes_self_and_dedupes():
    payload = (
        "<FANOUT>"
        "<DELEGATE_TO>Hub</DELEGATE_TO><TASK>x</TASK>"
        "<DELEGATE_TO>A</DELEGATE_TO><TASK>y</TASK>"
        "<DELEGATE_TO>A</DELEGATE_TO><TASK>dup</TASK>"
        "<DELEGATE_TO>B</DELEGATE_TO><TASK>z</TASK>"
        "</FANOUT>"
    )
    assert _mesh()._parse_fanout(payload, ["Hub", "A", "B"], "Hub") == [
        ("A", "y"),
        ("B", "z"),
    ]


def test_mesh_parse_no_block():
    assert _mesh()._parse_fanout("<NEXT_AGENT>A</NEXT_AGENT>", ["Hub", "A"], "Hub") == []


def test_mesh_parse_unknown_names_dropped():
    payload = (
        "<FANOUT>"
        "<DELEGATE_TO>Ghost</DELEGATE_TO><TASK>x</TASK>"
        "<DELEGATE_TO>A</DELEGATE_TO><TASK>y</TASK>"
        "</FANOUT>"
    )
    # Only one valid target remains -> fall back to single routing.
    assert _mesh()._parse_fanout(payload, ["Hub", "A", "B"], "Hub") == []


def test_mesh_fanout_stripped_from_reasoning():
    reasoning, action = _mesh()._split_reasoning_and_action(_TWO)
    assert "FANOUT" not in reasoning
    assert "<FANOUT>" in action


def test_mesh_parse_caps_width():
    names = ["Hub"] + [f"A{i}" for i in range(MESH_FANOUT_MAX_CONCURRENT + 3)]
    block = "".join(
        f"<DELEGATE_TO>A{i}</DELEGATE_TO><TASK>t{i}</TASK>"
        for i in range(MESH_FANOUT_MAX_CONCURRENT + 3)
    )
    pairs = _mesh()._parse_fanout(f"<FANOUT>{block}</FANOUT>", names, "Hub")
    assert len(pairs) == MESH_FANOUT_MAX_CONCURRENT


def test_supervisor_parse_two_workers():
    pairs = _sup()._parse_fanout(_TWO, ["A", "B", "C"], "Lead")
    assert pairs == [("A", "do x"), ("B", "do y")]


def test_supervisor_single_delegation_still_parses():
    _, action = _sup()._split_reasoning_and_action(
        "think <DELEGATE_TO>W1</DELEGATE_TO><TASK>do</TASK>"
    )
    assert _sup()._parse_fanout(action, ["W1", "W2"], "Lead") == []
    assert _sup()._extract_delegation(action) == ("W1", "do")


# --------------------------------------------------------------------------- #
# run_fanout_wave tests                                                        #
# --------------------------------------------------------------------------- #

class _FakeLLM:
    """Async chat that sleeps then echoes the user, to observe concurrency."""

    def __init__(self, delay: float = 0.2, fail_on: str | None = None):
        self.delay = delay
        self.fail_on = fail_on

    async def chat(self, *, system: str, user: str, **kwargs) -> str:
        await asyncio.sleep(self.delay)
        if self.fail_on and self.fail_on in user:
            raise RuntimeError("boom")
        return f"echo: {user}"


def _agent(name: str) -> GraphStaffDefinition:
    return GraphStaffDefinition(name=name, role=f"role-{name}", system_prompt="sys")


def _kwargs_builder(agent_def, task_text):
    return {"system": "sys", "user": f"{agent_def.name}:{task_text}"}


def test_run_fanout_wave_runs_concurrently_and_numbers_in_order():
    branches = [(_agent("A"), "ta"), (_agent("B"), "tb"), (_agent("C"), "tc")]
    sem = asyncio.Semaphore(3)

    async def go():
        return await run_fanout_wave(
            branches=branches,
            llm=_FakeLLM(delay=0.2),
            build_branch_chat_kwargs=_kwargs_builder,
            semaphore=sem,
            base_turn_number=5,
        )

    start = time.monotonic()
    results = asyncio.run(go())
    elapsed = time.monotonic() - start

    # 3 branches x 0.2s each: concurrent ⇒ ~0.2s, sequential would be ~0.6s.
    assert elapsed < 0.5, f"branches did not run concurrently (elapsed={elapsed:.2f}s)"
    assert [r.staff_name for r in results] == ["A", "B", "C"]
    assert [r.turn for r in results] == [6, 7, 8]  # base_turn_number + 1..N
    assert all(not r.error for r in results)
    assert results[0].content == "echo: A:ta"


def test_run_fanout_wave_semaphore_bounds_concurrency():
    branches = [(_agent(f"A{i}"), f"t{i}") for i in range(4)]
    sem = asyncio.Semaphore(2)  # only 2 at a time

    async def go():
        return await run_fanout_wave(
            branches=branches,
            llm=_FakeLLM(delay=0.2),
            build_branch_chat_kwargs=_kwargs_builder,
            semaphore=sem,
            base_turn_number=0,
        )

    start = time.monotonic()
    results = asyncio.run(go())
    elapsed = time.monotonic() - start

    # 4 branches, 2 at a time, 0.2s each ⇒ ~0.4s (2 waves).
    assert 0.3 < elapsed < 0.7, f"semaphore did not bound concurrency (elapsed={elapsed:.2f}s)"
    assert len(results) == 4


def test_run_fanout_wave_one_branch_failure_does_not_kill_wave():
    branches = [(_agent("A"), "ta"), (_agent("B"), "tb")]
    sem = asyncio.Semaphore(2)

    async def go():
        # FakeLLM raises when user contains "tb"; safe_chat converts to "[error]".
        return await run_fanout_wave(
            branches=branches,
            llm=_FakeLLM(delay=0.01, fail_on="tb"),
            build_branch_chat_kwargs=_kwargs_builder,
            semaphore=sem,
            base_turn_number=0,
        )

    results = asyncio.run(go())
    assert len(results) == 2
    by_name = {r.staff_name: r for r in results}
    assert by_name["A"].error is False
    assert by_name["B"].error is True


def test_run_fanout_wave_kwargs_builder_crash_isolated():
    branches = [(_agent("A"), "ta"), (_agent("B"), "tb")]
    sem = asyncio.Semaphore(2)

    def builder(agent_def, task_text):
        if agent_def.name == "B":
            raise ValueError("cannot build")
        return {"system": "sys", "user": task_text}

    async def go():
        return await run_fanout_wave(
            branches=branches,
            llm=_FakeLLM(delay=0.01),
            build_branch_chat_kwargs=builder,
            semaphore=sem,
            base_turn_number=10,
        )

    results = asyncio.run(go())
    by_name = {r.staff_name: r for r in results}
    assert by_name["A"].error is False
    assert by_name["B"].error is True
    assert "branch crashed" in by_name["B"].content
    # numbering stays deterministic and dense regardless of failures
    assert sorted(r.turn for r in results) == [11, 12]


# --------------------------------------------------------------------------- #
# End-to-end orchestrator tests (real LangGraph path, stub LLM)                #
# --------------------------------------------------------------------------- #

class _ScriptedLLM:
    """Routes responses by markers in the system prompt to drive a full run."""

    def __init__(self, *, coordinator_marker: str, coordinator_response: str,
                 synthesis_response: str, branch_response: str):
        self.coordinator_marker = coordinator_marker
        self.coordinator_response = coordinator_response
        self.synthesis_response = synthesis_response
        self.branch_response = branch_response

    async def chat(self, *, system, user=None, messages=None, tools=None,
                   parallel_tools=False, max_tool_rounds=None, **kwargs):
        text = user if user is not None else (messages[-1]["content"] if messages else "")
        # Routing guidance now travels in the context message (messages[0])
        # rather than the fixed `system` string, so match against everything
        # the model would actually see, same as a real LLM would.
        full_prompt = system + "\n" + "\n".join(m["content"] for m in (messages or []))
        if "PARALLEL WAVE SYNTHESIS" in full_prompt:
            return self.synthesis_response
        if self.coordinator_marker in full_prompt:
            return self.coordinator_response
        return f"{self.branch_response}: {text[:30]}"

    def get_chat_model(self):
        return None

    async def generate_json(self, *, system, user):
        return {}


def test_e2e_mesh_fanout_full_graph():
    llm = _ScriptedLLM(
        coordinator_marker="you may dispatch several specialists",
        coordinator_response=(
            "Dispatching a wave.\n<FANOUT>"
            "<DELEGATE_TO>Alice</DELEGATE_TO><TASK>research X</TASK>"
            "<DELEGATE_TO>Bob</DELEGATE_TO><TASK>analyze Y</TASK>"
            "</FANOUT>"
        ),
        synthesis_response="Synthesized both.\n<DISCUSSION_END>done</DISCUSSION_END>",
        branch_response="branch result",
    )
    agents = [
        GraphStaffDefinition(name="Hub", role="coordinator", system_prompt="coordinate"),
        GraphStaffDefinition(name="Alice", role="researcher", system_prompt="research"),
        GraphStaffDefinition(name="Bob", role="analyst", system_prompt="analyze"),
    ]
    res = asyncio.run(MultiAgentMeshOrchestrator().run(
        user_input="Investigate.", staff=agents, llm=llm, max_rounds=6,
        meeting_id=None,
    ))
    names = [t.staff_name for t in res.turns]
    nums = [t.turn for t in res.turns]
    assert names == ["Hub", "Alice", "Bob", "Hub"]
    assert nums == [1, 2, 3, 4]            # dense, gap-free
    assert res.rounds == 1                 # one wave == one round
    assert res.final_staff == "Hub"


def test_e2e_supervisor_fanout_full_graph():
    llm = _ScriptedLLM(
        coordinator_marker="SUPERVISOR ROLE",
        coordinator_response=(
            "Parallelizing.\n<FANOUT>"
            "<DELEGATE_TO>W1</DELEGATE_TO><TASK>task one</TASK>"
            "<DELEGATE_TO>W2</DELEGATE_TO><TASK>task two</TASK>"
            "</FANOUT>"
        ),
        synthesis_response="Merged.\n<FINAL_ANSWER>combined answer</FINAL_ANSWER>",
        branch_response="worker output",
    )
    agents = [
        GraphStaffDefinition(name="Lead", role="lead", system_prompt="lead"),
        GraphStaffDefinition(name="W1", role="worker", system_prompt="w1"),
        GraphStaffDefinition(name="W2", role="worker", system_prompt="w2"),
    ]
    res = asyncio.run(LangGraphSupervisorOrchestrator().run(
        user_input="Do the job.", staff=agents, llm=llm, max_rounds=6,
        meeting_id=None,
    ))
    names = [t.staff_name for t in res.turns]
    nums = [t.turn for t in res.turns]
    assert names == ["Lead", "W1", "W2", "Lead"]
    assert nums == [1, 2, 3, 4]
    assert res.rounds == 1
    assert "combined answer" in res.final_response


def test_supervisor_lead_retries_once_when_reply_has_no_control_tag():
    """Regression: a lead reply using none of the required control tags (a
    small/fast model describing its plan in prose instead of emitting
    <DELEGATE_TO>/<FANOUT>/<FINAL_ANSWER>) used to fall through
    lead_router's "no target, no final answer" branch and silently end the
    whole run after one turn, never actually delegating. The lead must get
    one nudge to reply in the correct format before that happens."""

    class OnceMalformedLLM:
        def __init__(self):
            self.lead_calls = 0

        async def chat(self, *, system, user=None, messages=None, tools=None,
                       parallel_tools=False, max_tool_rounds=None, **kwargs):
            if system == "lead":
                self.lead_calls += 1
                if self.lead_calls == 1:
                    return "My plan: I'll delegate research to W1 first."
                return "<FINAL_ANSWER>done</FINAL_ANSWER>"
            return "worker output"

        def get_chat_model(self):
            return None

        async def generate_json(self, *, system, user):
            return {}

    llm = OnceMalformedLLM()
    agents = [
        GraphStaffDefinition(name="Lead", role="lead", system_prompt="lead"),
        GraphStaffDefinition(name="W1", role="worker", system_prompt="w1"),
    ]
    res = asyncio.run(LangGraphSupervisorOrchestrator().run(
        user_input="Do the job.", staff=agents, llm=llm, max_rounds=6,
        meeting_id=None,
    ))
    assert llm.lead_calls == 2, "lead should have been nudged exactly once"
    assert "done" in res.final_response
    assert [t.staff_name for t in res.turns] == ["Lead"]


def test_supervisor_delegation_matches_worker_name_case_insensitively():
    """Regression: found live against DeepSeek -- the lead correctly emitted
    <DELEGATE_TO>researcher</DELEGATE_TO> (lowercase) targeting the worker
    registered as "Researcher" (capitalized). lead_router's exact-match
    ``target in worker_names`` check treated that as no valid target and
    silently ended the run after the lead's first turn, never actually
    delegating -- even though every other topology (tree, mesh) and
    supervisor's own <FANOUT> path already match worker names
    case-insensitively."""

    class CaseMismatchLLM:
        def __init__(self):
            self.lead_calls = 0

        async def chat(self, *, system, user=None, messages=None, tools=None,
                       parallel_tools=False, max_tool_rounds=None, **kwargs):
            if system == "lead":
                self.lead_calls += 1
                if self.lead_calls == 1:
                    return "Delegating research.\n<DELEGATE_TO>researcher</DELEGATE_TO><TASK>go</TASK>"
                return "<FINAL_ANSWER>done</FINAL_ANSWER>"
            return "research output"

        def get_chat_model(self):
            return None

        async def generate_json(self, *, system, user):
            return {}

    llm = CaseMismatchLLM()
    agents = [
        GraphStaffDefinition(name="Lead", role="lead", system_prompt="lead"),
        GraphStaffDefinition(name="Researcher", role="researcher", system_prompt="r"),
    ]
    res = asyncio.run(LangGraphSupervisorOrchestrator().run(
        user_input="Do the job.", staff=agents, llm=llm, max_rounds=6,
        meeting_id=None,
    ))
    names = [t.staff_name for t in res.turns]
    assert "Researcher" in names, f"lead's lowercase-cased delegation was never actually routed: {names}"


def test_e2e_mesh_sequential_unchanged_when_no_fanout():
    """Regression: without <FANOUT>, mesh routes one agent at a time."""

    class SeqLLM:
        def __init__(self):
            self.n = 0

        async def chat(self, *, system, user=None, messages=None, tools=None,
                       parallel_tools=False, max_tool_rounds=None):
            self.n += 1
            if self.n >= 3:
                return "Wrap up.\n<DISCUSSION_END>summary</DISCUSSION_END>"
            return "Point.\n<ASK_NEXT_AGENT>\n1. continue\n</ASK_NEXT_AGENT>\n<NEXT_AGENT>Bob</NEXT_AGENT>"

        def get_chat_model(self):
            return None

        async def generate_json(self, *, system, user):
            return {}

    agents = [
        GraphStaffDefinition(name="Hub", role="c", system_prompt="coordinate"),
        GraphStaffDefinition(name="Bob", role="a", system_prompt="analyze"),
    ]
    res = asyncio.run(MultiAgentMeshOrchestrator().run(
        user_input="hi", staff=agents, llm=SeqLLM(), max_rounds=6,
        meeting_id=None,
    ))
    nums = [t.turn for t in res.turns]
    assert nums == list(range(1, len(nums) + 1))   # one turn per round
    assert len(res.turns) >= 2


def test_e2e_mesh_second_turn_sees_own_first_turn_reply():
    """staff_states threads a staff member's own prior turns into later LLM
    calls: Hub's second turn should see its own first-turn assistant reply in
    `messages`, not just a summarized text log."""

    class _HistoryAwareLLM:
        def __init__(self):
            self.hub_calls = 0

        async def chat(self, *, system, user=None, messages=None, tools=None,
                       parallel_tools=False, max_tool_rounds=None, **kwargs):
            messages = messages or []
            if system.startswith("coordinate"):
                self.hub_calls += 1
                if self.hub_calls == 1:
                    return (
                        "First hub turn.\n"
                        "<ASK_NEXT_AGENT>\n1. continue\n</ASK_NEXT_AGENT>\n"
                        "<NEXT_AGENT>Bob</NEXT_AGENT>"
                    )
                saw_own_reply = any(
                    m["role"] == "assistant" and "First hub turn" in m["content"]
                    for m in messages
                )
                marker = "saw-my-own-history" if saw_own_reply else "no-history"
                return f"{marker}.\n<DISCUSSION_END>done</DISCUSSION_END>"
            return (
                "Bob turn.\n"
                "<ASK_NEXT_AGENT>\n1. continue\n</ASK_NEXT_AGENT>\n"
                "<NEXT_AGENT>Hub</NEXT_AGENT>"
            )

        def get_chat_model(self):
            return None

        async def generate_json(self, *, system, user):
            return {}

    agents = [
        GraphStaffDefinition(name="Hub", role="c", system_prompt="coordinate"),
        GraphStaffDefinition(name="Bob", role="a", system_prompt="analyze"),
    ]
    res = asyncio.run(MultiAgentMeshOrchestrator().run(
        user_input="hi", staff=agents, llm=_HistoryAwareLLM(), max_rounds=6,
        meeting_id=None,
    ))
    hub_turns = [t.content for t in res.turns if t.staff_name == "Hub"]
    assert len(hub_turns) == 2
    assert "saw-my-own-history" in hub_turns[-1]


# --------------------------------------------------------------------------- #
# Sandbox thread-id isolation across concurrent fan-out branches               #
#                                                                               #
# Regression: _build_branch_chat_kwargs (mesh) / _build_worker_chat_kwargs     #
# (supervisor) never called init_sandbox_thread, so a staff with the sandbox   #
# skill configured fell back to a shared "default" sandbox_bash session        #
# across concurrent branches. The fix lives in run_fanout_wave's _run_branch,  #
# not the kwargs builders — kwargs are pre-built sequentially before gather()  #
# creates the branch tasks, so a thread_id set there would leak across         #
# branches; it must be set inside each branch's own coroutine.                 #
# --------------------------------------------------------------------------- #

class _ThreadIdCapturingScriptedLLM(_ScriptedLLM):
    """Extends _ScriptedLLM to record get_current_thread_id() during branch calls."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.branch_thread_ids: list[str | None] = []

    async def chat(self, *, system, user=None, messages=None, tools=None,
                   parallel_tools=False, max_tool_rounds=None, **kwargs):
        full_prompt = system + "\n" + "\n".join(m["content"] for m in (messages or []))
        is_branch = (
            "PARALLEL WAVE SYNTHESIS" not in full_prompt
            and self.coordinator_marker not in full_prompt
        )
        if is_branch:
            self.branch_thread_ids.append(get_current_thread_id())
        return await super().chat(
            system=system, user=user, messages=messages, tools=tools,
            parallel_tools=parallel_tools, max_tool_rounds=max_tool_rounds, **kwargs,
        )


def test_e2e_mesh_fanout_branches_get_distinct_sandbox_thread_ids():
    llm = _ThreadIdCapturingScriptedLLM(
        coordinator_marker="you may dispatch several specialists",
        coordinator_response=(
            "Dispatching a wave.\n<FANOUT>"
            "<DELEGATE_TO>Alice</DELEGATE_TO><TASK>research X</TASK>"
            "<DELEGATE_TO>Bob</DELEGATE_TO><TASK>analyze Y</TASK>"
            "</FANOUT>"
        ),
        synthesis_response="Synthesized both.\n<DISCUSSION_END>done</DISCUSSION_END>",
        branch_response="branch result",
    )
    agents = [
        GraphStaffDefinition(name="Hub", role="coordinator", system_prompt="coordinate"),
        GraphStaffDefinition(name="Alice", role="researcher", system_prompt="research"),
        GraphStaffDefinition(name="Bob", role="analyst", system_prompt="analyze"),
    ]
    asyncio.run(MultiAgentMeshOrchestrator().run(
        user_input="Investigate.", staff=agents, llm=llm, max_rounds=6,
        meeting_id="conv-mesh-fanout",
    ))
    assert len(llm.branch_thread_ids) == 2
    assert all(tid is not None for tid in llm.branch_thread_ids)
    assert len(set(llm.branch_thread_ids)) == 2


def test_mesh_sequential_turn_emits_agent_start_not_agent_turn_start():
    """Regression: mesh's own per-turn node emitted "agent_turn_start" (the
    parallel-fanout-branch event type) even for a plain sequential turn, while
    orchestrator/ring/tree/supervisor all emit "agent_start" for the same
    moment. "agent_turn_start" should be reserved for actual fan-out branches
    (which set parallel=True alongside it)."""

    class SeqLLM:
        def __init__(self):
            self.n = 0

        async def chat(self, *, system, user=None, messages=None, tools=None,
                       parallel_tools=False, max_tool_rounds=None):
            self.n += 1
            if self.n >= 2:
                return "Wrap up.\n<DISCUSSION_END>summary</DISCUSSION_END>"
            return "Point.\n<ASK_NEXT_AGENT>\n1. continue\n</ASK_NEXT_AGENT>\n<NEXT_AGENT>Bob</NEXT_AGENT>"

        def get_chat_model(self):
            return None

        async def generate_json(self, *, system, user):
            return {}

    agents = [
        GraphStaffDefinition(name="Hub", role="c", system_prompt="coordinate"),
        GraphStaffDefinition(name="Bob", role="a", system_prompt="analyze"),
    ]

    async def _collect():
        events = []
        async for event in MultiAgentMeshOrchestrator().run_stream(
            user_input="hi", staff=agents, llm=SeqLLM(), max_rounds=6,
            meeting_id=None,
        ):
            events.append(event)
        return events

    events = asyncio.run(_collect())
    event_types = [e.get("type") for e in events]
    assert "agent_start" in event_types
    assert "agent_turn_start" not in event_types


def test_e2e_supervisor_fanout_branches_get_distinct_sandbox_thread_ids():
    llm = _ThreadIdCapturingScriptedLLM(
        coordinator_marker="SUPERVISOR ROLE",
        coordinator_response=(
            "Parallelizing.\n<FANOUT>"
            "<DELEGATE_TO>W1</DELEGATE_TO><TASK>task one</TASK>"
            "<DELEGATE_TO>W2</DELEGATE_TO><TASK>task two</TASK>"
            "</FANOUT>"
        ),
        synthesis_response="Merged.\n<FINAL_ANSWER>combined answer</FINAL_ANSWER>",
        branch_response="worker output",
    )
    agents = [
        GraphStaffDefinition(name="Lead", role="lead", system_prompt="lead"),
        GraphStaffDefinition(name="W1", role="worker", system_prompt="w1"),
        GraphStaffDefinition(name="W2", role="worker", system_prompt="w2"),
    ]
    asyncio.run(LangGraphSupervisorOrchestrator().run(
        user_input="Do the job.", staff=agents, llm=llm, max_rounds=6,
        meeting_id="conv-sup-fanout",
    ))
    assert len(llm.branch_thread_ids) == 2
    assert all(tid is not None for tid in llm.branch_thread_ids)
    assert len(set(llm.branch_thread_ids)) == 2
