from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Any, AsyncIterator
from uuid import uuid4

from server.app.ports.llm import LLMProvider
from server.app.service.company_service import CompanyService
from server.app.service.department_activation import activate_department_staff, seed_department_kickoff_messages
from server.app.service.department_service import DepartmentService
from server.app.service.meeting_service import MeetingService
from server.app.service.skill_service import SkillService
from server.app.service.staff_service import StaffService
from server.domain.enums import StaffStatus
from server.domain.errors import ValidationError
from server.domain.models import CATALOG_COMPANY_ID, Company, Department, Skill, Staff, is_visible_to
from server.domain.office_builder import (
    TEAM_MODES,
    ApplyOfficePlanResult,
    OfficePlan,
    chunk_text,
    parse_office_plan,
    resolve_skill_config,
    sanitize_office_plan,
    split_reply_and_plan,
)
from server.domain.prompt.office_builder_prompt import (
    build_designer_system_prompt,
    build_streaming_designer_system_prompt,
    serialize_conversation,
)
from server.domain.prompt.staff_system_prompt import build_staff_system_prompt
from server.share.log import get_logger

logger = get_logger(__name__)


class OfficeBuilderService:
    """Chat-to-plan generation and plan application for the AI Office Designer."""

    def __init__(
        self,
        llm: LLMProvider | None,
        skill_service: SkillService,
        staff_service: StaffService,
        department_service: DepartmentService,
        company_service: CompanyService,
        conv_service: MeetingService,
    ) -> None:
        self._llm = llm
        self._skills = skill_service
        self._staff = staff_service
        self._departments = department_service
        self._companies = company_service
        self._conversations = conv_service

    def is_llm_configured(self) -> bool:
        return self._llm is not None

    def _load_existing_context(
        self, owner_id: str
    ) -> tuple[list[Department], list[Staff], list[Skill], list[Company]]:
        """Template departments/staff/skills (the shared catalog, company_id ==
        CATALOG_COMPANY_ID) offered to the designer LLM as reuse candidates
        instead of always designing from scratch. `apply()` always creates a
        brand-new company, so candidates from another *real* company are never
        offered — Staff/Skill/Department each belong to exactly one company."""
        departments = [
            d
            for d in self._departments.list_departments()
            if is_visible_to(owner_id, d.owner_id) and d.company_id == CATALOG_COMPANY_ID
        ]
        staff = [
            s
            for s in self._staff.list_staff()
            if is_visible_to(owner_id, s.owner_id) and s.company_id == CATALOG_COMPANY_ID
        ]
        skills = [
            s
            for s in self._skills.list_skills()
            if is_visible_to(owner_id, s.owner_id) and s.company_id == CATALOG_COMPANY_ID
        ]
        companies = [c for c in self._companies.list_companies() if is_visible_to(owner_id, c.owner_id)]
        return departments, staff, skills, companies

    # ─── Plan generation (chat) ─────────────────────────────────────────────

    async def generate_plan(
        self,
        messages: list[tuple[str, str]],
        current_plan: OfficePlan | None,
        owner_id: str,
    ) -> tuple[str, OfficePlan | None]:
        presets = self._skills.list_tool_presets()
        presets_by_tool = {p["tool_name"]: p for p in presets}
        existing_departments, existing_staff, existing_skills, existing_companies = self._load_existing_context(
            owner_id
        )
        system = build_designer_system_prompt(
            presets, existing_departments, existing_staff, existing_skills, existing_companies
        )
        user = serialize_conversation(messages, current_plan)

        data = await self._llm.generate_json(system=system, user=user)

        reply = str(data.get("reply") or "").strip() or "Here is the updated office plan."
        raw_plan = data.get("plan")
        plan: OfficePlan | None = None
        if isinstance(raw_plan, dict):
            try:
                available = set(self._skills.list_available_tool_names())
                plan = sanitize_office_plan(
                    parse_office_plan(raw_plan),
                    available,
                    {d.id for d in existing_departments},
                    {s.id for s in existing_staff},
                    {s.id for s in existing_skills},
                    presets_by_tool,
                )
            except Exception:
                logger.exception("Office builder: generated plan failed validation")
                plan = current_plan  # keep the previous draft instead of losing it
        return reply, plan or current_plan

    async def stream_plan(
        self,
        messages: list[tuple[str, str]],
        current_plan: OfficePlan | None,
        owner_id: str,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yields structured events consumed by the router and re-emitted as SSE:
          {"type": "delta", "text": ...}   incremental reply text (plan block withheld)
          {"type": "plan", "plan": OfficePlan}  sanitized plan, once fully parsed
          {"type": "done", "reply": ...}   final canonical reply text
          {"type": "error", "detail": ...}
        """
        from langchain_core.messages import HumanMessage, SystemMessage

        presets = self._skills.list_tool_presets()
        presets_by_tool = {p["tool_name"]: p for p in presets}
        available = set(self._skills.list_available_tool_names())
        existing_departments, existing_staff, existing_skills, existing_companies = self._load_existing_context(
            owner_id
        )
        existing_department_ids = {d.id for d in existing_departments}
        existing_staff_ids = {s.id for s in existing_staff}
        existing_skill_ids = {s.id for s in existing_skills}
        system = build_streaming_designer_system_prompt(
            presets, existing_departments, existing_staff, existing_skills, existing_companies
        )
        user = serialize_conversation(messages, current_plan, streaming=True)
        model = self._llm.get_chat_model()

        full = ""
        sent = 0
        try:
            async for chunk in model.astream([SystemMessage(content=system), HumanMessage(content=user)]):
                text = chunk_text(chunk)
                if not text:
                    continue
                full += text
                fence = full.find("```")
                # Hold back the last few chars so a "```" fence split across
                # chunks never leaks into the visible reply.
                visible_end = fence if fence != -1 else len(full) - 3
                visible_end = max(sent, visible_end)
                if visible_end > sent:
                    yield {"type": "delta", "text": full[sent:visible_end]}
                    sent = visible_end

            fence = full.find("```")
            visible_end = max(sent, fence if fence != -1 else len(full))
            if visible_end > sent:
                yield {"type": "delta", "text": full[sent:visible_end]}

            reply, plan = split_reply_and_plan(
                full, available, existing_department_ids, existing_staff_ids, existing_skill_ids, presets_by_tool
            )
            if plan is not None:
                yield {"type": "plan", "plan": plan}
            yield {"type": "done", "reply": reply}
        except Exception as exc:
            logger.exception("Office builder streaming plan generation failed")
            yield {"type": "error", "detail": str(exc)}

    # ─── Plan application (create skills -> staff -> departments -> office) ─

    def apply(self, plan: OfficePlan, owner_id: str) -> ApplyOfficePlanResult:
        if not plan.name.strip():
            raise ValidationError("Office name must not be empty")
        if not plan.departments:
            raise ValidationError("Office must contain at least one department")

        available_tools = set(self._skills.list_available_tool_names())
        presets_by_tool = {p["tool_name"]: p for p in self._skills.list_tool_presets()}
        # Minted up front (not inline in the Company(...) call below) so cloned
        # reuse candidates can be stamped with their final company_id as they're created.
        new_company_id = f"ws_{uuid4().hex}"

        # Only shared templates (the admin-curated catalog) are candidates for
        # reuse — apply() always creates a brand-new company, and Staff/Skill/
        # Department each belong to exactly one company, so anything reused
        # from the catalog is cloned into the new company, never referenced
        # in place from wherever it already lives.
        existing_skills_by_id = {
            s.id: s
            for s in self._skills.list_skills()
            if is_visible_to(owner_id, s.owner_id) and s.company_id == CATALOG_COMPANY_ID
        }
        existing_staff_by_id = {
            s.id: s
            for s in self._staff.list_staff()
            if is_visible_to(owner_id, s.owner_id) and s.company_id == CATALOG_COMPANY_ID
        }
        existing_departments_by_id = {
            d.id: d
            for d in self._departments.list_departments()
            if is_visible_to(owner_id, d.owner_id) and d.company_id == CATALOG_COMPANY_ID
        }

        # Also reuse existing skills when name + tool match (case-insensitive), so repeated
        # office generations don't pile up duplicate skills even without an explicit existing_id.
        existing_by_key = {
            (s.name.strip().lower(), s.tool_name or ""): s for s in existing_skills_by_id.values()
        }
        created_skill_ids: list[str] = []
        reused_skill_ids: list[str] = []
        plan_skill_ids: dict[tuple[str, str], str] = {}
        cloned_skill_ids: dict[str, str] = {}  # template skill id -> clone id, so each template is cloned once

        def _clone_skill_template(template: Skill) -> str:
            if template.id in cloned_skill_ids:
                return cloned_skill_ids[template.id]
            saved = self._skills.upsert_skill(
                replace(
                    template,
                    id=f"skill_{uuid4().hex}",
                    config=dict(template.config or {}),
                    owner_id=owner_id,
                    company_id=new_company_id,
                )
            )
            cloned_skill_ids[template.id] = saved.id
            reused_skill_ids.append(saved.id)
            return saved.id

        def _resolve_skill(
            name: str, description: str, tool_name: str | None, existing_id: str | None, config: dict
        ) -> str:
            if existing_id and existing_id in existing_skills_by_id:
                return _clone_skill_template(existing_skills_by_id[existing_id])
            tool = tool_name if tool_name in available_tools else None
            key = (name.strip().lower(), tool or "")
            if key in plan_skill_ids:
                return plan_skill_ids[key]
            existing = existing_by_key.get(key)
            if existing is not None:
                cloned_id = _clone_skill_template(existing)
                plan_skill_ids[key] = cloned_id
                return cloned_id
            preset = presets_by_tool.get(tool or "") or {}
            saved = self._skills.upsert_skill(
                Skill(
                    id=f"skill_{uuid4().hex}",
                    name=name.strip(),
                    description=description.strip(),
                    third_party=preset.get("third_party") or "",
                    kind="integration",
                    config=resolve_skill_config(tool, config, presets_by_tool),
                    avatar=(name.strip()[:1] or "S").upper(),
                    tool_name=tool,
                    owner_id=owner_id,
                    company_id=new_company_id,
                )
            )
            plan_skill_ids[key] = saved.id
            created_skill_ids.append(saved.id)
            return saved.id

        staff_ids: list[str] = []
        department_ids: list[str] = []
        reused_staff_ids: list[str] = []
        reused_department_ids: list[str] = []

        cloned_staff_by_template_id: dict[str, Staff] = {}

        def _clone_staff_template(template: Staff) -> Staff:
            if template.id in cloned_staff_by_template_id:
                return cloned_staff_by_template_id[template.id]
            skill_ids = [
                _clone_skill_template(existing_skills_by_id[sid])
                for sid in template.skill_ids
                if sid in existing_skills_by_id
            ]
            saved_staff = self._staff.upsert_staff(
                replace(
                    template,
                    id=f"agent_{uuid4().hex}",
                    skill_ids=skill_ids,
                    status=StaffStatus.active,
                    owner_id=owner_id,
                    company_id=new_company_id,
                )
            )
            staff_ids.append(saved_staff.id)
            reused_staff_ids.append(saved_staff.id)
            cloned_staff_by_template_id[template.id] = saved_staff
            return saved_staff

        for dept in plan.departments:
            dept_staff_ids: list[str] = []
            for member in dept.staff:
                if member.existing_id and member.existing_id in existing_staff_by_id:
                    cloned = _clone_staff_template(existing_staff_by_id[member.existing_id])
                    dept_staff_ids.append(cloned.id)
                    continue
                skill_ids = [
                    _resolve_skill(s.name, s.description, s.tool_name, s.existing_id, s.config)
                    for s in member.skills
                    if s.name.strip()
                ]
                description = member.description.strip() or f"{member.role} staff"
                saved_staff = self._staff.upsert_staff(
                    Staff(
                        id=f"agent_{uuid4().hex}",
                        name=member.name.strip() or member.role,
                        role=member.role.strip() or "Specialist",
                        description=description,
                        skill_ids=skill_ids,
                        status=StaffStatus.active,
                        avatar=(member.name.strip()[:1] or "A").upper(),
                        system_prompt=build_staff_system_prompt(
                            name=member.name, role=member.role, description=description
                        ),
                        owner_id=owner_id,
                        company_id=new_company_id,
                    )
                )
                dept_staff_ids.append(saved_staff.id)
                staff_ids.append(saved_staff.id)

            mode = dept.mode if dept.mode in TEAM_MODES else "sequential"
            if dept.existing_id and dept.existing_id in existing_departments_by_id:
                template_dept = existing_departments_by_id[dept.existing_id]
                cloned_template_staff_ids = [
                    _clone_staff_template(existing_staff_by_id[aid]).id
                    for aid in template_dept.staff
                    if aid in existing_staff_by_id
                ]
                merged_staff = cloned_template_staff_ids + [
                    sid for sid in dept_staff_ids if sid not in cloned_template_staff_ids
                ]
                saved_team = self._departments.upsert_department(
                    replace(
                        template_dept,
                        id=f"team_{uuid4().hex}",
                        staff=merged_staff,
                        active_tasks=1 if merged_staff else 0,
                        owner_id=owner_id,
                        company_id=new_company_id,
                    )
                )
                department_ids.append(saved_team.id)
                reused_department_ids.append(saved_team.id)
                activate_department_staff(saved_team.staff, self._staff)
                seed_department_kickoff_messages(saved_team, self._staff, self._conversations)
            else:
                saved_team = self._departments.upsert_department(
                    Department(
                        id=f"team_{uuid4().hex}",
                        name=dept.name.strip() or "Department",
                        description=dept.description.strip() or f"{dept.name} department",
                        staff=dept_staff_ids,
                        active_tasks=1 if dept_staff_ids else 0,
                        avatar=(dept.name.strip()[:1] or "T").upper(),
                        mode=mode,
                        owner_id=owner_id,
                        company_id=new_company_id,
                    )
                )
                department_ids.append(saved_team.id)
                # Mirror the manual department-creation flow (activation + kickoff messages).
                activate_department_staff(saved_team.staff, self._staff)
                seed_department_kickoff_messages(saved_team, self._staff, self._conversations)

        workspace = self._companies.upsert_company(
            Company(
                id=new_company_id,
                name=plan.name.strip(),
                description=plan.description.strip(),
                department_ids=department_ids,
                primary_department_id=department_ids[0] if department_ids else "",
                created_at=datetime.now(timezone.utc),
                type=(plan.company_type or "general"),
                avatar=(plan.name.strip()[:1] or "W").upper(),
                owner_id=owner_id,
            )
        )

        return ApplyOfficePlanResult(
            company=workspace,
            department_ids=department_ids,
            staff_ids=staff_ids,
            skill_ids=created_skill_ids,
            reused_skill_ids=reused_skill_ids,
            reused_staff_ids=reused_staff_ids,
            reused_department_ids=reused_department_ids,
        )
