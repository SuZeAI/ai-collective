# LLM Agent Middleware

The provider's `chat()` does not hand-roll a ReAct loop; it delegates to
LangChain's `create_agent`, and cross-cutting behaviours are expressed as
**middleware**. The stack is assembled in
`build_default_middleware()` (`backend/infrastructure/llm/middleware/builder.py`)
and applied to every agent in every topology. Each component's knobs are
resolved by `get_middleware_config()` (`backend/infrastructure/llm/middleware/config.py`):
the `middleware:` section of `config.yml` (grouped by component) takes
precedence, falling back to the matching `settings.llm.*` field (still backed
by the `LLM_*` env vars below) when a group/key is absent from that section.

Each middleware uses the appropriate hook:

- `awrap_tool_call` — wraps a tool execution (block / cache / time-out / redact).
- `before_model` / `after_model` — runs around the model call (inject context,
  trim history, persist output).

## Stack order

`build_default_middleware()` composes the stack in this order (later items are
inner wrappers for tool calls):

| Order | Middleware | Hook | Gate (default OFF unless noted) |
|------:|-----------|------|--------------------------------|
| 1 | `ModelCallLimitMiddleware` | model | always (caps rounds, forces final answer) |
| 2 | `ToolCallLimitMiddleware` | tool | `LLM_TOOL_CALL_LIMIT > 0` |
| 3 | `GuardrailMiddleware` | tool | when deny tools/patterns configured |
| 4 | `ToolResultCacheMiddleware` | tool | `LLM_TOOL_CACHE_ENABLED` |
| 5 | `LoopDetectionMiddleware` | tool | `LLM_LOOP_DETECTION_ENABLED` (**on**) |
| 6 | `ToolRetryMiddleware` | tool | `LLM_TOOL_RETRY_MAX > 0` (**on**, =2) |
| 7 | `ToolTimeoutMiddleware` | tool | always |
| 8 | `PIIRedactionMiddleware` | tool | `LLM_PII_REDACTION_ENABLED` |
| 9 | `AnthropicPromptCachingMiddleware` | model | `LLM_PROMPT_CACHE_ENABLED` (Anthropic only; no-op elsewhere) |
| 10 | `ModelFallbackMiddleware` | model | `LLM_FALLBACK_MODELS` set |
| 11 | `ModelRetryMiddleware` | model | `LLM_MODEL_RETRY_MAX > 0` |
| 12 | `ContextEditingMiddleware` | model | `LLM_CONTEXT_EDITING_ENABLED` |
| 13 | `SummarizationMiddleware` | model | `LLM_SUMMARIZATION_ENABLED` (LLM-based) |
| 14 | `RollingSummaryMiddleware` | model | `LLM_ROLLING_SUMMARY_ENABLED` |
| 15 | `LongTermMemoryMiddleware` | model | `LLM_LTM_MIDDLEWARE_ENABLED` |
| 16 | `CostBudgetMiddleware` | model | `LLM_RUN_TOKEN_BUDGET > 0` |

**Ordering rationale:** guardrail/PII protect tool execution, the cache serves
before retry/timeout do work, loop-detection → retry → timeout wrap the actual
call, and the model-facing trio (trim → recall → budget) acts around the model.

## Built-in middleware (LangChain)

- **ModelCallLimitMiddleware** — caps model calls per run and ends with a final
  answer (replaces the old `max_tool_rounds` loop).
- **ToolCallLimit / ToolRetry / ModelFallback / ModelRetry** — bound tool calls,
  retry transient failures, fall back across models.
- **ContextEditingMiddleware** — prunes old tool outputs when the input grows
  large.
- **SummarizationMiddleware** — compacts long histories with a dedicated
  summarization model (set `LLM_SUMMARIZATION_MODEL`).
