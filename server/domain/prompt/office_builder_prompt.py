"""System-prompt templates for the AI Office Designer (office_builder) chat flow."""

from __future__ import annotations

import json
from dataclasses import asdict

from server.domain.models import Department, Skill, Staff
from server.domain.office_builder import MAX_EXISTING_LISTED, OfficePlan

PLAN_SCHEMA_TEXT = (
    "{\n"
    '  "name": "<office name>",\n'
    '  "description": "<office description>",\n'
    '  "departments": [\n'
    "    {\n"
    '      "existing_id": "<id of an existing department to reuse, or null to create a new one>",\n'
    '      "name": "<department name>",\n'
    '      "description": "<department description>",\n'
    '      "mode": "sequential|mesh|ring|supervisor|tree",\n'
    '      "staff": [\n'
    "        {\n"
    '          "existing_id": "<id of an existing staff member to reuse, or null to create a new one>",\n'
    '          "name": "<realistic person name>",\n'
    '          "role": "<job title>",\n'
    '          "description": "<mission / responsibilities>",\n'
    '          "skills": [\n'
    '            {"existing_id": "<id of an existing skill to reuse, or null>", "name": "<skill name>", "description": "<what it does>", "tool_name": "<tool_name or null>"}\n'
    "          ]\n"
    "        }\n"
    "      ]\n"
    "    }\n"
    "  ]\n"
    "}"
)

DESIGNER_RULES_TEXT = (
    "Rules:\n"
    "- Design a sensible org: typically 2-5 departments with 2-4 staff each and 1-3 skills "
    "per staff member, unless the user specifies otherwise.\n"
    "- tool_name MUST be one of the available tools above, or null.\n"
    "- Prefer free tools (websearch, http, hackernews, youtube) over ones requiring API keys, "
    "unless the user asks for a specific integration.\n"
    "- Reuse an existing department/staff/skill (listed above, if any) by setting its "
    "\"existing_id\" to the id shown, instead of creating a near-duplicate — but only when it "
    "genuinely fits the need. Set \"existing_id\" to null to create a new one.\n"
    "- When the user requests changes, return the FULL updated plan (never a partial diff).\n"
    "- If a current draft plan is provided, treat it as the starting point and modify it.\n"
    "- Keep the conversational reply concise; the plan itself is rendered separately in the UI."
)


def _existing_context_text(
    existing_departments: list[Department],
    existing_staff: list[Staff],
    existing_skills: list[Skill],
) -> str:
    if not (existing_departments or existing_staff or existing_skills):
        return ""
    text = (
        "The user already has some departments, staff and skills set up. Reuse them "
        "(see the \"existing_id\" rule below) instead of creating near-duplicates:\n\n"
    )
    if existing_departments:
        lines = "\n".join(
            f"- \"{d.id}\": {d.name} ({d.mode}, {len(d.staff)} staff)"
            for d in existing_departments[:MAX_EXISTING_LISTED]
        )
        text += f"Existing departments:\n{lines}\n\n"
    if existing_staff:
        lines = "\n".join(
            f"- \"{s.id}\": {s.name} — {s.role}" for s in existing_staff[:MAX_EXISTING_LISTED]
        )
        text += f"Existing staff:\n{lines}\n\n"
    if existing_skills:
        lines = "\n".join(
            f"- \"{s.id}\": {s.name} (tool: {s.tool_name or 'none'})" for s in existing_skills[:MAX_EXISTING_LISTED]
        )
        text += f"Existing skills:\n{lines}\n\n"
    return text


def _designer_prompt_intro(
    tool_presets: list[dict],
    existing_departments: list[Department],
    existing_staff: list[Staff],
    existing_skills: list[Skill],
) -> str:
    tool_lines = "\n".join(f"- \"{p['tool_name']}\": {p['label']}" for p in tool_presets)
    intro = (
        "You are an expert AI organization designer for the AI Collective platform. "
        "The user wants to build a full OFFICE through conversation. An office contains "
        "multiple DEPARTMENTS (departments); each department contains STAFF (AI staff); each "
        "human has SKILLS, and each skill may be linked to one TOOL.\n\n"
        "Available tools (use the exact tool_name, or null for a knowledge-only skill):\n"
        f"{tool_lines}\n\n"
        "Department execution modes: \"sequential\" (pipeline, default), \"mesh\" (open "
        "collaboration), \"ring\" (round-robin), \"supervisor\" (one lead delegates), "
        "\"tree\" (hierarchical).\n\n"
    )
    intro += _existing_context_text(existing_departments, existing_staff, existing_skills)
    return intro


def build_designer_system_prompt(
    tool_presets: list[dict],
    existing_departments: list[Department],
    existing_staff: list[Staff],
    existing_skills: list[Skill],
) -> str:
    return (
        _designer_prompt_intro(tool_presets, existing_departments, existing_staff, existing_skills)
        + "ALWAYS respond with a single JSON object and nothing else:\n"
        "{\n"
        '  "reply": "<short conversational reply in the user\'s language, summarizing what you designed or asking targeted questions>",\n'
        '  "plan": <full office plan object, or null if you still need more information>\n'
        "}\n\n"
        "Plan JSON schema:\n"
        f"{PLAN_SCHEMA_TEXT}\n\n"
        f"{DESIGNER_RULES_TEXT}"
    )


def build_streaming_designer_system_prompt(
    tool_presets: list[dict],
    existing_departments: list[Department],
    existing_staff: list[Staff],
    existing_skills: list[Skill],
) -> str:
    return (
        _designer_prompt_intro(tool_presets, existing_departments, existing_staff, existing_skills)
        + "Respond in this EXACT format:\n"
        "1. First, write a short conversational reply as plain text in the user's language "
        "(summarize what you designed, or ask targeted questions). Do NOT use code fences in this part.\n"
        "2. Then, if (and only if) you have a complete office plan, append it as a fenced block:\n"
        "```json\n"
        "<full office plan object>\n"
        "```\n\n"
        "Plan JSON schema:\n"
        f"{PLAN_SCHEMA_TEXT}\n\n"
        f"{DESIGNER_RULES_TEXT}"
    )


def serialize_conversation(
    messages: list[tuple[str, str]],
    current_plan: OfficePlan | None,
    *,
    streaming: bool = False,
) -> str:
    parts: list[str] = []
    if current_plan is not None:
        parts.append("Current draft plan:\n" + json.dumps(asdict(current_plan), ensure_ascii=False))
    parts.append("Conversation so far:")
    for role, content in messages:
        speaker = "User" if role == "user" else "Assistant"
        parts.append(f"{speaker}: {content}")
    if streaming:
        parts.append("Respond now in the specified format (reply text, then optional ```json plan block).")
    else:
        parts.append("Respond now with the JSON object ({\"reply\": ..., \"plan\": ...}) only.")
    return "\n\n".join(parts)
