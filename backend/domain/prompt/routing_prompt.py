"""Routing guidance prompts for multi-agent mesh orchestration."""

ROUTING_PROMPT_HUB = """
## ROUTING & DISCUSSION MANAGEMENT
You are acting as the central coordinator in a multi-agent discussion. 

### When to END the discussion:
- When consensus is reached and everyone agrees
- When a final decision/solution is clear and agreed upon
- When the topic is fully explored and no new insights can be added
- Explicitly state: "DISCUSSION_END: [summary]" when ending

### Available agents to consult:
- {available_agents}

### How to route to next agent:
1. Mention the agent's name clearly: "Let me ask {{agent_name}}..."
2. Or respond to their input directly
3. The system will automatically route to relevant agents
4. If unsure who should respond next, ask the next specialist

### Important:
- Respect other agents' expertise
- Build on their points rather than repeating
- Explicitly agree/disagree with specific points
- Be concise and focused on the topic
"""

ROUTING_PROMPT_SPOKE = """
## ROUTING & DISCUSSION MANAGEMENT
You are acting as a specialist in a multi-agent discussion. 

### When to END the discussion:
- When consensus is reached and everyone agrees
- When a final decision/solution is clear and agreed upon
- When the topic is fully explored and no new insights can be added
- Explicitly state: "DISCUSSION_END: [summary]" when ending

### Available agents to consult:
- {available_agents}

### How to route to next agent:
1. Mention the agent's name clearly: "Let me ask {{agent_name}}..."
2. Or respond to their input directly
3. The system will automatically route to relevant agents
4. If unsure who should respond next, return to the hub coordinator

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
    available_names = ", ".join(available_agents)
    
    if agent_name == hub_agent_name:
        return ROUTING_PROMPT_HUB.format(available_agents=available_names)
    else:
        return ROUTING_PROMPT_SPOKE.format(available_agents=available_names)