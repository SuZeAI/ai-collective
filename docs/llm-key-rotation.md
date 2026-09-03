# LLM Key Rotation & Failover

Free and low-tier LLM keys (Google Gemini especially) impose per-key **request**
(RPM) and **token** (TPM) limits. AI Collective can survive these limits two
different ways, selected **per model entry** in `config.yml`'s `models:` list
via that entry's own `failover.strategy` field:

| Strategy | What handles failover | When to use |
|----------|-----------------------|-------------|
| `rotate` *(default)* | **Built-in** multi-key rotation (this doc) | You have several keys for the *same* provider (e.g. 4 Gemini keys). |
| `9router` | The external [9Router](9router-setup.md) gateway (aliases: `router`, `nine-router`, `off`, `none` — all disable local rotation) | You want cross-provider routing/fallback and token compression. |

The two are **mutually exclusive per model entry**. They are also different
from the `open_weight` model entry (`OPENROUTER_API_KEY`), which is just a key
for [openrouter.ai](https://openrouter.ai) — not a failover strategy. 9router
is **not** openrouter.ai.

```
rotate :  backend ──► [ key#1, key#2, key#3, key#4 ]  (one provider, many keys)
9router:  backend ──(OpenAI-compatible API)──► 9Router :20128 ──► Claude / OpenAI / Gemini / …
```

---

## How `rotate` works

List **several keys** in a model entry's `api_key` field, comma- or
whitespace-separated:

```yaml
# config.yml
models:
  - name: gemini
    provider_name: Google
    model: gemini-3-flash-preview
    api_key: $GOOGLE_API_KEY   # GOOGLE_API_KEY=AIzaKeyOne,AIzaKeyTwo,AIzaKeyThree,AIzaKeyFour in .env
    enabled: true
    failover:
      strategy: rotate
      rotate_max_requests_per_min: 0
      rotate_max_tokens_per_min: 0
      key_cooldown_seconds: 60
```

A pool of equivalent chat models — one per key — is built, and the LLM layer
switches keys in two complementary ways:

- **Reactive** — when the active key returns a rate-limit / quota (HTTP 429),
  invalid-key (401/403), or transient server (5xx / overloaded) error, the call
  transparently fails over to the next key and the failed key is put on a short
  **cooldown** (`failover.key_cooldown_seconds`, default 60s) so the next request skips it.
- **Proactive** — each key keeps a rolling **60-second window** of its own request
  count and token usage. Before a key would cross its configured per-minute
  **RPM** or **TPM** budget, it is skipped and the next key is used — so the
  provider's *hard* limit is never reached in the first place. This spreads load
  across keys and is what avoids "context / requests per minute too high" errors.

A single key (or `failover.strategy` ≠ `rotate`) adds **zero overhead** — the
bare model is used exactly as before.

### `failover:` block fields (per `models:` entry)

| Field | Default | Description |
|-------|---------|-------------|
| `strategy` | `rotate` | `rotate` \| `9router` (aliases: `router`, `nine-router`, `off`, `none`) |
| `rotate_max_requests_per_min` | `0` | Proactive **RPM budget per key**. `0` = unlimited (reactive-only). |
| `rotate_max_tokens_per_min` | `0` | Proactive **TPM budget per key**. `0` = unlimited (reactive-only). |
| `key_cooldown_seconds` | `60` | How long an errored key is skipped before being retried. |

> Set the budgets **at or just below** your provider tier's published limits.
> For the Gemini free tier (~15 RPM, ~1M TPM per key) a safe config is:
> ```yaml
> failover:
>   rotate_max_requests_per_min: 14
>   rotate_max_tokens_per_min: 950000
> ```
> Leave them at `0` to rotate **only on errors** (reactive), which still avoids
> hard failures but does not pre-emptively spread load.

### Selection order

On every call the rotator tries keys in this preference order:

1. Keys that are **neither** cooling down **nor** over their RPM/TPM budget (current key first — "sticky" so load isn't fragmented).
2. If all are over budget: any key **not** currently cooling down (exceeding a soft budget beats hitting a hard error).
3. If all are cooling down: the key whose cooldown expires **soonest** (trying something beats failing).

If every key in the pool errors on a single call, the last error is raised.

---

## Behaviour & scope

- Rotation lives at the **chat-model** level (`RotatingChatModel`), so it covers **both** call paths:
  `LangChainLLMProvider.chat()` (the multi-agent loop, via `bind_tools().ainvoke()`) **and**
  `LLMProvider.get_chat_model()` (office-builder streaming, token-budget probing).
- Token usage is read from each response's `usage_metadata` / `response_metadata`,
  so TPM accounting reflects real consumption. The admin **usage/monitoring** page
  keeps working — the tracking callback is fanned out to every key in the pool.
- Rotation is **per model entry**: it cycles keys for that entry's own configured
  keys only. It does **not** fail over from, say, the `gemini` entry to the
  `claude` entry. For cross-provider fallback, use the [9Router](9router-setup.md)
  strategy instead.
- Keys are de-duplicated; surrounding whitespace is trimmed.

---

## Choosing between `rotate` and `9router`

| | `rotate` | `9router` |
|--|----------|-----------|
| Setup | Add keys to a model entry's `api_key` in `config.yml`/`.env` | Run a container + dashboard config |
| Failover scope | Many keys, **one** provider | **Many providers** + fallback chains |
| Token compression | No | Yes (~20–40%) |
| External dependency | None | The 9Router service |
| Best for | Stretching free/low-tier quotas | Production multi-provider routing |

To switch a model entry to the gateway, set its `failover.strategy: 9router` in
`config.yml`, point it at the gateway (`provider_name: openai` +
`base_url: http://nine-router:20128/v1` + the dashboard key), and follow
[9router-setup.md](9router-setup.md).

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Still hitting 429s | Set `rotate_max_requests_per_min` / `rotate_max_tokens_per_min` below your tier limits; add more keys. |
| Only one key ever used | Only one key supplied, or `failover.strategy` ≠ `rotate`. Check the startup log line "LLM key rotation enabled across N keys". |
| A bad key keeps being tried | It is retried after `key_cooldown_seconds`; raise the cooldown, or remove the dead key. |
| Want cross-provider fallback | Use `9router` — `rotate` cycles keys within a single model entry only. |

## References

- Full env reference: [configuration.md](configuration.md#llm-providers)
- 9Router gateway: [9router-setup.md](9router-setup.md)
- Implementation: `backend/infra/llm/providers/rotation.py`
