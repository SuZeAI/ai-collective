from __future__ import annotations

from backend.domain.models import ModelPricing

# Default model pricing (USD per 1M tokens) used to seed the pricing store.
# Admins can edit these from the System Monitoring page; unknown models show
# up as "unpriced" until a price card is added.
DEFAULT_MODEL_PRICING: list[ModelPricing] = [
    # Anthropic
    ModelPricing(model="claude-opus-4-8", provider="anthropic", input_price_per_million=5.00, output_price_per_million=25.00),
    ModelPricing(model="claude-opus-4-6", provider="anthropic", input_price_per_million=5.00, output_price_per_million=25.00),
    ModelPricing(model="claude-sonnet-4-6", provider="anthropic", input_price_per_million=3.00, output_price_per_million=15.00),
    ModelPricing(model="claude-sonnet-4", provider="anthropic", input_price_per_million=3.00, output_price_per_million=15.00),
    ModelPricing(model="claude-haiku-4-5", provider="anthropic", input_price_per_million=1.00, output_price_per_million=5.00),
    # OpenAI
    ModelPricing(model="gpt-4o", provider="openai", input_price_per_million=2.50, output_price_per_million=10.00),
    ModelPricing(model="gpt-4o-mini", provider="openai", input_price_per_million=0.15, output_price_per_million=0.60),
    # Google (paid tier, standard inference; tiered models use the ≤200k-prompt rate)
    ModelPricing(model="gemini-3.5-flash", provider="google", input_price_per_million=1.50, output_price_per_million=9.00),
    ModelPricing(model="gemini-3.1-pro-preview", provider="google", input_price_per_million=2.00, output_price_per_million=12.00),
    ModelPricing(model="gemini-3.1-flash-lite", provider="google", input_price_per_million=0.25, output_price_per_million=1.50),
    ModelPricing(model="gemini-3-flash-preview", provider="google", input_price_per_million=0.50, output_price_per_million=3.00),
    ModelPricing(model="gemini-2.5-pro", provider="google", input_price_per_million=1.25, output_price_per_million=10.00),
    ModelPricing(model="gemini-2.5-flash", provider="google", input_price_per_million=0.30, output_price_per_million=2.50),
    ModelPricing(model="gemini-2.5-flash-lite", provider="google", input_price_per_million=0.10, output_price_per_million=0.40),
    ModelPricing(model="gemini-2.0-flash", provider="google", input_price_per_million=0.10, output_price_per_million=0.40),
    ModelPricing(model="gemini-2.0-flash-lite", provider="google", input_price_per_million=0.075, output_price_per_million=0.30),
]