- **AnthropicPromptCachingMiddleware** (from `langchain_anthropic.middleware`) —
  marks the request's system prompt/tools/last-message prefix as cacheable
  (`cache_control: {type: "ephemeral", ttl: LLM_PROMPT_CACHE_TTL}`) so repeat
  model calls that share that prefix — agent-loop rounds, ring/sequential
  topology hops, subagent fan-out, multi-turn meetings — read from Anthropic's
  prompt cache (~0.1× input price) instead of paying full price. Silently
  skipped (not a warning) on every non-Anthropic provider, so it's safe to
  leave enabled regardless of `LLM_PROVIDER`. Caching is a strict prefix
  match: any byte change earlier in the request (a per-run timestamp
  interpolated into the system prompt, a reordered tool list) invalidates the
  cache for everything after it — see Anthropic's prompt-caching docs for the
  full placement/invalidation rules.

## Custom middleware

| Middleware | What it does |
|-----------|--------------|
| **ToolTimeoutMiddleware** | Bounds each tool call to `TOOL_TIMEOUT_SECONDS`; returns a timeout `ToolMessage` instead of hanging. |
| **LoopDetectionMiddleware** | Detects an agent re-issuing the *same* tool call (name + args) `LLM_LOOP_DETECTION_MAX_REPEATS` times and soft-nudges it to change approach or finalize. Stateless (scans `state["messages"]`). |
| **RollingSummaryMiddleware** | LLM-free history compactor: when history exceeds `LLM_ROLLING_SUMMARY_TRIGGER_TOKENS`, folds the oldest messages into one summary `SystemMessage` and removes them (keeping the last N). Pairing-safe — never orphans a `tool_use`/`tool_result`. |
| **LongTermMemoryMiddleware** | Recalls long-term memory for the run scope and injects it before the model; persists the final answer after. See [long-term-memory.md](long-term-memory.md). |
| **ToolResultCacheMiddleware** | Serves an identical idempotent tool call from the run's prior result (keyed by name + canonical args), complementing loop detection. Skips tools on `LLM_TOOL_CACHE_DENY_TOOLS`. |
| **CostBudgetMiddleware** | Soft-stops a run that exceeds `LLM_RUN_TOKEN_BUDGET` by injecting a "finalize now" instruction (a soft cap atop the hard model-call cap). |
| **GuardrailMiddleware** | Blocks a tool call (returns an explanatory `ToolMessage` instead of executing) when the tool is on `LLM_GUARDRAIL_DENY_TOOLS` or its args match `LLM_GUARDRAIL_DENY_PATTERNS`. |
| **PIIRedactionMiddleware** | Redacts emails, card-like digit runs and common secret tokens from tool results before the model sees them. |

## Configuration

Knobs live under `config.yml › middleware` (grouped by component); anything a
group omits falls back to the matching `settings.llm.*` field, still backed by
the `LLM_*` env vars of the same name (e.g. `rolling_summary.enabled` ⇠
`LLM_ROLLING_SUMMARY_ENABLED`). See [configuration.md](configuration.md) for
the full env-var list. All custom additions are **OFF by default**, so enabling
them is opt-in and the baseline behaviour is unchanged.

```yaml
middleware:
  # summarization (LLM-based, built-in)
  summarization:
    enabled: false
  # rolling summary (LLM-free)
  rolling_summary:
    enabled: false
    trigger_tokens: 6000
    keep_messages: 10
  # long-term memory recall/persist
  long_term_memory:
    enabled: false
  # tool result cache
  tool_cache:
    enabled: false
    # deny_tools: send_email,run_shell
  # Anthropic prompt caching (no-op on non-Anthropic providers)
  prompt_cache:
    enabled: false
    ttl: 5m
    min_messages: 0
  # cost guard (0 = off)
  cost_budget:
    run_token_budget: 0
  # guardrail + PII
  pii_redaction:
    enabled: false
  guardrail:
    deny_tools: ""      # run_shell,delete_file
    deny_patterns: ""   # rm -rf,DROP TABLE
```

## Writing a new middleware

Subclass `AgentMiddleware` and implement the relevant hook, then register it
(gated) in `build_default_middleware()`:

```python
class MyMiddleware(AgentMiddleware):
    async def awrap_tool_call(self, request, handler):
        # pre-checks on request.tool_call / request.state["messages"]
        result = await handler(request)
        # post-process result
        return result
```

All middleware are best-effort and must never break a run; follow the existing
classes for the soft-fail conventions.
