"""Framework-free plan model and pure business rules for the AI Office Designer.

An OfficePlan is the LLM-generated blueprint (departments -> staff -> skills)
produced by the office-builder chat flow, before it is materialized into real
Skill/Staff/Department/Company entities.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from server.domain.models import Company
from server.share.log import get_logger

TEAM_MODES = ("sequential", "mesh", "ring", "supervisor", "tree")
COMPANY_TYPES = ("software", "marketing", "research", "general")

# Cap how many existing entities of each kind are listed in the designer prompt,
# to bound token usage.
MAX_EXISTING_LISTED = 60

# Config keys that look like secrets (API keys, tokens, ...) are never
# accepted from the designer LLM or from a client-submitted plan — the user
# configures those by hand after the plan is applied.
_SECRET_KEY_HINTS = ("key", "secret", "token", "password", "credential")


def is_secret_config_key(key: str) -> bool:
    lowered = key.lower()
    return any(hint in lowered for hint in _SECRET_KEY_HINTS)


@dataclass
class SkillPlan:
    name: str
    description: str = ""
    tool_name: str | None = None  # must reference an available tool, or None
    existing_id: str | None = None  # reuse this existing skill instead of creating one
    config: dict[str, Any] = field(default_factory=dict)  # non-secret tool param values, pre-filled by the LLM


@dataclass
class StaffPlan:
    name: str
    role: str
    description: str = ""
    skills: list[SkillPlan] = field(default_factory=list)
    existing_id: str | None = None  # reuse this existing staff member instead of creating one


@dataclass
class DepartmentPlan:
    name: str
    description: str = ""
    mode: str = "sequential"  # sequential | mesh | ring | supervisor | tree
    staff: list[StaffPlan] = field(default_factory=list)
    existing_id: str | None = None  # reuse this existing department instead of creating one


@dataclass
class OfficePlan:
    name: str
    description: str = ""
    company_type: str = "general"
    departments: list[DepartmentPlan] = field(default_factory=list)


@dataclass
class ApplyOfficePlanResult:
    company: Company
    department_ids: list[str]
    staff_ids: list[str]
    skill_ids: list[str]
    reused_skill_ids: list[str]
    reused_staff_ids: list[str]
    reused_department_ids: list[str]


# ─── Parsing (raw LLM JSON -> plan) ──────────────────────────────────────────

def _require_str(raw: dict, key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str):
        raise ValueError(f"'{key}' must be a string")
    return value


def _optional_str(raw: dict, key: str) -> str | None:
    value = raw.get(key)
    return value if isinstance(value, str) else None


def _parse_skill_config(raw: dict) -> dict[str, Any]:
    value = raw.get("config")
    if not isinstance(value, dict):
        return {}
    return {
        k: v
        for k, v in value.items()
        if isinstance(k, str) and isinstance(v, (str, bool, int, float)) and not is_secret_config_key(k)
    }


def _parse_skill_plan(raw: dict) -> SkillPlan:
    return SkillPlan(
        name=_require_str(raw, "name"),
        description=str(raw.get("description") or ""),
        tool_name=_optional_str(raw, "tool_name"),
        existing_id=_optional_str(raw, "existing_id"),
        config=_parse_skill_config(raw),
    )


def _parse_staff_plan(raw: dict) -> StaffPlan:
    return StaffPlan(
        name=_require_str(raw, "name"),
        role=_require_str(raw, "role"),
        description=str(raw.get("description") or ""),
        skills=[_parse_skill_plan(s) for s in raw.get("skills") or [] if isinstance(s, dict)],
        existing_id=_optional_str(raw, "existing_id"),
    )


def _parse_department_plan(raw: dict) -> DepartmentPlan:
    return DepartmentPlan(
        name=_require_str(raw, "name"),
        description=str(raw.get("description") or ""),
        mode=str(raw.get("mode") or "sequential"),
        staff=[_parse_staff_plan(s) for s in raw.get("staff") or [] if isinstance(s, dict)],
        existing_id=_optional_str(raw, "existing_id"),
    )


def parse_office_plan(raw: dict) -> OfficePlan:
    return OfficePlan(
        name=_require_str(raw, "name"),
        description=str(raw.get("description") or ""),
        company_type=str(raw.get("company_type") or "general"),
        departments=[_parse_department_plan(d) for d in raw.get("departments") or [] if isinstance(d, dict)],
    )


# ─── Sanitization ─────────────────────────────────────────────────────────

def sanitize_office_plan(
    plan: OfficePlan,
    available_tools: set[str],
    existing_department_ids: set[str],
    existing_staff_ids: set[str],
    existing_skill_ids: set[str],
    presets_by_tool: dict[str, dict] | None = None,
) -> OfficePlan:
    presets_by_tool = presets_by_tool or {}
    if plan.company_type not in COMPANY_TYPES:
        plan.company_type = "general"
    for dept in plan.departments:
        if dept.existing_id and dept.existing_id not in existing_department_ids:
            dept.existing_id = None
        if dept.mode not in TEAM_MODES:
            dept.mode = "sequential"
        for member in dept.staff:
            if member.existing_id and member.existing_id not in existing_staff_ids:
                member.existing_id = None
            for skill in member.skills:
                if skill.existing_id and skill.existing_id not in existing_skill_ids:
                    skill.existing_id = None
                if skill.tool_name and skill.tool_name not in available_tools:
                    get_logger().warning(
                        "Office builder: dropping unknown tool '%s' from skill '%s'",
                        skill.tool_name,
                        skill.name,
                    )
                    skill.tool_name = None
                # Only keep config values for fields the tool's preset actually
                # declares, and never for secret-looking keys (API keys, tokens, ...).
                config_fields = (presets_by_tool.get(skill.tool_name or "") or {}).get("config_fields") or []
                allowed_keys = {f.get("key") for f in config_fields}
                skill.config = (
                    {k: v for k, v in skill.config.items() if k in allowed_keys and not is_secret_config_key(k)}
                    if skill.tool_name
                    else {}
                )
                # A select-type field only accepts its declared options -- the
                # designer LLM can otherwise invent a plausible-sounding but
                # unsupported value (e.g. browser.driver="playwright" when only
                # "browser_use" is implemented), which then only fails much
                # later at actual tool-run time with a cryptic error. Clamp to
                # the field's default (or drop it) instead.
                for field_spec in config_fields:
                    key = field_spec.get("key")
                    options = field_spec.get("options")
                    if key in skill.config and options and skill.config[key] not in options:
                        get_logger().warning(
                            "Office builder: skill '%s' field '%s' had unsupported value %r, "
                            "clamping to default",
                            skill.name, key, skill.config[key],
                        )
                        default = field_spec.get("default")
                        if default is not None:
                            skill.config[key] = default
                        else:
                            skill.config.pop(key, None)
    return plan


# ─── Streaming reply parsing ──────────────────────────────────────────────

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)(?:```|\Z)", re.DOTALL)


def chunk_text(chunk) -> str:
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


def split_reply_and_plan(
    full: str,
    available_tools: set[str],
    existing_department_ids: set[str],
    existing_staff_ids: set[str],
    existing_skill_ids: set[str],
    presets_by_tool: dict[str, dict] | None = None,
) -> tuple[str, OfficePlan | None]:
    """Split streamed output into the visible reply and a sanitized plan (if any)."""
    fence = full.find("```")
    reply = (full[:fence] if fence != -1 else full).strip()
    plan: OfficePlan | None = None
    match = _FENCE_RE.search(full)
    if match:
        raw = match.group(1).strip()
        try:
            plan = sanitize_office_plan(
                parse_office_plan(json.loads(raw)),
                available_tools,
                existing_department_ids,
                existing_staff_ids,
                existing_skill_ids,
                presets_by_tool,
            )
        except Exception:
            get_logger().exception("Office builder: streamed plan failed to parse/validate")
    if not reply:
        reply = "Here is the updated office plan." if plan else "Could you tell me more about the office you want?"
    return reply, plan


# ─── Apply-time helpers ───────────────────────────────────────────────────

def preset_default_config(tool_name: str | None, presets_by_tool: dict[str, dict]) -> dict:
    if not tool_name:
        return {}
    preset = presets_by_tool.get(tool_name) or {}
    config: dict = {}
    for cfg_field in preset.get("config_fields") or []:
        key = cfg_field.get("key")
        if key is not None and cfg_field.get("default") is not None:
            config[key] = cfg_field["default"]
    return config


def resolve_skill_config(
    tool_name: str | None, plan_config: dict[str, Any], presets_by_tool: dict[str, dict]
) -> dict:
    """Preset defaults, overlaid with the plan's (already non-secret) values for
    fields the tool actually declares — re-filtered here too, since a plan can
    reach `apply()` straight from a client-submitted request, not only from the
    designer LLM via `sanitize_office_plan`."""
    if not tool_name:
        return {}
    defaults = preset_default_config(tool_name, presets_by_tool)
    preset = presets_by_tool.get(tool_name) or {}
    allowed_keys = {f.get("key") for f in preset.get("config_fields") or []}
    safe_plan_config = {
        k: v for k, v in (plan_config or {}).items() if k in allowed_keys and not is_secret_config_key(k)
    }
    return {**defaults, **safe_plan_config}
