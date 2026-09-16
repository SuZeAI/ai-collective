from __future__ import annotations

from server.api.deps._core import SEED_DIR, STORAGE_DIR, _mongo_db, _store
from server.api.settings import settings
from server.share.log import get_logger

# Bundled default catalog shipped in storage/*.json (committed to git), keyed by
# the Mongo collection it feeds. Only these are auto-imported on startup.
# Order matters: staff/skills/departments are seeded before tasks so a seeded task's
# referenced team and staff already exist in the live store.
_DEFAULT_DATA_FILES = (
    ("staff", "staff.json"),
    ("skills", "skills.json"),
    ("departments", "departments.json"),
    ("tasks", "tasks.json"),
)


def _load_seed_records(filename: str) -> list[dict]:
    """Read a default-catalog file from the committed seed dir (storage/)."""
    import json

    path = SEED_DIR / filename
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def seed_default_data() -> None:
    """Seed the bundled default staff/skills/departments/tasks into the live DB on startup.

    The committed catalog lives in the seed dir (``storage/seed/``); the live data
    lives in the local database (Mongo, or JSON files under ``storage/runtime/``).
    This copies any default entity that is missing from the live DB so a fresh
    clone comes up with the starter catalog — without ever touching the seed
    files or clobbering entities already present in the live DB.
    """
    if not settings.seed.default_data:
        return

    try:
        from server.domain.models import DEFAULT_OWNER_ID

        total_inserted = 0

        if settings.storage_backend == "mongo":
            db = _mongo_db()
            for collection, filename in _DEFAULT_DATA_FILES:
                inserted = 0
                for rec in _load_seed_records(filename):
                    doc_id = rec.get("id")
                    if not doc_id:
                        continue
                    if db[collection].find_one({"_id": doc_id}, {"_id": 1}) is not None:
                        continue  # already in the live DB — leave it untouched
                    doc = dict(rec)
                    doc["_id"] = doc_id
                    doc.setdefault("owner_id", DEFAULT_OWNER_ID)
                    db[collection].insert_one(doc)
                    inserted += 1
                if inserted:
                    get_logger().info(f"Seeded {inserted} default {collection} into Mongo")
                total_inserted += inserted
        else:
            # JSON mode: live store is storage/runtime/*.json (≠ the seed dir).
            for collection, filename in _DEFAULT_DATA_FILES:
                seed_records = _load_seed_records(filename)
                if not seed_records:
                    continue
                store = _store(filename)
                live = store.read()
                if not isinstance(live, list):
                    live = []
                existing_ids = {r.get("id") for r in live if isinstance(r, dict)}
                added = 0
                for rec in seed_records:
                    doc_id = rec.get("id")
                    if not doc_id or doc_id in existing_ids:
                        continue
                    rec = dict(rec)
                    rec.setdefault("owner_id", DEFAULT_OWNER_ID)
                    live.append(rec)
                    existing_ids.add(doc_id)
                    added += 1
                if added:
                    store.write(live)
                    get_logger().info(
                        f"Seeded {added} default {collection} into {STORAGE_DIR.name}/{filename}"
                    )
                total_inserted += added

        if total_inserted == 0:
            get_logger().info("Default catalog already present — nothing to seed")
    except Exception as exc:  # never block startup on a seeding error
        get_logger().error(f"Default data seed failed: {exc}")
