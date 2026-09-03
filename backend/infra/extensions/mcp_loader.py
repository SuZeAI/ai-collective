"""Seed MCP servers declared in ``mcp.yml`` into the skill store at boot.

Each enabled ``servers:`` entry becomes a skill with ``tool_name = "mcp"`` so
agents can attach it like any other skill (see ``docs/mcp-guide.md``). The file
is the source of truth for the servers it declares: their records are upserted
on every boot under deterministic ids (prefix ``skill_mcpext_``). Skills created
through the UI are never touched.

``${VAR}`` references in string values are expanded from the environment at seed
time, so tokens stay in ``.env`` and out of the committed ``mcp.yml``.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from backend.api.config_loader import expand_env
from backend.api.settings import settings
from backend.log import get_logger

logger = get_logger(__name__)

_MANAGED_ID_PREFIX = "skill_mcpext_"


def _config_path() -> Path:
    from backend.api.config_loader import PROJECT_ROOT

    raw = settings.mcp.config_file or "mcp.yml"
    p = Path(raw)
    return p if p.is_absolute() else PROJECT_ROOT / p


def _managed_id(name: str) -> str:
    digest = hashlib.sha1(name.strip().lower().encode("utf-8")).hexdigest()[:24]
    return f"{_MANAGED_ID_PREFIX}{digest}"


def _build_skill_record(entry: dict[str, Any]) -> dict[str, Any] | None:
    """Map one ``servers:`` entry to a skill record, or None if invalid/disabled."""
    from backend.domain.models import DEFAULT_OWNER_ID

    name = str(entry.get("name") or "").strip()
    if not name:
        logger.warning("mcp.yml: skipping a server entry with no 'name'")
        return None
    if not bool(entry.get("enabled", False)):
        return None

    entry = expand_env(entry)
    transport = str(entry.get("transport") or "stdio").strip()

    # Only the connection fields the MCPToolkit understands; native types are
    # fine — its parsers accept both JSON/list/dict and string forms.
    config: dict[str, Any] = {"transport": transport}
    for field in ("command", "args", "env", "url", "headers", "allowed_tools"):
        if entry.get(field) is not None:
            config[field] = entry[field]
    config["timeout_seconds"] = str(entry.get("timeout_seconds") or 60)

    return {
        "id": _managed_id(name),
        "name": name,
        "description": str(entry.get("description") or f"MCP server: {name}"),
        "third_party": "MCP",
        "kind": "integration",
        "avatar": "M",
        "avatar_icon": "plug",
        "avatar_color": "#60A5FA",
        "avatar_url": "",
        "tool_name": "mcp",
        "config": config,
        "code": None,
        "owner_id": DEFAULT_OWNER_ID,
        "instruction": str(entry.get("instruction") or ""),
    }


def _load_entries() -> list[dict[str, Any]]:
    path = _config_path()
    if not path.exists():
        return []
    import yaml

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    servers = raw.get("servers") if isinstance(raw, dict) else None
    if not isinstance(servers, list):
        return []
    return [s for s in servers if isinstance(s, dict)]


def seed_mcp_extensions() -> None:
    """Upsert enabled mcp.yml servers into the skill store. Never blocks boot."""
    if not settings.mcp.auto_seed:
        return

    try:
        entries = _load_entries()
        records = [r for r in (_build_skill_record(e) for e in entries) if r]
        if not records:
            logger.info("MCP extensions: no enabled servers in mcp.yml — nothing to seed")
            return

        if settings.storage_backend == "mongo":
            _upsert_mongo(records)
        else:
            _upsert_json(records)
    except Exception as exc:  # never block startup on a seeding error
        logger.error("MCP extension seed failed: %s", exc)


def _upsert_mongo(records: list[dict[str, Any]]) -> None:
    import pymongo

    from backend.api.settings import settings

    db = pymongo.MongoClient(settings.mongo_uri)[settings.mongo_db]
    count = 0
    for rec in records:
        doc = dict(rec)
        doc["_id"] = doc.pop("id")
        db["skills"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
        count += 1
    logger.info("MCP extensions: upserted %d server(s) into Mongo skills", count)


def _upsert_json(records: list[dict[str, Any]]) -> None:
    from backend.api.deps import STORAGE_DIR
    from backend.infra.repositories.json_store import JsonFileStore

    store = JsonFileStore(STORAGE_DIR / "skills.json")
    live = store.read()
    if not isinstance(live, list):
        live = []

    by_id = {r["id"]: r for r in records}
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for existing in live:
        if not isinstance(existing, dict):
            continue
        eid = existing.get("id")
        if eid in by_id:
            out.append(by_id[eid])  # file is the source of truth — replace
            seen.add(eid)
        else:
            out.append(existing)
    for rid, rec in by_id.items():
        if rid not in seen:
            out.append(rec)

    store.write(out)
    logger.info(
        "MCP extensions: upserted %d server(s) into %s/skills.json",
        len(records),
        STORAGE_DIR.name,
    )
