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
            try:
                p = ModelPricing(
                    model=str(item["model"]),
                    provider=str(item.get("provider", "")),
                    input_price_per_million=float(item.get("input_price_per_million", 0.0)),
                    output_price_per_million=float(item.get("output_price_per_million", 0.0)),
                )
                self._items[p.model] = p
            except Exception:
                continue
        if not self._items:
            # First run: seed with the known defaults so the admin page has
            # sensible price cards to start from.
            for p in DEFAULT_MODEL_PRICING:
                self._items[p.model] = p
            self._persist()

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "model": p.model,
                    "provider": p.provider,
                    "input_price_per_million": p.input_price_per_million,
                    "output_price_per_million": p.output_price_per_million,
                }
                for p in self._items.values()
            ]
        )

    def list(self) -> list[ModelPricing]:
        with self._lock:
            return list(self._items.values())

    def get(self, model: str) -> ModelPricing | None:
        with self._lock:
            return self._items.get(model)

    def upsert(self, pricing: ModelPricing) -> ModelPricing:
        with self._lock:
            self._items[pricing.model] = pricing
            self._persist()
        return pricing

    def delete(self, model: str) -> None:
        with self._lock:
            self._items.pop(model, None)
            self._persist()
