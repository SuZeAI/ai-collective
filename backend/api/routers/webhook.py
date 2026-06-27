from __future__ import annotations

import json
from typing import Any, Dict

import defusedxml.ElementTree as ET
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse

from backend.api.deps import (
    get_staff_service,
    get_skill_tool_manager,
    get_company_service,
)
from backend.application.ports.staff_graph import GraphStaffDefinition
from backend.application.service.staff_service import StaffService
from backend.application.service.company_service import CompanyService
from backend.domain.errors import NotFoundError
from backend.domain.models import PlatformHook, Company
from backend.domain.thirty_part.registry import get_processor
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.log import get_logger

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = get_logger(__name__)


async def _process_message(
    platform: str,
    hook: PlatformHook,
    workspace: Company,
    chat_id: str,
    text: str,
    staff_service: StaffService,
    tool_manager: SkillToolManager,
) -> None:
    """Run staff graph with user message and send response back to platform."""
    processor = get_processor(platform)
    if not processor:
        logger.warning(f"No processor for platform {platform}")
        return

    try:
        from backend.api.deps import get_staff_graph_service, get_department_service
        graph_service = get_staff_graph_service()
        department_service = get_department_service()

        if not graph_service:
            await processor.send_response(hook.config, chat_id, "⚠️ AI service is not configured.")
            return

        # Resolve staff from primary department
        department_id = workspace.primary_department_id or (workspace.department_ids[0] if workspace.department_ids else None)
        if not department_id:
            await processor.send_response(hook.config, chat_id, "⚠️ No department configured for this workspace.")
            return

        department = department_service.get_department(department_id)
        staff_defs: list[GraphStaffDefinition] = []
        for staff_id in department.staff:
            try:
                staff = staff_service.get_staff(staff_id)
                skills = staff_service.get_staff_skills(staff_id)
                tools = []
                for skill in skills:
                    tk = tool_manager.get_tool_for_skill(skill)
                    if tk:
                        tools.extend(tk.get_tools())
                staff_defs.append(
                    GraphStaffDefinition(
                        staff_id=staff.id,
                        name=staff.name,
                        role=staff.role,
                        system_prompt=staff.system_prompt or f"You are {staff.name}, a {staff.role}.",
                        tools=tools,
                    )
                )
            except Exception as e:
                logger.warning(f"Could not load staff {staff_id}: {e}")

        if not staff_defs:
            await processor.send_response(hook.config, chat_id, "⚠️ No staff available in the configured department.")
            return

        result = await graph_service.run_with_definitions(
            user_input=text,
            definitions=staff_defs,
            max_rounds=department.max_steps or 6,
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
        logger.exception(f"Webhook processing error [{platform}]: {exc}")
        try:
            proc = get_processor(platform)
            if proc:
                await proc.send_response(hook.config, chat_id, f"⚠️ Error processing request: {str(exc)[:200]}")
        except Exception:
            logger.warning("Failed to deliver error notification to %s/%s", platform, chat_id)


@router.get("/{platform}/{company_id}/{hook_id}")
async def webhook_verify(
    platform: str,
    company_id: str,
    hook_id: str,
    request: Request,
    service: CompanyService = Depends(get_company_service),
):
    """Handle GET-based webhook verification (Facebook, Instagram, WhatsApp, WeChat)."""
    try:
        workspace = service.get_company(company_id)
    except (NotFoundError, KeyError):
        raise HTTPException(status_code=404, detail="Company not found")

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


@router.post("/{platform}/{company_id}/{hook_id}")
async def webhook_receive(
    platform: str,
    company_id: str,
    hook_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    service: CompanyService = Depends(get_company_service),
    staff_service: StaffService = Depends(get_staff_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
):
    """Receive incoming message from platform, process via staff graph, reply."""
    try:
        workspace = service.get_company(company_id)
    except (NotFoundError, KeyError):
        raise HTTPException(status_code=404, detail="Company not found")

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

    # Verify the webhook signature before doing any work. Processors that have
    # a secret configured will reject forged/unsigned requests; those without a
    # verification mechanism accept (and log nothing) as before.
    if not processor.verify_request(dict(request.headers), raw_body, hook.config):
        logger.warning("Webhook signature verification failed [%s/%s]", platform, hook_id)
        raise HTTPException(status_code=403, detail="Invalid webhook signature")

    body: Dict[str, Any] = {}
    content_type = request.headers.get("content-type", "")

    if "xml" in content_type or raw_body.startswith(b"<"):
        try:
            # defusedxml protects against XXE / billion-laughs on this
            # externally-reachable endpoint.
            root = ET.fromstring(raw_body.decode("utf-8"))
            body = {child.tag: child.text for child in root}
        except Exception:
            logger.warning("Failed to parse XML webhook body [%s/%s]", platform, hook_id)
            body = {}
    else:
        try:
            body = json.loads(raw_body) if raw_body else {}
        except Exception:
            logger.warning("Failed to parse JSON webhook body [%s/%s]", platform, hook_id)
            body = {}

    # Slack URL verification challenge (POST body)
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    # Synchronous POST handshakes (e.g. Discord Interactions PING -> {"type": 1})
    challenge = processor.post_challenge_response(body, hook.config)
    if challenge is not None:
        return challenge

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
        staff_service=staff_service,
        tool_manager=tool_manager,
    )

    return {"ok": True, "status": "processing"}
