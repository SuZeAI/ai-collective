from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from server.api.deps import (
    current_owner_id_dep,
    get_office_builder_service,
    get_office_builder_session_service,
)
from server.api.schemas.company import CompanySchema
from server.api.schemas.office_builder import (
    ApplyOfficePlanRequest,
    ApplyOfficePlanResponse,
    OfficeBuilderChatRequest,
    OfficeBuilderChatResponse,
    OfficeBuilderSessionSchema,
    OfficeBuilderSessionSummarySchema,
    OfficePlan,
    UpsertOfficeBuilderSessionRequest,
)
from server.app.service.office_builder_service import OfficeBuilderService
from server.app.service.office_builder_session_service import OfficeBuilderSessionService
from server.domain.models import OfficeBuilderSession, can_delete, can_modify, is_visible_to
from server.share.log import get_logger


router = APIRouter(prefix="/office-builder", tags=["office-builder"])


# ─── Plan generation (chat) ─────────────────────────────────────────────────

@router.post("/plan", response_model=OfficeBuilderChatResponse)
async def chat_office_plan(
    req: OfficeBuilderChatRequest,
    service: OfficeBuilderService = Depends(get_office_builder_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> OfficeBuilderChatResponse:
    if not service.is_llm_configured():
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")

    try:
        reply, plan = await service.generate_plan(
            messages=[(m.role, m.content) for m in req.messages],
            current_plan=req.plan.to_domain() if req.plan else None,
            owner_id=owner_id,
        )
    except Exception as exc:  # malformed JSON or provider failure
        get_logger().exception("Office builder plan generation failed")
        raise HTTPException(status_code=502, detail=f"Plan generation failed: {exc}")

    return OfficeBuilderChatResponse(reply=reply, plan=OfficePlan.from_domain(plan) if plan else req.plan)


@router.post("/plan-stream")
async def chat_office_plan_stream(
    req: OfficeBuilderChatRequest,
    service: OfficeBuilderService = Depends(get_office_builder_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> StreamingResponse:
    """Streaming variant of /plan; see OfficeBuilderService.stream_plan for the
    generated event types (delta/plan/done/error), re-emitted here as SSE."""
    if not service.is_llm_configured():
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")

    def _event(payload: dict) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    async def event_generator():
        async for event in service.stream_plan(
            messages=[(m.role, m.content) for m in req.messages],
            current_plan=req.plan.to_domain() if req.plan else None,
            owner_id=owner_id,
        ):
            if event["type"] == "plan":
                yield _event({"type": "plan", "plan": OfficePlan.from_domain(event["plan"]).model_dump()})
            else:
                yield _event(event)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─── Plan application (create skills → staff → departments → office) ───────

@router.post("/apply", response_model=ApplyOfficePlanResponse)
def apply_office_plan(
    req: ApplyOfficePlanRequest,
    service: OfficeBuilderService = Depends(get_office_builder_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> ApplyOfficePlanResponse:
    result = service.apply(req.plan.to_domain(), owner_id)
    return ApplyOfficePlanResponse(
        company=CompanySchema.from_domain(result.company),
        department_ids=result.department_ids,
        staff_ids=result.staff_ids,
        skill_ids=result.skill_ids,
        reused_skill_ids=result.reused_skill_ids,
        reused_staff_ids=result.reused_staff_ids,
        reused_department_ids=result.reused_department_ids,
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
    owner_id: str = Depends(current_owner_id_dep),
) -> list[OfficeBuilderSessionSummarySchema]:
    return [
        OfficeBuilderSessionSummarySchema.from_domain(s)
        for s in service.list_sessions()
        if is_visible_to(owner_id, s.owner_id)
    ]


@router.get("/sessions/{session_id}", response_model=OfficeBuilderSessionSchema)
def get_session(
    session_id: str,
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> OfficeBuilderSessionSchema:
    session = service.get_session(session_id)
    if session is None or not is_visible_to(owner_id, session.owner_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return OfficeBuilderSessionSchema.from_domain(session)


@router.post("/sessions", response_model=OfficeBuilderSessionSchema)
def upsert_session(
    req: UpsertOfficeBuilderSessionRequest,
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> OfficeBuilderSessionSchema:
    now = datetime.now(timezone.utc)
    existing = service.get_session(req.id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise HTTPException(status_code=404, detail="Session not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can edit shared default items")
    session = OfficeBuilderSession(
        id=req.id or f"obs_{uuid4().hex}",
        title=_derive_session_title(req),
        messages=[m.model_dump() for m in req.messages],
        plan=req.plan.model_dump() if req.plan else None,
        created_at=existing.created_at if existing else now,
        updated_at=now,
        company_id=req.companyId or (existing.company_id if existing else ""),
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_session(session)
    return OfficeBuilderSessionSchema.from_domain(saved)


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    service: OfficeBuilderSessionService = Depends(get_office_builder_session_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.get_session(session_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise HTTPException(status_code=404, detail="Session not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")
    service.delete_session(session_id)
    return {"deleted": True}
