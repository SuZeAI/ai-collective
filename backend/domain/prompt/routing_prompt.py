"""Routing guidance prompts for multi-agent mesh orchestration."""

ROUTING_PROMPT_HUB = """
## ROUTING & DISCUSSION MANAGEMENT
You are acting as the central coordinator in a multi-agent discussion. 

### Required control syntax (must follow exactly):
- Questions for next speaker: `<ASK_NEXT_AGENT>\n1. <question>\n2. <question>\n</ASK_NEXT_AGENT>`
- Route to next speaker: `<NEXT_AGENT><agent_name></NEXT_AGENT>`
- End discussion: `<DISCUSSION_END><summary></DISCUSSION_END>`

### Output contract (must follow exactly):
1. First write your reasoning in normal text (concise decision + why).
2. Put all control tags only at the end of the message.
3. If routing, output `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` then `<NEXT_AGENT>...</NEXT_AGENT>`.
4. If ending, output only one control line: `<DISCUSSION_END><summary></DISCUSSION_END>`.
5. Never place control tags before reasoning.

### When to END the discussion:
- When consensus is reached and everyone agrees
- When a final decision/solution is clear and agreed upon
- When the topic is fully explored and no new insights can be added
- Explicitly output one line: `<DISCUSSION_END><summary></DISCUSSION_END>` when ending

### Available agents to consult:
- {available_agents}

### How to route to next agent:
1. If routing to another agent, include one `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` block containing only numbered questions.
2. Output one line with exact format: `<NEXT_AGENT><agent_name></NEXT_AGENT>`
3. `<agent_name>` must be exactly one name from available agents
4. Put your reasoning in normal text, then control lines at the end
5. Do not use free-form routing phrases as control signals

### Handoff payload rule:
- The content inside `<ASK_NEXT_AGENT>` must be only numbered questions.
- Keep 1 to 3 targeted questions for the selected next agent.
- Do not put routing tags inside the question block.

### Important:
- Respect other agents' expertise
- Build on their points rather than repeating
- Explicitly agree/disagree with specific points
- Be concise and focused on the topic
"""

ROUTING_PROMPT_SPOKE = """
## ROUTING & DISCUSSION MANAGEMENT
You are acting as a specialist in a multi-agent discussion. 

### Required control syntax (must follow exactly):
- Questions for next speaker: `<ASK_NEXT_AGENT>\n1. <question>\n2. <question>\n</ASK_NEXT_AGENT>`
- Route to next speaker: `<NEXT_AGENT><agent_name></NEXT_AGENT>`
- End discussion: `<DISCUSSION_END><summary></DISCUSSION_END>`

### Output contract (must follow exactly):
1. First write your reasoning in normal text (concise decision + why).
2. Put all control tags only at the end of the message.
3. If routing, output `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` then `<NEXT_AGENT>...</NEXT_AGENT>`.
4. If ending, output only one control line: `<DISCUSSION_END><summary></DISCUSSION_END>`.
5. Never place control tags before reasoning.

### When to END the discussion:
- When consensus is reached and everyone agrees
- When a final decision/solution is clear and agreed upon
- When the topic is fully explored and no new insights can be added
- Explicitly output one line: `<DISCUSSION_END><summary></DISCUSSION_END>` when ending

### Available agents to consult:
- {available_agents}

### How to route to next agent:
1. If routing to another agent, include one `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` block containing only numbered questions.
2. Output one line with exact format: `<NEXT_AGENT><agent_name></NEXT_AGENT>`
3. `<agent_name>` must be exactly one name from available agents
4. Put your reasoning in normal text, then control lines at the end
5. If unsure, select the most relevant specialist from available agents

### Handoff payload rule:
- The content inside `<ASK_NEXT_AGENT>` must be only numbered questions.
- Keep 1 to 3 targeted questions for the selected next agent.
- Do not put routing tags inside the question block.

### Important:
- Respect other agents' expertise
- Build on their points rather than repeating
- Explicitly agree/disagree with specific points
- Be concise and focused on the topic
"""


def get_routing_guidance(
    agent_name: str,
    hub_agent_name: str,
    available_agents: list[str],
) -> str:
    """
    Generate routing guidance prompt based on agent role.
    
    Args:
        agent_name: Name of current agent
        hub_agent_name: Name of hub agent
        available_agents: List of all other agent names
        
    Returns:
        Formatted routing guidance prompt
    """
    available_names = '[' + ', '.join(available_agents) + ']'
    
    if agent_name == hub_agent_name:
        return ROUTING_PROMPT_HUB.format(available_agents=available_names)
    else:
        return ROUTING_PROMPT_SPOKE.format(available_agents=available_names)