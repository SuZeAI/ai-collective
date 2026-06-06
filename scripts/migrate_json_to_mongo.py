#!/usr/bin/env python3
"""
Migrate JSON storage → MongoDB + create default user.

Usage:
    python scripts/migrate_json_to_mongo.py

Collections synced:
  agents, skills, teams, workspaces, connections, tasks,
  conversations, activity_feed, analytics (singleton),
  sandbox_threads, graph_knowledge, graph_knowledge_events

The "default" user / owner_id concept:
  - All imported data gets owner_id="default"
  - Future per-user isolation: list() returns own records + default records
  - Existing repositories ignore owner_id for now → all data stays globally visible
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import pymongo
except ImportError:
    print("ERROR: pymongo not installed. Run: pip install pymongo")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin",
)
MONGO_DB = os.environ.get("MONGO_DB", "ai_collective")
STORAGE_DIR = Path(__file__).resolve().parents[1] / "storage"

DEFAULT_USER_ID = "default"
DEFAULT_USER = {
    "_id": DEFAULT_USER_ID,
    "id": DEFAULT_USER_ID,
    "name": "Default (System)",
    "email": "default@system.local",
    "hashed_password": "",
    "role": "system",
    "joined_at": datetime(2024, 1, 1, tzinfo=timezone.utc),
    "avatar": "D",
    "avatar_icon": "layers",
    "avatar_color": "#64748B",
    "avatar_url": "",
    "provider": "system",
    "provider_id": "",
    "is_default": True,
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_json(filename: str):
    path = STORAGE_DIR / filename
    if not path.exists():
        print(f"  [skip] {filename} not found")
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def upsert_many(col, records: list[dict], id_field: str = "id") -> tuple[int, int]:
    inserted = updated = 0
    for rec in records:
        doc_id = rec.get(id_field)
        if not doc_id:
            continue
        rec = dict(rec)
        rec["_id"] = doc_id
        rec["owner_id"] = DEFAULT_USER_ID
        result = col.replace_one({"_id": doc_id}, rec, upsert=True)
        if result.upserted_id is not None:
            inserted += 1
        elif result.modified_count:
            updated += 1
    return inserted, updated


def _report(col_name: str, filename: str, ins: int, upd: int, total: int) -> None:
    unchanged = total - ins - upd
    print(
        f"  {col_name:<22} {filename:<30} "
        f"inserted={ins}, updated={upd}, unchanged={unchanged}"
    )


# ── Standard list-based collections ──────────────────────────────────────────
COLLECTIONS = [
    ("agents",       "agents.json",       "id"),
    ("skills",       "skills.json",       "id"),
    ("teams",        "teams.json",        "id"),
    ("workspaces",   "workspaces.json",   "id"),
    ("connections",  "connections.json",  "id"),
    ("tasks",        "tasks.json",        "id"),
    ("conversations","conversations.json","id"),
    ("activity_feed","activity_feed.json","id"),
    ("sandbox_threads","sandbox_threads.json","thread_id"),
]


def migrate():
    print(f"Connecting to MongoDB: {MONGO_URI[:40]}...")
    client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
    except Exception as e:
        print(f"ERROR: Cannot connect to MongoDB: {e}")
        sys.exit(1)

    db = client[MONGO_DB]
    print(f"Connected. Database: {MONGO_DB}\n")

    total_inserted = total_updated = 0

    # ── 1. Default user ───────────────────────────────────────────────────────
    print("── Default user ─────────────────────────────────────────────────────")
    result = db.users.replace_one({"id": DEFAULT_USER_ID}, DEFAULT_USER, upsert=True)
    status = "created" if result.upserted_id else "exists"
    print(f"  [{status}] id={DEFAULT_USER_ID}  role=system  email=default@system.local")

    # ── 2. Standard list collections ──────────────────────────────────────────
    print("\n── List collections ─────────────────────────────────────────────────")
    for col_name, filename, id_field in COLLECTIONS:
        data = load_json(filename)
        if data is None:
            continue
        records = data if isinstance(data, list) else [data]
        if not records:
            print(f"  {col_name:<22} {filename:<30} (empty)")
            continue
        ins, upd = upsert_many(db[col_name], records, id_field)
        _report(col_name, filename, ins, upd, len(records))
        total_inserted += ins
        total_updated += upd

    # ── 3. Analytics (singleton) ──────────────────────────────────────────────
    print("\n── Analytics (singleton) ────────────────────────────────────────────")
    analytics_data = load_json("analytics.json")
    if analytics_data is not None:
        if isinstance(analytics_data, list):
            analytics_data = analytics_data[0] if analytics_data else {}
        doc = dict(analytics_data)
        doc["_id"] = "singleton"
        doc["owner_id"] = DEFAULT_USER_ID
        result = db.analytics.replace_one({"_id": "singleton"}, doc, upsert=True)
        status = "inserted" if result.upserted_id else ("updated" if result.modified_count else "unchanged")
        print(f"  analytics             analytics.json                 {status}")
        if result.upserted_id:
            total_inserted += 1
        elif result.modified_count:
            total_updated += 1

    # ── 4. Graph knowledge (dict keyed by conversation_id) ────────────────────
    print("\n── Graph knowledge ──────────────────────────────────────────────────")
    gk_data = load_json("graph_knowledge.json")
    if gk_data is not None:
        if isinstance(gk_data, dict):
            records = []
            for conv_id, graph in gk_data.items():
                rec = dict(graph) if isinstance(graph, dict) else {"data": graph}
                rec["conversation_id"] = conv_id
                rec["_id"] = conv_id
                rec["owner_id"] = DEFAULT_USER_ID
                records.append(rec)
        else:
            records = gk_data
        ins = upd = 0
        for rec in records:
            conv_id = rec.get("conversation_id") or rec.get("_id")
            if not conv_id:
                continue
            result = db.graph_knowledge.replace_one(
                {"conversation_id": conv_id}, rec, upsert=True
            )
            if result.upserted_id:
                ins += 1
            elif result.modified_count:
                upd += 1
        _report("graph_knowledge", "graph_knowledge.json", ins, upd, len(records))
        total_inserted += ins
        total_updated += upd

    # ── 5. Graph knowledge events (dict keyed by conversation_id → list) ──────
    gke_data = load_json("graph_knowledge_events.json")
    if gke_data is not None:
        if isinstance(gke_data, dict):
            all_events = []
            for conv_id, events in gke_data.items():
                if not isinstance(events, list):
                    continue
                for ev in events:
                    rec = dict(ev) if isinstance(ev, dict) else {"data": ev}
                    rec["conversation_id"] = conv_id
                    all_events.append(rec)
        else:
            all_events = gke_data if isinstance(gke_data, list) else []

        # Events have no stable id — use upsert by (conversation_id + message_id)
        ins = 0
        for ev in all_events:
            conv_id = ev.get("conversation_id", "")
            msg_id = ev.get("message_id", "")
            ev_type = ev.get("type", "")
            exists = db.graph_knowledge_events.find_one(
                {"conversation_id": conv_id, "message_id": msg_id, "type": ev_type}
            )
            if not exists:
                db.graph_knowledge_events.insert_one(ev)
                ins += 1
        upd = 0
        _report("graph_knowledge_events", "graph_knowledge_events.json", ins, upd, len(all_events))
        total_inserted += ins

    # ── 6. Existing users ─────────────────────────────────────────────────────
    print("\n── Existing users ───────────────────────────────────────────────────")
    users_data = load_json("users.json")
    if users_data is not None:
        users = users_data if isinstance(users_data, list) else [users_data]
        for u in users:
            uid = u.get("id")
            if not uid or uid == DEFAULT_USER_ID:
                continue
            doc = dict(u)
            doc["_id"] = uid
            try:
                result = db.users.replace_one({"id": uid}, doc, upsert=True)
                status = "created" if result.upserted_id else ("updated" if result.modified_count else "exists")
            except pymongo.errors.DuplicateKeyError:
                status = "exists"
            print(f"  [{status}] {u.get('email', uid)}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n── Summary ──────────────────────────────────────────────────────────")
    print(f"  Total inserted : {total_inserted}")
    print(f"  Total updated  : {total_updated}")
    print(f"  All records tagged with owner_id='{DEFAULT_USER_ID}'")
    print(f"\nDone!")


if __name__ == "__main__":
    migrate()
