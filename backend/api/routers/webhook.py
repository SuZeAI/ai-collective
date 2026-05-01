from __future__ import annotations

import asyncio
import json
import xml.etree.ElementTree as ET
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse

from backend.api.deps import (
    get_agent_graph_service,
    get_agent_service,
    get_skill_tool_manager,
    get_workspace_service,
)
from backend.application.ports.agent_graph import GraphAgentDefinition
from backend.application.service.agent_service import AgentService
from backend.application.service.workspace_service import WorkspaceService
from backend.domain.models import PlatformHook, Workspace
from backend.domain.thirty_part.registry import get_processor
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.log import get_logger

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = get_logger(__name__)


def _build_agent_defs(
    workspace: Workspace,
    agent_service: AgentService,
    tool_manager: SkillToolManager,
) -> list[GraphAgentDefinition]:
    team_id = workspace.primary_team_id or (workspace.team_ids[0] if workspace.team_ids else None)
    if not team_id:
        return []
    try:
        team = agent_service._agent_repo.get  # fallback — use team service via agent service
    except Exception:
        pass

    # Get agents from all workspace teams, prioritising primary team
    agent_ids: list[str] = []
    try:
        from backend.infrastructure.repositories.json_files import JsonTeamRepository
        # We rebuild via agent_service's underlying repos
        team_repo = agent_service._team_repo if hasattr(agent_service, "_team_repo") else None
    except Exception:
        team_repo = None

    # Direct approach: get agent IDs from workspace team_ids
    # AgentService has a get_agent method; teams hold agent lists
    # We'll use agent_service to resolve agents
    try:
        # Try to get team from agent service context (no direct team_service injected here)
        # Fall back: collect all agent IDs from team_ids via agent service
        pass
    except Exception:
        pass

    defs: list[GraphAgentDefinition] = []
    return defs


async def _process_message(
    platform: str,
    hook: PlatformHook,
    workspace: Workspace,
    chat_id: str,
    text: str,
    agent_service: AgentService,
    tool_manager: SkillToolManager,
) -> None:
    """Run agent graph with user message and send response back to platform."""
    processor = get_processor(platform)
    if not processor:
        logger.warning(f"No processor for platform {platform}")
        return

    try:
        from backend.api.deps import get_agent_graph_service, get_team_service
        graph_service = get_agent_graph_service()
        team_service = get_team_service()

        if not graph_service:
            await processor.send_response(hook.config, chat_id, "⚠️ AI service is not configured.")
            return

        # Resolve agents from primary team
        team_id = workspace.primary_team_id or (workspace.team_ids[0] if workspace.team_ids else None)
        if not team_id:
            await processor.send_response(hook.config, chat_id, "⚠️ No team configured for this workspace.")
            return

        team = team_service.get_team(team_id)
        agent_defs: list[GraphAgentDefinition] = []
        for agent_id in team.agents:
            try:
                agent = agent_service.get_agent(agent_id)
                skills = agent_service.get_agent_skills(agent_id)
                tools = []
                for skill in skills:
                    tk = tool_manager.get_tool_for_skill(skill)
                    if tk:
                        tools.extend(tk.get_tools())
                agent_defs.append(
                    GraphAgentDefinition(
                        agent_id=agent.id,
                        name=agent.name,
                        role=agent.role,
                        system_prompt=agent.system_prompt or f"You are {agent.name}, a {agent.role}.",
                        tools=tools,
                    )
                )
            except Exception as e:
                logger.warning(f"Could not load agent {agent_id}: {e}")

        if not agent_defs:
            await processor.send_response(hook.config, chat_id, "⚠️ No agents available in the configured team.")
            return

        result = await graph_service.run_with_definitions(
            user_input=text,
            definitions=agent_defs,
            max_rounds=team.max_steps or 6,
        )

        # Extract final output text
        output = ""
        if result and result.turns:
            last = result.turns[-1]
            output = getattr(last, "content", "") or getattr(last, "output", "") or str(last)

        if not output:
            output = "I processed your request but have no output to share."

        await processor.send_response(hook.config, chat_id, output)

    except Exception as exc:
        logger.error(f"Webhook processing error [{platform}]: {exc}")
        try:
            proc = get_processor(platform)
            if proc:
                await proc.send_response(hook.config, chat_id, f"⚠️ Error processing request: {str(exc)[:200]}")
        except Exception:
            pass


@router.get("/{platform}/{workspace_id}/{hook_id}")
async def webhook_verify(
    platform: str,
    workspace_id: str,
    hook_id: str,
    request: Request,
    service: WorkspaceService = Depends(get_workspace_service),
):
    """Handle GET-based webhook verification (Facebook, Instagram, WhatsApp, WeChat)."""
    try:
        workspace = service.get_workspace(workspace_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Workspace not found")

    hook = next((h for h in workspace.platform_hooks if h.id == hook_id), None)
    if not hook:
        raise HTTPException(status_code=404, detail="Hook not found")

    processor = get_processor(platform)
    if not processor:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")

    params = dict(request.query_params)
    response = processor.get_verification_response(params, hook.config)
    if response:
        return PlainTextResponse(content=str(response.get("content", "")))

    return PlainTextResponse(content="OK")


@router.post("/{platform}/{workspace_id}/{hook_id}")
async def webhook_receive(
    platform: str,
    workspace_id: str,
    hook_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    service: WorkspaceService = Depends(get_workspace_service),
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
):
    """Receive incoming message from platform, process via agent graph, reply."""
    try:
        workspace = service.get_workspace(workspace_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Workspace not found")

    hook = next((h for h in workspace.platform_hooks if h.id == hook_id), None)
    if not hook:
        raise HTTPException(status_code=404, detail="Hook not found")

    if not hook.enabled:
        return {"ok": True, "status": "hook_disabled"}

    processor = get_processor(platform)
    if not processor:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")

    # Parse body — handle XML (WeChat) or JSON
    raw_body = await request.body()
    body: Dict[str, Any] = {}
    content_type = request.headers.get("content-type", "")

    if "xml" in content_type or raw_body.startswith(b"<"):
        try:
            root = ET.fromstring(raw_body.decode("utf-8"))
            body = {child.tag: child.text for child in root}
        except Exception:
            body = {}
    else:
        try:
            body = json.loads(raw_body) if raw_body else {}
        except Exception:
            body = {}

    # Slack URL verification challenge (POST body)
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    incoming = processor.extract_message(body)
    if not incoming:
        return {"ok": True, "status": "not_a_message"}

    # Process in background so we return 200 quickly to platform
    background_tasks.add_task(
        _process_message,
        platform=platform,
        hook=hook,
        workspace=workspace,
        chat_id=incoming.chat_id,
        text=incoming.text,
        agent_service=agent_service,
        tool_manager=tool_manager,
    )

    return {"ok": True, "status": "processing"}
