"""One-off migration: embedded Company ``platformHooks`` → unified ``connections``.

Inbound webhooks used to live embedded on each Company document
(``platformHooks``). They are now first-class ``Connection`` rows with
``kind="inbound_webhook"`` and a ``company_id``. This script moves the existing
embedded hooks into the connections store and strips ``platformHooks`` from the
company docs. It is idempotent (keyed on the hook id) and supports both the
Mongo and JSON storage backends.

Run:  python -m backend.scripts.migrate_platform_hooks_to_connections
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from backend.api.settings import settings


def _hook_to_conn_doc(hook: dict, company_id: str, owner_id: str) -> dict:
    return {
        "id": hook["id"],
        "_id": hook["id"],
        "platform": hook.get("platform", ""),
        "name": hook.get("name", ""),
        "config": dict(hook.get("config") or {}),
        "description": hook.get("description", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "enabled": bool(hook.get("enabled", True)),
        "kind": "inbound_webhook",
        "company_id": company_id,
        "owner_id": owner_id,
    }


def migrate_mongo() -> int:
    import pymongo

    db = pymongo.MongoClient(settings.mongo_uri)[settings.mongo_db]
    companies = db["workspaces"]
    connections = db["connections"]
    moved = 0
    for comp in companies.find({"platformHooks": {"$exists": True, "$ne": []}}):
        owner_id = comp.get("owner_id", "default")
        for hook in comp.get("platformHooks") or []:
            doc = _hook_to_conn_doc(hook, str(comp["id"]), owner_id)
            connections.replace_one({"id": doc["id"]}, doc, upsert=True)
            moved += 1
        companies.update_one({"id": comp["id"]}, {"$unset": {"platformHooks": ""}})
    return moved


def migrate_json() -> int:
    storage = Path(settings.storage_dir or "local_database")
    comp_file = storage / "companies.json"
    conn_file = storage / "connections.json"
    if not comp_file.exists():
        return 0
    companies = json.loads(comp_file.read_text() or "[]")
    connections = json.loads(conn_file.read_text()) if conn_file.exists() else []
    by_id = {c["id"]: c for c in connections}
    moved = 0
    for comp in companies:
        owner_id = comp.get("owner_id", "default")
        for hook in comp.pop("platformHooks", []) or []:
            doc = _hook_to_conn_doc(hook, str(comp["id"]), owner_id)
            by_id[doc["id"]] = doc
            moved += 1
    conn_file.write_text(json.dumps(list(by_id.values()), indent=2))
    comp_file.write_text(json.dumps(companies, indent=2))
    return moved


def main() -> None:
    backend = (settings.storage_backend or "json").lower()
    moved = migrate_mongo() if backend == "mongo" else migrate_json()
    print(f"Migrated {moved} platform hook(s) → connections (backend={backend}).")


if __name__ == "__main__":
    main()
