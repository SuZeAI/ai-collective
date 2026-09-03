"""Routing guidance prompts for multi-staff mesh orchestration."""

ROUTING_PROMPT_HUB = """
## ROUTING & DISCUSSION MANAGEMENT
You are acting as the central coordinator in a multi-staff discussion. 

### Required control syntax (must follow exactly):
- Questions for next speaker: `<ASK_NEXT_AGENT>\n1. <question>\n2. <question>\n</ASK_NEXT_AGENT>`
- Route to next speaker: `<NEXT_AGENT><staff_name></NEXT_AGENT>`
- Dispatch a parallel wave: `<FANOUT>\n<DELEGATE_TO><staff_name></DELEGATE_TO><TASK><independent sub-task></TASK>\n...\n</FANOUT>`
- End discussion: `<DISCUSSION_END><summary></DISCUSSION_END>`

### Output contract (must follow exactly):
1. First write your reasoning in normal text (concise decision + why).
2. Put all control tags only at the end of the message.
3. If routing, output `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` then `<NEXT_AGENT>...</NEXT_AGENT>`.
4. If ending, output only one control line: `<DISCUSSION_END><summary></DISCUSSION_END>`.
5. Never place control tags before reasoning.

### Parallel fan-out (you may dispatch several specialists AT ONCE):
- Use `<FANOUT>` when 2+ available staff can work INDEPENDENTLY on different
  sub-tasks of the same wave (no ordering dependency between them). They run
  concurrently and you receive all results together to synthesize.
- Format — one `<DELEGATE_TO>`/`<TASK>` pair per staff, all inside one `<FANOUT>` block:
  ```
  <FANOUT>
  <DELEGATE_TO>AgentA</DELEGATE_TO><TASK>specific self-contained task for A</TASK>
  <DELEGATE_TO>AgentB</DELEGATE_TO><TASK>specific self-contained task for B</TASK>
  </FANOUT>
  ```
- List 2 to {max_concurrent} distinct staff from the available list; give each a
  self-contained task. Do NOT include yourself.
- For dependent / sequential work, use `<NEXT_AGENT>` instead — not `<FANOUT>`.

### When to END the discussion:
- When consensus is reached and everyone agrees
- When a final decision/solution is clear and agreed upon
- When the topic is fully explored and no new insights can be added
- Explicitly output one line: `<DISCUSSION_END><summary></DISCUSSION_END>` when ending

### Available staff to consult (name + specialization):
{available_staff}

### How to route to next staff:
1. If routing to another staff, include one `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` block containing only numbered questions.
2. Output one line with exact format: `<NEXT_AGENT><staff_name></NEXT_AGENT>`
3. `<staff_name>` must be exactly one name from available staff
4. Put your reasoning in normal text, then control lines at the end
5. Pick the next staff whose specialization best matches the unresolved question.
6. Do not use free-form routing phrases as control signals

### Handoff payload rule:
- The content inside `<ASK_NEXT_AGENT>` must be only numbered questions.
- Keep 1 to 3 targeted questions for the selected next staff.
- Do not put routing tags inside the question block.

### Important:
- Respect other staff' expertise
- Build on their points rather than repeating
- Explicitly agree/disagree with specific points
- Be concise and focused on the topic
"""

ROUTING_PROMPT_SPOKE = """
## ROUTING & DISCUSSION MANAGEMENT
You are acting as a specialist in a multi-staff discussion. 

### Required control syntax (must follow exactly):
- Questions for next speaker: `<ASK_NEXT_AGENT>\n1. <question>\n2. <question>\n</ASK_NEXT_AGENT>`
- Route to next speaker: `<NEXT_AGENT><staff_name></NEXT_AGENT>`
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

### Available staff to consult (name + specialization):
{available_staff}

### How to route to next staff:
1. If routing to another staff, include one `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` block containing only numbered questions.
2. Output one line with exact format: `<NEXT_AGENT><staff_name></NEXT_AGENT>`
3. `<staff_name>` must be exactly one name from available staff
4. Put your reasoning in normal text, then control lines at the end
5. Select the specialist whose role/description best matches what is still missing.
6. If unsure, select the most relevant specialist from available staff

### Handoff payload rule:
- The content inside `<ASK_NEXT_AGENT>` must be only numbered questions.
- Keep 1 to 3 targeted questions for the selected next staff.
- Do not put routing tags inside the question block.

### Important:
- Respect other staff' expertise
- Build on their points rather than repeating
- Explicitly agree/disagree with specific points
- Be concise and focused on the topic
"""


def _format_available_staff(available_staff: list[str] | list[dict[str, str]]) -> str:
    if not available_staff:
        return "- (none)"

    rows: list[str] = []
    for item in available_staff:
        if isinstance(item, dict):
            name = str(item.get("name", "")).strip()
            role = str(item.get("role", "")).strip()
            description = str(item.get("description", "")).strip()
            if not name:
                continue
            specialization = " - ".join([part for part in [role, description] if part])
            rows.append(f"- {name}: {specialization}" if specialization else f"- {name}")
            continue

        name = str(item).strip()
        if name:
            rows.append(f"- {name}")

    return "\n".join(rows) if rows else "- (none)"


def get_routing_guidance(
    staff_name: str,
    hub_staff_name: str,
    available_staff: list[str] | list[dict[str, str]],
    max_concurrent: int = 3,
) -> str:
    """
    Generate routing guidance prompt based on staff role.

    Args:
        staff_name: Name of current staff
        hub_staff_name: Name of hub staff
        available_staff: Other staff as names or profile dicts
            (name/role/description)
        max_concurrent: Max staff the hub may dispatch in one parallel fan-out
            wave (only the hub prompt advertises fan-out).

    Returns:
        Formatted routing guidance prompt
    """
    available_staff_text = _format_available_staff(available_staff)

    if staff_name == hub_staff_name:
        return ROUTING_PROMPT_HUB.format(
            available_staff=available_staff_text,
            max_concurrent=max_concurrent,
        )
    return ROUTING_PROMPT_SPOKE.format(available_staff=available_staff_text)