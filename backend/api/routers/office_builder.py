from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage

from backend.api.deps import (
    get_agent_service,
    get_conversation_service,
    get_llm_service,
    get_office_builder_session_service,
    get_skill_service,
    get_team_service,
    get_workspace_service,
)
from backend.api.routers.agents import _build_agent_system_prompt
from backend.api.routers.teams import _activate_team_agents, _seed_team_kickoff_messages
from backend.api.schemas.office_builder import (
    ApplyOfficePlanRequest,
    ApplyOfficePlanResponse,
    OfficeBuilderChatRequest,
    OfficeBuilderChatResponse,
    OfficeBuilderSessionSchema,
    OfficeBuilderSessionSummarySchema,
    OfficePlan,
    UpsertOfficeBuilderSessionRequest,
)
from backend.api.schemas.workspace import WorkspaceSchema
from backend.application.service.agent_service import AgentService
from backend.application.service.conversation_service import ConversationService
from backend.application.service.llm_service import LLMService
from backend.application.service.office_builder_session_service import OfficeBuilderSessionService
from backend.application.service.skill_service import SkillService
from backend.application.service.team_service import TeamService
from backend.application.service.workspace_service import WorkspaceService
from backend.domain.enums import AgentStatus
from backend.domain.models import Agent, OfficeBuilderSession, Skill, Team, Workspace
from backend.log import get_logger


router = APIRouter(prefix="/office-builder", tags=["office-builder"])

TEAM_MODES = ("sequential", "mesh", "ring", "supervisor", "tree")


# ─── Plan generation (chat) ─────────────────────────────────────────────────

_PLAN_SCHEMA_TEXT = (
    "{\n"
    '  "name": "<office name>",\n'
    '  "description": "<office description>",\n'
    '  "departments": [\n'
    "    {\n"
    '      "name": "<department name>",\n'
    '      "description": "<department description>",\n'
    '      "mode": "sequential|mesh|ring|supervisor|tree",\n'
    '      "humans": [\n'
    "        {\n"
    '          "name": "<human-like name>",\n'
    '          "role": "<job title>",\n'
    '          "description": "<mission / responsibilities>",\n'
    '          "skills": [\n'
    '            {"name": "<skill name>", "description": "<what it does>", "tool_name": "<tool_name or null>"}\n'
    "          ]\n"
    "        }\n"
    "      ]\n"
    "    }\n"
    "  ]\n"
    "}"
)

_DESIGNER_RULES_TEXT = (
    "Rules:\n"
    "- Design a sensible org: typically 2-5 departments with 2-4 humans each and 1-3 skills "
    "per human, unless the user specifies otherwise.\n"
    "- tool_name MUST be one of the available tools above, or null.\n"
    "- Prefer free tools (websearch, http, hackernews, youtube) over ones requiring API keys, "
    "unless the user asks for a specific integration.\n"
    "- When the user requests changes, return the FULL updated plan (never a partial diff).\n"
    "- If a current draft plan is provided, treat it as the starting point and modify it.\n"
    "- Keep the conversational reply concise; the plan itself is rendered separately in the UI."
)


def _designer_prompt_intro(tool_presets: list[dict]) -> str:
    tool_lines = "\n".join(
        f"- \"{p['tool_name']}\": {p['label']}" for p in tool_presets
    )
    return (
        "You are an expert AI organization designer for the AI Collective platform. "
        "The user wants to build a full OFFICE through conversation. An office contains "
        "multiple DEPARTMENTS (teams); each department contains HUMANS (AI agents); each "
        "human has SKILLS, and each skill may be linked to one TOOL.\n\n"
        "Available tools (use the exact tool_name, or null for a knowledge-only skill):\n"
        f"{tool_lines}\n\n"
        "Department execution modes: \"sequential\" (pipeline, default), \"mesh\" (open "
        "collaboration), \"ring\" (round-robin), \"supervisor\" (one lead delegates), "
        "\"tree\" (hierarchical).\n\n"
    )


def _build_designer_system_prompt(tool_presets: list[dict]) -> str:
    return (
        _designer_prompt_intro(tool_presets)
        + "ALWAYS respond with a single JSON object and nothing else:\n"
        "{\n"
        '  "reply": "<short conversational reply in the user\'s language, summarizing what you designed or asking targeted questions>",\n'
        '  "plan": <full office plan object, or null if you still need more information>\n'
        "}\n\n"
        "Plan JSON schema:\n"
        f"{_PLAN_SCHEMA_TEXT}\n\n"
        f"{_DESIGNER_RULES_TEXT}"
    )


