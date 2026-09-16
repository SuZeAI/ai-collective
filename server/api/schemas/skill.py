from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# Sentinel returned in place of secret-like config values so API responses
# never leak stored credentials (API keys, webhook secrets, OAuth tokens).
# Recognized on save by the router's upsert merge logic, which treats an
# unchanged sentinel as "keep the existing stored value".
MASKED_SECRET_VALUE = "__MASKED__"

_SECRET_KEY_HINTS = ("key", "secret", "token", "password", "credential")


def is_secret_config_key(key: str) -> bool:
    lowered = key.lower()
    return any(hint in lowered for hint in _SECRET_KEY_HINTS)


def mask_secret_config(config: dict) -> dict:
    """Replace non-empty secret-like config values with a fixed sentinel."""
    masked: dict[str, Any] = {}
    for k, v in config.items():
        if is_secret_config_key(k) and v:
            masked[k] = MASKED_SECRET_VALUE
        else:
            masked[k] = v
    return masked


def merge_config_preserving_secrets(existing: dict | None, incoming: dict) -> dict:
    """Merge a client-submitted config into the previously stored one.

    Clients only ever see ``MASKED_SECRET_VALUE`` for secret-like keys (see
    ``mask_secret_config``); an untouched edit form round-trips that sentinel
    back on save. Treat that as "keep the existing stored value" instead of
    overwriting the real secret with the placeholder. Any other incoming
    value (a genuinely new secret, or an explicit empty string to clear it)
    is used as-is.
    """
    existing = existing or {}
    merged: dict[str, Any] = {}
    for k, v in incoming.items():
        if is_secret_config_key(k) and v == MASKED_SECRET_VALUE and k in existing:
            merged[k] = existing[k]
        else:
            merged[k] = v
    return merged


class SkillSchema(BaseModel):
    id: str
    name: str
    description: str = ""
    third_party: str = ""
    tool_name: str | None = None
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    code: str | None = None
    instruction: str = ""
    owner_id: str = "default"
    company_id: str = "__default__"

    @staticmethod
    def from_domain(s) -> "SkillSchema":
        fallback_avatar = (getattr(s, "avatar", "") or getattr(s, "name", "") or "S")[:1].upper()
        return SkillSchema(
            id=s.id,
            name=s.name,
            description=s.description,
            third_party=s.third_party,
            tool_name=s.tool_name,
            kind=s.kind,
            config=mask_secret_config(dict(s.config or {})),
            avatar=fallback_avatar,
            avatar_icon=getattr(s, "avatar_icon", "") or "",
            avatar_color=getattr(s, "avatar_color", "") or "",
            avatar_url=getattr(s, "avatar_url", "") or "",
            code=s.code,
            instruction=getattr(s, "instruction", "") or "",
            owner_id=getattr(s, "owner_id", "default") or "default",
            company_id=getattr(s, "company_id", "__default__") or "__default__",
        )


class UpsertSkillRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    third_party: str = ""
    tool_name: str | None = None
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    avatar: str | None = None
    avatar_icon: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
    code: str | None = None
    instruction: str | None = None
    company_id: str | None = None


class SkillToolConfigFieldSchema(BaseModel):
    key: str
    label: str
    input: Literal["text", "textarea", "select", "boolean"] = "text"
    required: bool = False
    default: Any = None
    placeholder: str = ""
    options: list[str] = Field(default_factory=list)
    rows: int | None = None
    description: str = ""


class SkillToolPresetSchema(BaseModel):
    tool_name: str
    label: str
    third_party: str
    config_fields: list[SkillToolConfigFieldSchema] = Field(default_factory=list)


class GoogleSheetOAuthStartRequest(BaseModel):
    email_hint: str | None = None
    tool_name: str | None = None


class GoogleSheetOAuthStartResponse(BaseModel):
    authorize_url: str
    state: str
    expires_in_seconds: int = 600
    redirect_uri: str = ""


class GoogleSheetOAuthStatusResponse(BaseModel):
    state: str
    status: Literal["pending", "authorized", "error"]
    authorized: bool
    email: str = ""
    token_path: str = ""
    error: str = ""
