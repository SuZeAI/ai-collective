from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import TypedDict
from uuid import uuid4

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider
from backend.domain.event.schema import EventType
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.domain.agent.token_budget import apply_context_token_budget


MAX_CONTEXT_TOKENS = max(1024, int(os.getenv("AGENT_CONTEXT_TOKEN_LIMIT", "12000")))
RESERVED_OUTPUT_TOKENS = max(256, int(os.getenv("AGENT_OUTPUT_TOKEN_RESERVE", "2000")))

_TREE_LOG_WINDOW = 8

# ------------------------------------------------------------------ #
# Tree structure helpers                                               #
# ------------------------------------------------------------------ #

@dataclass(frozen=True)
class TreeNode:
    index: int
    agent: GraphAgentDefinition
    parent_index: int | None        # None only for root
    children_indices: tuple[int, ...]
    is_root: bool
    is_leaf: bool


def _build_tree(agents: list[GraphAgentDefinition]) -> list[TreeNode]:
    """Build a binary tree from a flat agent list (index 0 = root)."""
    n = len(agents)
    nodes: list[TreeNode] = []
    for i, agent in enumerate(agents):
        left = 2 * i + 1
        right = 2 * i + 2
        children = tuple(j for j in (left, right) if j < n)
        parent = None if i == 0 else (i - 1) // 2
        nodes.append(TreeNode(
            index=i,
            agent=agent,
            parent_index=parent,
            children_indices=children,
            is_root=(i == 0),
            is_leaf=(len(children) == 0),
        ))
    return nodes


# ------------------------------------------------------------------ #
# Routing prompts                                                      #
# ------------------------------------------------------------------ #

_ROOT_PROMPT = """
## TREE TOPOLOGY — ROOT NODE
You are the **root agent**. You start the task, delegate sub-tasks down the tree, and synthesize results when they return.

### Your direct children:
{child_profiles}

### Control syntax (place ONLY at the very end of your response):
- Delegate to a child:
  ```
  <DELEGATE_DOWN>ExactChildName</DELEGATE_DOWN>
  <TASK>Self-contained task for the child</TASK>
  ```
- Return final answer (ends the entire tree):
  ```
  <TREE_END>Complete answer to the user</TREE_END>
  ```

### Rules:
1. Write your reasoning first, then ONE control block at the end.
2. When a child reports back (visible in "Latest report"), synthesize and decide next step.
3. Delegate across different branches to gather comprehensive results.
4. Use `<TREE_END>` when you have enough information or rounds are low.

### Round budget: {rounds_used}/{max_rounds} used — {remaining} remaining.
"""

_INTERMEDIATE_PROMPT = """
## TREE TOPOLOGY — INTERMEDIATE NODE
You receive a sub-task from above. You can work on it yourself, delegate further down to your children, or return your result to root.

### Your parent: {parent_name}
### Your children:
{child_profiles}

### Control syntax (at end of response):
- Delegate further down:
  ```
  <DELEGATE_DOWN>ExactChildName</DELEGATE_DOWN>
  <TASK>Focused sub-task for the child</TASK>
  ```
- Return your result to root:
  ```
  <RETURN_TO_ROOT>Your result or synthesis</RETURN_TO_ROOT>
  ```
- End the entire tree (use only when fully resolved):
  ```
  <TREE_END>Final answer</TREE_END>
  ```

### Rules:
1. Write your response first, then one control block at the end.
2. If you delegate, the child's result will NOT come back to you — it goes directly to root.
3. If you have enough information, use `<RETURN_TO_ROOT>` to hand off to root.

### Round budget: {rounds_used}/{max_rounds} used — {remaining} remaining.
"""

_LEAF_PROMPT = """
## TREE TOPOLOGY — LEAF NODE
You are a leaf agent — you complete your assigned task and your result goes automatically back to root.

### Your parent: {parent_name}

### Rules:
1. Complete your assigned task thoroughly.
2. Your response is automatically returned to root — no special tag needed.
3. To end the entire tree immediately, you may use:
   ```
   <TREE_END>Final answer</TREE_END>
   ```
   (Otherwise, just respond normally — root will continue the flow.)
"""