def _build_streaming_designer_system_prompt(tool_presets: list[dict]) -> str:
    return (
        _designer_prompt_intro(tool_presets)
        + "Respond in this EXACT format:\n"
        "1. First, write a short conversational reply as plain text in the user's language "
        "(summarize what you designed, or ask targeted questions). Do NOT use code fences in this part.\n"
        "2. Then, if (and only if) you have a complete office plan, append it as a fenced block:\n"
        "```json\n"
        "<full office plan object>\n"
        "```\n\n"
        "Plan JSON schema:\n"
        f"{_PLAN_SCHEMA_TEXT}\n\n"
        f"{_DESIGNER_RULES_TEXT}"
    )


def _serialize_conversation(req: OfficeBuilderChatRequest, *, streaming: bool = False) -> str:
    parts: list[str] = []
    if req.plan is not None:
        parts.append(
            "Current draft plan:\n" + json.dumps(req.plan.model_dump(), ensure_ascii=False)
        )
    parts.append("Conversation so far:")
    for msg in req.messages:
        speaker = "User" if msg.role == "user" else "Assistant"
        parts.append(f"{speaker}: {msg.content}")
    if streaming:
        parts.append("Respond now in the specified format (reply text, then optional ```json plan block).")
    else:
        parts.append(
            "Respond now with the JSON object ({\"reply\": ..., \"plan\": ...}) only."
        )
    return "\n\n".join(parts)


def _sanitize_plan(raw: dict, available_tools: set[str]) -> OfficePlan:
    plan = OfficePlan.model_validate(raw)
    for dept in plan.departments:
        if dept.mode not in TEAM_MODES:
            dept.mode = "sequential"
        for human in dept.humans:
            for skill in human.skills:
                if skill.tool_name and skill.tool_name not in available_tools:
                    get_logger().warning(
                        "Office builder: dropping unknown tool '%s' from skill '%s'",
                        skill.tool_name,
                        skill.name,
                    )
                    skill.tool_name = None
    return plan


@router.post("/plan", response_model=OfficeBuilderChatResponse)
async def chat_office_plan(
    req: OfficeBuilderChatRequest,
    llm_service: LLMService | None = Depends(get_llm_service),
    skill_service: SkillService = Depends(get_skill_service),
) -> OfficeBuilderChatResponse:
    if llm_service is None:
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")

    presets = skill_service.list_tool_presets()
    system = _build_designer_system_prompt(presets)
    user = _serialize_conversation(req)

    try:
        data = await llm_service.get_provider().generate_json(system=system, user=user)
    except Exception as exc:  # malformed JSON or provider failure
        get_logger().exception("Office builder plan generation failed")
        raise HTTPException(status_code=502, detail=f"Plan generation failed: {exc}")

    reply = str(data.get("reply") or "").strip() or "Here is the updated office plan."
    raw_plan = data.get("plan")
    plan: OfficePlan | None = None
    if isinstance(raw_plan, dict):
        try:
            available = set(skill_service.list_available_tool_names())
            plan = _sanitize_plan(raw_plan, available)
        except Exception:
            get_logger().exception("Office builder: generated plan failed validation")
            plan = req.plan  # keep the previous draft instead of losing it

    return OfficeBuilderChatResponse(reply=reply, plan=plan or req.plan)


