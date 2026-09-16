from __future__ import annotations

from typing import Any

import pymongo

from server.domain.models import ModelPricing
from server.domain.pricing_defaults import DEFAULT_MODEL_PRICING


class MongoModelPricingRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["model_pricing"]
        if self._col.count_documents({}) == 0:
            # First run: seed with the known defaults so the admin page has
            # sensible price cards to start from.
            for p in DEFAULT_MODEL_PRICING:
                self.upsert(p)

    def _doc_to_pricing(self, item: dict[str, Any]) -> ModelPricing:
        return ModelPricing(
            model=str(item["model"]),
            provider=str(item.get("provider", "")),
            input_price_per_million=float(item.get("input_price_per_million", 0.0)),
            output_price_per_million=float(item.get("output_price_per_million", 0.0)),
        )

    def list(self) -> list[ModelPricing]:
        return [self._doc_to_pricing(doc) for doc in self._col.find({})]

    def get(self, model: str) -> ModelPricing | None:
        doc = self._col.find_one({"model": model})
        return self._doc_to_pricing(doc) if doc else None

    def upsert(self, pricing: ModelPricing) -> ModelPricing:
        self._col.replace_one(
            {"model": pricing.model},
            {
                "_id": pricing.model,
                "model": pricing.model,
                "provider": pricing.provider,
                "input_price_per_million": pricing.input_price_per_million,
                "output_price_per_million": pricing.output_price_per_million,
            },
            upsert=True,
        )
        return pricing

    def delete(self, model: str) -> None:
        self._col.delete_one({"model": model})