# ------------------------------------------------------------------ #
# LangGraph state                                                      #
# ------------------------------------------------------------------ #

class TreeState(TypedDict):
    input: str               # Latest input: user message or agent result
    original_input: str      # Original user request (immutable)
    turns: list[GraphTurn]
    tree_log: list[str]      # Chronological delegation / report log
    current_task: str        # Task text passed to a child
    current_worker: str | None   # Name of child to route to next (set by delegating node)
    final_answer_reached: bool
    rounds: int
    final_response: str
    final_agent: str | None


# ------------------------------------------------------------------ #
# Orchestrator                                                         #
# ------------------------------------------------------------------ #

class LangGraphTreeOrchestrator(AgentGraphOrchestrator):
    """
    Tree topology orchestrator.

    Agents are arranged as a binary tree from the flat input list:
        - agents[0]          → root
        - agents[2i+1/2i+2]  → children of agents[i]
        - nodes with no children → leaves

    Flow:
        START → root
        root ─► DELEGATE_DOWN(child) ─► child ─► [DELEGATE_DOWN or RETURN_TO_ROOT → root]
        leaf ─► root (always, unless TREE_END)
        Any node ─► TREE_END ─► END
        root exhausts rounds ─► END
    """

    _DELEGATE_DOWN_RE = re.compile(
        r"<\s*DELEGATE_DOWN\s*>(.*?)<\s*/\s*DELEGATE_DOWN\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _TASK_RE = re.compile(
        r"<\s*TASK\s*>(.*?)<\s*/\s*TASK\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _RETURN_TO_ROOT_RE = re.compile(
        r"<\s*RETURN_TO_ROOT\s*>(.*?)<\s*/\s*RETURN_TO_ROOT\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _TREE_END_RE = re.compile(
        r"<\s*TREE_END\s*>(.*?)<\s*/\s*TREE_END\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _CONTROL_BLOCK_RE = re.compile(
        r"<\s*(DELEGATE_DOWN|TASK|RETURN_TO_ROOT|TREE_END)\s*>.*?<\s*/\s*\1\s*>",
        re.IGNORECASE | re.DOTALL,
    )

    # ------------------------------------------------------------------ #
    # Public interface                                                     #
    # ------------------------------------------------------------------ #

    async def run(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ) -> GraphRunResult:
        if not agents:
            raise ValueError("At least one agent definition is required")

        self._ingest_user_message(user_input, conversation_id, graph_context_provider, graph_config)
        tree = _build_tree(agents)
        graph = self._build_graph(tree, llm, max_rounds, conversation_id, graph_context_provider, graph_config)
        final_state = await graph.ainvoke(self._initial_state(user_input))

        turns = list(final_state.get("turns", []))
        return GraphRunResult(
            turns=turns,
            final_response=final_state.get("final_response") or (turns[-1].content if turns else ""),
            final_agent=final_state.get("final_agent"),
            rounds=int(final_state.get("rounds", len(turns))),
        )

    async def run_stream(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ):
        if not agents:
            raise ValueError("At least one agent definition is required")

        self._ingest_user_message(user_input, conversation_id, graph_context_provider, graph_config)
        tree = _build_tree(agents)
        graph = self._build_graph(tree, llm, max_rounds, conversation_id, graph_context_provider, graph_config)

        async for event in graph.astream(self._initial_state(user_input), stream_mode="custom"):
            if isinstance(event, dict):
                yield event

    # ------------------------------------------------------------------ #
    # Graph construction                                                   #
    # ------------------------------------------------------------------ #

    def _build_graph(
        self,
        tree: list[TreeNode],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        root = tree[0]
        root_name = root.agent.name
        builder: StateGraph = StateGraph(TreeState)

        # Add all nodes
        for node in tree:
            builder.add_node(
                node.agent.name,
                self._make_node(
                    tree_node=node,
                    tree=tree,
                    llm=llm,
                    max_rounds=max_rounds,
                    root_name=root_name,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )

        # Add edges
        for node in tree:
            children_names = {tree[ci].agent.name for ci in node.children_indices}
            agent_name = node.agent.name

            # Build routing map for this node
            routing_map: dict[str, str] = {"end": END}
            for cname in children_names:
                routing_map[cname] = cname
            if not node.is_root:
                routing_map[root_name] = root_name

            def _make_router(
                _children: set[str],
                _is_root: bool,
                _root_name: str,
                _max_rounds: int,
            ):
                def router(state: TreeState) -> str:
                    if state.get("final_answer_reached"):
                        return "end"
                    # Root only ends when rounds exhausted
                    if _is_root and state["rounds"] >= _max_rounds:
                        return "end"
                    target = state.get("current_worker")
                    if target and target in _children:
                        return target
                    # Non-root with no child delegation → return to root
                    if not _is_root:
                        return _root_name
                    # Root with nothing to delegate → end
                    return "end"
                return router

            builder.add_conditional_edges(
                agent_name,
                _make_router(children_names, node.is_root, root_name, max_rounds),
                routing_map,
            )

        builder.add_edge(START, root_name)
        return builder.compile()

    @staticmethod
    def _initial_state(user_input: str) -> TreeState:
        return {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "tree_log": [],
            "current_task": "",
            "current_worker": None,
            "final_answer_reached": False,
            "rounds": 0,
            "final_response": "",
            "final_agent": None,
        }

    # ------------------------------------------------------------------ #
    # Node factory                                                         #
    # ------------------------------------------------------------------ #

    def _make_node(
        self,
        *,
        tree_node: TreeNode,
        tree: list[TreeNode],
        llm: LLMProvider,
        max_rounds: int,
        root_name: str,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        agent = tree_node.agent
        parent = tree[tree_node.parent_index].agent if tree_node.parent_index is not None else None
        children = [tree[ci].agent for ci in tree_node.children_indices]

        # Build routing guidance for this node's position
        child_profiles = "\n".join(
            f"- {c.name}: {c.role}" + (f" — {c.description}" if c.description else "")
            for c in children
        ) or "(none)"
        parent_name = parent.name if parent else "(none)"

        if tree_node.is_root:
            node_type = "root"
        elif tree_node.is_leaf:
            node_type = "leaf"
        else:
            node_type = "intermediate"

        async def tree_node_fn(state: TreeState) -> dict:
            stream_writer = get_stream_writer()
            rounds_used = state["rounds"]
            remaining = max(0, max_rounds - rounds_used)

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": agent.name,
                "agent_role": agent.role,
                "turn": rounds_used + 1,
                "tree_node_type": node_type,
                "tree_index": tree_node.index,
            })
            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": agent.name})

            # Knowledge graph context
            graph_ctx = ""
            query = state.get("current_task") or state["original_input"]
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=query,
                    config=graph_config,
                )
                graph_ctx = pack.text
                if graph_ctx:
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": agent.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            # Build routing guidance
            if node_type == "root":
                routing_guidance = _ROOT_PROMPT.format(
                    child_profiles=child_profiles,
                    rounds_used=rounds_used,
                    max_rounds=max_rounds,
                    remaining=remaining,
                )
            elif node_type == "intermediate":
                routing_guidance = _INTERMEDIATE_PROMPT.format(
                    parent_name=parent_name,
                    child_profiles=child_profiles,
                    rounds_used=rounds_used,
                    max_rounds=max_rounds,
                    remaining=remaining,
                )
            else:  # leaf
                routing_guidance = _LEAF_PROMPT.format(parent_name=parent_name)

            full_system = f"{agent.system_prompt}\n\n{routing_guidance}"

            # Build user context
            recent_log = state.get("tree_log", [])[-_TREE_LOG_WINDOW:]
            log_text = "\n".join(recent_log) if recent_log else "(none)"

            context_parts: list[str] = [
                f"[Original request]: {state['original_input']}",
            ]

            # Show task if this node received a delegation
            current_task = state.get("current_task", "")
            if current_task and not tree_node.is_root:
                context_parts += ["", f"[Your assigned task]:\n{current_task}"]
            elif tree_node.is_root and state.get("input") and state["input"] != state["original_input"]:
                context_parts += ["", f"[Latest report from tree]:\n{state['input']}"]

            if recent_log:
                context_parts += ["", f"[Tree activity log]:\n{log_text}"]
            if graph_ctx:
                context_parts += ["", f"[Context]:\n{graph_ctx}"]

            user_input_text = "\n".join(context_parts)

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=full_system,
                user_input=user_input_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input_text = budget_result.text

            bound_tools: list = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": agent.name,
                "context_length": len(user_input_text),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
            })

            raw_output = await llm.chat(
                system=full_system,
                user=user_input_text,
                tools=bound_tools or None,
            )

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": agent.name,
                "response_length": len(raw_output),
            })

            reasoning, action = self._split_reasoning_and_action(raw_output)
            tree_end = self._extract_tree_end(action)
            target_child, task_text = self._extract_delegation(action, children)
            return_result = self._extract_return_to_root(action)

            # Decide what goes into the tree log
            new_log = list(state.get("tree_log", []))
            if tree_end:
                new_log.append(f"[Turn {rounds_used + 1}] {agent.name} → TREE_END")
            elif target_child:
                new_log.append(f"[Turn {rounds_used + 1}] {agent.name} → {target_child}: {task_text[:120]}{'...' if len(task_text) > 120 else ''}")
            elif return_result or tree_node.is_leaf:
                result_preview = (return_result or reasoning)[:200]
                new_log.append(f"[Turn {rounds_used + 1}] {agent.name} → {root_name}: {result_preview}{'...' if len(result_preview) == 200 else ''}")

            new_turn = GraphTurn(
                turn=rounds_used + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=reasoning if reasoning else (tree_end or return_result or raw_output),
            )

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{agent.name}-{uuid4().hex}",
                    speaker=agent.name,
                    content=new_turn.content,
                    config=graph_config,
                )
                stream_writer({"type": EventType.MESSAGE_INGESTED.value, "agent_name": agent.name})

            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": new_turn,
                "delegate_to": target_child,
                "return_to_root": bool(return_result or (tree_node.is_leaf and not tree_end)),
                "tree_end": bool(tree_end),
                "node_type": node_type,
            })

            # Compute next input: what the NEXT active node will read
            if target_child and task_text:
                next_input = task_text  # child receives its task
            elif tree_end:
                next_input = tree_end
            elif return_result:
                next_input = f"[{agent.name} reports]: {return_result}"
            elif tree_node.is_leaf:
                next_input = f"[{agent.name} reports]: {reasoning or raw_output}"
            else:
                next_input = state["input"]

            return {
                **state,
                "input": next_input,
                "turns": [*state["turns"], new_turn],
                "tree_log": new_log,
                "current_task": task_text if target_child else "",
                "current_worker": target_child,
                "final_answer_reached": bool(tree_end),
                "final_response": tree_end or reasoning or raw_output,
                "final_agent": agent.name,
                "rounds": rounds_used + 1,
            }

        return tree_node_fn

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _split_reasoning_and_action(self, message: str) -> tuple[str, str]:
        if not message:
            return "", ""
        actions = [m.group(0).strip() for m in self._CONTROL_BLOCK_RE.finditer(message)]
        action_payload = "\n".join(a for a in actions if a).strip()
        reasoning = self._CONTROL_BLOCK_RE.sub("", message)
        reasoning = re.sub(r"\n{3,}", "\n\n", reasoning).strip()
        return reasoning, action_payload

    def _extract_delegation(
        self,
        action_payload: str,
        valid_children: list[GraphAgentDefinition],
    ) -> tuple[str | None, str]:
        match = self._DELEGATE_DOWN_RE.search(action_payload)
        if not match:
            return None, ""
        raw = match.group(1).strip()
        normalized = {c.name.lower(): c.name for c in valid_children}
        target = normalized.get(raw.lower())
        if not target:
            return None, ""
        task_match = self._TASK_RE.search(action_payload)
        task = task_match.group(1).strip() if task_match else ""
        return target, task

    def _extract_return_to_root(self, action_payload: str) -> str:
        match = self._RETURN_TO_ROOT_RE.search(action_payload)
        return match.group(1).strip() if match else ""

    def _extract_tree_end(self, action_payload: str) -> str:
        match = self._TREE_END_RE.search(action_payload)
        return match.group(1).strip() if match else ""

    @staticmethod
    def _ingest_user_message(
        user_input: str,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ) -> None:
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )
