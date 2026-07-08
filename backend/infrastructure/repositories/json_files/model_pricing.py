from __future__ import annotations

import threading

from backend.domain.models import ModelPricing
from backend.domain.pricing_defaults import DEFAULT_MODEL_PRICING
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonModelPricingRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, ModelPricing] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.model] = parsed
        if not self._items:
            # First run: seed with the known defaults so the admin page has
            # sensible price cards to start from. A concurrent first-boot seed
            # race across instances is possible but harmless here (both would
            # write the same default set); real upserts/deletes below go
            # through the merge-safe path.
            for p in DEFAULT_MODEL_PRICING:
                self._items[p.model] = p
            self._store.write([self._serialize_item(p) for p in self._items.values()])

    @staticmethod
    def _parse_item(item: dict) -> ModelPricing | None:
        try:
            return ModelPricing(
                model=str(item["model"]),
                provider=str(item.get("provider", "")),
                input_price_per_million=float(item.get("input_price_per_million", 0.0)),
                output_price_per_million=float(item.get("output_price_per_million", 0.0)),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(p: ModelPricing) -> dict:
        return {
            "model": p.model,
            "provider": p.provider,
            "input_price_per_million": p.input_price_per_million,
            "output_price_per_million": p.output_price_per_million,
        }

    def list(self) -> list[ModelPricing]:
        with self._lock:
            return list(self._items.values())

    def get(self, model: str) -> ModelPricing | None:
        with self._lock:
            return self._items.get(model)

    def upsert(self, pricing: ModelPricing) -> ModelPricing:
        with self._lock:
            self._items = self._merge_and_persist({pricing.model: pricing}, remove_ids=())
        return pricing

    def delete(self, model: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(model,))

    def _merge_and_persist(
        self, upserts: dict[str, ModelPricing], remove_ids: tuple[str, ...]
    ) -> dict[str, ModelPricing]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["model"]): d for d in raw_items if isinstance(d, dict) and "model" in d}
            for model in remove_ids:
                merged.pop(model, None)
            for model, pricing in upserts.items():
                merged[model] = self._serialize_item(pricing)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, ModelPricing] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.model] = parsed
        return result