def _chunk_text(chunk) -> str:
    """Extract plain text from a LangChain streamed message chunk."""
    content = getattr(chunk, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)(?:```|\Z)", re.DOTALL)


def _split_reply_and_plan(
    full: str, available_tools: set[str]
) -> tuple[str, OfficePlan | None]:
    """Split streamed output into the visible reply and a sanitized plan (if any)."""
    fence = full.find("```")
    reply = (full[:fence] if fence != -1 else full).strip()
    plan: OfficePlan | None = None
    match = _FENCE_RE.search(full)
    if match:
        raw = match.group(1).strip()
        try:
            plan = _sanitize_plan(json.loads(raw), available_tools)
        except Exception:
            get_logger().exception("Office builder: streamed plan failed to parse/validate")
    if not reply:
        reply = "Here is the updated office plan." if plan else "Could you tell me more about the office you want?"
    return reply, plan


@router.post("/plan-stream")
async def chat_office_plan_stream(
    req: OfficeBuilderChatRequest,
    llm_service: LLMService | None = Depends(get_llm_service),
    skill_service: SkillService = Depends(get_skill_service),
) -> StreamingResponse:
    """Streaming variant of /plan.

    SSE events:
      {"type": "delta", "text": ...}   incremental reply text (plan block withheld)
      {"type": "plan", "plan": {...}}  sanitized plan, once fully parsed
      {"type": "done", "reply": ...}   final canonical reply text
      {"type": "error", "detail": ...}
    """
    if llm_service is None:
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")

    presets = skill_service.list_tool_presets()
    available = set(skill_service.list_available_tool_names())
    system = _build_streaming_designer_system_prompt(presets)
    user = _serialize_conversation(req, streaming=True)
    model = llm_service.get_chat_model()

    def _event(payload: dict) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    async def event_generator():
        full = ""
        sent = 0
        try:
            async for chunk in model.astream(
                [SystemMessage(content=system), HumanMessage(content=user)]
            ):
                text = _chunk_text(chunk)
                if not text:
                    continue
                full += text
                fence = full.find("```")
                # Hold back the last few chars so a "```" fence split across
                # chunks never leaks into the visible reply.
                visible_end = fence if fence != -1 else len(full) - 3
                visible_end = max(sent, visible_end)
                if visible_end > sent:
                    yield _event({"type": "delta", "text": full[sent:visible_end]})
                    sent = visible_end

            fence = full.find("```")
            visible_end = max(sent, fence if fence != -1 else len(full))
            if visible_end > sent:
                yield _event({"type": "delta", "text": full[sent:visible_end]})

            reply, plan = _split_reply_and_plan(full, available)
            if plan is not None:
                yield _event({"type": "plan", "plan": plan.model_dump()})
            yield _event({"type": "done", "reply": reply})
        except Exception as exc:
            get_logger().exception("Office builder streaming plan generation failed")
            yield _event({"type": "error", "detail": str(exc)})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─── Plan application (create skills → humans → departments → office) ───────

def _preset_default_config(tool_name: str | None, presets_by_tool: dict[str, dict]) -> dict:
    if not tool_name:
        return {}
    preset = presets_by_tool.get(tool_name) or {}
    config: dict = {}
    for field in preset.get("config_fields") or []:
        key = field.get("key")
        if key is not None and field.get("default") is not None:
            config[key] = field["default"]
    return config


@router.post("/apply", response_model=ApplyOfficePlanResponse)
def apply_office_plan(
    req: ApplyOfficePlanRequest,
    skill_service: SkillService = Depends(get_skill_service),
    agent_service: AgentService = Depends(get_agent_service),
    team_service: TeamService = Depends(get_team_service),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
    conv_service: ConversationService = Depends(get_conversation_service),
) -> ApplyOfficePlanResponse:
    plan = req.plan
    if not plan.name.strip():
        raise HTTPException(status_code=422, detail="Office name must not be empty")
    if not plan.departments:
        raise HTTPException(status_code=422, detail="Office must contain at least one department")

    available_tools = set(skill_service.list_available_tool_names())
    presets_by_tool = {p["tool_name"]: p for p in skill_service.list_tool_presets()}

    # Reuse existing skills when name + tool match (case-insensitive), so repeated
    # office generations don't pile up duplicate skills.
    existing_by_key = {
        (s.name.strip().lower(), s.tool_name or ""): s for s in skill_service.list_skills()
    }
    created_skill_ids: list[str] = []
    reused_skill_ids: list[str] = []
    plan_skill_ids: dict[tuple[str, str], str] = {}

    def _resolve_skill(name: str, description: str, tool_name: str | None) -> str:
        tool = tool_name if tool_name in available_tools else None
        key = (name.strip().lower(), tool or "")
        if key in plan_skill_ids:
            return plan_skill_ids[key]
        existing = existing_by_key.get(key)
        if existing is not None:
            plan_skill_ids[key] = existing.id
            reused_skill_ids.append(existing.id)
            return existing.id
        preset = presets_by_tool.get(tool or "") or {}
        saved = skill_service.upsert_skill(
            Skill(
                id=f"skill_{uuid4().hex}",
                name=name.strip(),
                description=description.strip(),
                third_party=preset.get("third_party") or "",
                kind="integration",
                config=_preset_default_config(tool, presets_by_tool),
                avatar=(name.strip()[:1] or "S").upper(),
                tool_name=tool,
            )
        )
        plan_skill_ids[key] = saved.id
        created_skill_ids.append(saved.id)
        return saved.id

    agent_ids: list[str] = []
    team_ids: list[str] = []

    for dept in plan.departments:
        dept_agent_ids: list[str] = []
        for human in dept.humans:
            skill_ids = [
                _resolve_skill(s.name, s.description, s.tool_name)
                for s in human.skills
                if s.name.strip()
            ]
            description = human.description.strip() or f"{human.role} agent"
            saved_agent = agent_service.upsert_agent(
                Agent(
                    id=f"agent_{uuid4().hex}",
                    name=human.name.strip() or human.role,
                    role=human.role.strip() or "Specialist",
                    description=description,
                    skill_ids=skill_ids,
                    status=AgentStatus.active,
                    avatar=(human.name.strip()[:1] or "A").upper(),
                    system_prompt=_build_agent_system_prompt(
                        name=human.name, role=human.role, description=description
                    ),
                )
            )
            dept_agent_ids.append(saved_agent.id)
            agent_ids.append(saved_agent.id)

        mode = dept.mode if dept.mode in TEAM_MODES else "sequential"
        saved_team = team_service.upsert_team(
            Team(
                id=f"t_{uuid4().hex}",
                name=dept.name.strip() or "Department",
                description=dept.description.strip() or f"{dept.name} department",
                agents=dept_agent_ids,
                active_tasks=1 if dept_agent_ids else 0,
                avatar=(dept.name.strip()[:1] or "T").upper(),
                mode=mode,
            )
        )
        team_ids.append(saved_team.id)
        # Mirror the manual team-creation flow (activation + kickoff messages).
        _activate_team_agents(saved_team.agents, agent_service)
        _seed_team_kickoff_messages(saved_team, agent_service, conv_service)

    workspace = workspace_service.upsert_workspace(
        Workspace(
            id=f"ws_{uuid4().hex}",
            name=plan.name.strip(),
            description=plan.description.strip(),
            team_ids=team_ids,
            primary_team_id=team_ids[0] if team_ids else "",
            platform_hooks=[],
            created_at=datetime.now(timezone.utc),
            avatar=(plan.name.strip()[:1] or "W").upper(),
        )
    )

    return ApplyOfficePlanResponse(
        workspace=WorkspaceSchema.from_domain(workspace),
        team_ids=team_ids,
        agent_ids=agent_ids,
        skill_ids=created_skill_ids,
        reused_skill_ids=reused_skill_ids,
    )


# ─── Sessions (persisted chat history) ───────────────────────────────────────

def _derive_session_title(req: UpsertOfficeBuilderSessionRequest) -> str:
    title = req.title.strip()
    if title:
        return title[:80]
    first_user = next((m.content for m in req.messages if m.role == "user"), "")
    first_user = " ".join(first_user.split())
    if first_user:
        return first_user[:80]
    return "New office chat"


@router.get("/sessions", response_model=list[OfficeBuilderSessionSummarySchema])
def list_sessions(
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
) -> list[OfficeBuilderSessionSummarySchema]:
    return [OfficeBuilderSessionSummarySchema.from_domain(s) for s in service.list_sessions()]


@router.get("/sessions/{session_id}", response_model=OfficeBuilderSessionSchema)
def get_session(
    session_id: str,
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
) -> OfficeBuilderSessionSchema:
    session = service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return OfficeBuilderSessionSchema.from_domain(session)


@router.post("/sessions", response_model=OfficeBuilderSessionSchema)
def upsert_session(
    req: UpsertOfficeBuilderSessionRequest,
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
) -> OfficeBuilderSessionSchema:
    now = datetime.now(timezone.utc)
    existing = service.get_session(req.id) if req.id else None
    session = OfficeBuilderSession(
        id=req.id or f"obs_{uuid4().hex}",
        title=_derive_session_title(req),
        messages=[m.model_dump() for m in req.messages],
        plan=req.plan.model_dump() if req.plan else None,
        created_at=existing.created_at if existing else now,
        updated_at=now,
        workspace_id=req.workspaceId or (existing.workspace_id if existing else ""),
    )
    saved = service.upsert_session(session)
    return OfficeBuilderSessionSchema.from_domain(saved)


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
) -> dict:
    service.delete_session(session_id)
    return {"deleted": True}
