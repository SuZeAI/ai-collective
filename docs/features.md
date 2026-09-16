# AI Collective — Feature Catalog

A complete, code-verified inventory of what the platform does today: every backend router and
its endpoints, paired with the frontend page that exposes it. This is a **feature reference**,
not an architecture doc — see [architecture.md](architecture.md) for layering and
[api-reference.md](api-reference.md) for the full REST surface grouped by router. Where a deep
dive already exists (orchestration, memory, sandbox, security, streaming), this doc links to it
instead of repeating it.

Terminology used throughout (already renamed across the codebase): **Agent → Staff, Team →
Department, Workspace → Company, Conversation → Meeting, Marketplace → Recruiting**.

Findings marked **⚠** are gaps or partially-implemented surfaces discovered while auditing the
code — called out explicitly rather than glossed over. See [§24 Known Gaps](#24-known-gaps--partial-features)
for the consolidated list.

## Contents

1. [Core Navigation Scope](#1-core-navigation-scope)
2. [Companies](#2-companies)
3. [Staff](#3-staff)
4. [Departments](#4-departments)
5. [Recruiting](#5-recruiting-shared-catalog)
6. [Meetings](#6-meetings)
7. [Office Builder, Virtual Office & Simulations](#7-office-builder-virtual-office--simulations)
8. [Tasks](#8-tasks)
9. [Projects, Epics & Sprints](#9-projects-epics--sprints)
10. [Planner](#10-planner)
11. [Activity Feed](#11-activity-feed)
12. [Analytics](#12-analytics)
13. [Consumption & Cost Tracking](#13-consumption--cost-tracking)
14. [Dashboard / Reports / Roadmap](#14-dashboard--reports--roadmap)
15. [Document Library](#15-document-library)
16. [Skills & Tools (incl. MCP)](#16-skills--tools-incl-mcp)
17. [Connections & Webhooks](#17-connections--webhooks)
18. [Auth & Accounts](#18-auth--accounts)
19. [LLM / Model Management](#19-llm--model-management)
20. [Admin Monitoring](#20-admin-monitoring)
21. [Playground & Settings](#21-playground--settings)
22. [Health](#22-health)
23. [Internationalization](#23-internationalization)
24. [Known Gaps / Partial Features](#24-known-gaps--partial-features)
25. [Cross-Cutting Systems](#25-cross-cutting-systems)

---

## 1. Core Navigation Scope

Two navigation scopes, switched client-side only (no backend scope param) via
`useCompanyScope()` / `localStorage.activeCompanyId`:

- **"All" (Overall)** — sentinel `__overall__`; admins see/manage everything across all companies,
  plus an admin-only **Catalog** group (shared "default" templates that every company's Recruiting
  Hub copies from).
- **Inside a Company** — one Company's Departments/Staff/Skills/Projects/Documents/Connections,
  filtered client-side from the full list the backend returns for the caller.

Full nav map, company types, and scope rules: [company-model.md](company-model.md),
[dashboard-navigation.md](dashboard-navigation.md).

## 2. Companies

A **Company** (`server/domain/models.py`) is a virtual organization: `id, name, description,
department_ids, type (software|marketing|research|general, unenforced server-side), owner_id`.

- **Create/upsert** (`POST /companies`): new id → `ws_{uuid}`; existing id preserves
  `created_at`/`owner_id`. **Claim-or-clone** on `department_ids` — a department already owned by
  the target company is kept, one still in the shared catalog is claimed in place, one owned by a
  *different* company is cloned with a new id. This is what prevents cross-company sharing of
  Department/Staff/Skill records.
- **Delete** (`DELETE /companies/{id}`): two-phase — `GET /companies/{id}/impact` previews the
  cascade, then delete cascades (best-effort) to exclusive departments/staff/skills/tasks/library
  documents. Departments still referenced by another company are kept, not deleted. Office
  Builder sessions and historical token-usage records are never deleted.
- **Scoped per-company**: Department, Staff, Skill, Project, LibraryDocument, inbound-webhook
  Connections (each carries `company_id`).
- **Shared under "default"**: catalog templates (`owner_id="default"`, `company_id="__default__"`),
  account-level outbound Connections (`company_id=""`), token usage records (never company-scoped,
  survive company deletion).

**Endpoints** (`server/api/routers/companies.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/companies` | List companies visible to caller |
| POST | `/companies` | Create/upsert (claim-or-clone departments) |
| GET | `/companies/{id}` | Fetch one |
| GET | `/companies/{id}/impact` | Preview cascade-delete impact |
| DELETE | `/companies/{id}` | Delete + cascade |
| GET | `/companies/platforms` | List third-party platform integration definitions |

## 3. Staff

A **Staff** (`server/domain/models.py`) is an AI persona: `id, name, role, description,
skill_ids, status (active|idle|archived), system_prompt` (auto-generated from name/role/
description if left blank), `subagent_enabled`. There is **no per-staff LLM/model field** — the
provider is injected app-wide at run time (see [§19](#19-llm--model-management)).

### Topologies

Selected per-Department via `mode`, implemented in `server/domain/staff/`:

| Mode | File | How staff collaborate |
|---|---|---|
| `sequential` | `langgraph_orchestrator.py` | Linear chain; each staff sees only the prior staff's output — lowest context overhead |
| `ring` | `langgraph_ring.py` | Circular turn order until `max_rounds`; shared history with an 8-message rolling window |
| `supervisor` | `langgraph_supervisor.py` | First staff is lead, delegates via `<DELEGATE_TO>`/`<TASK>` tags or finishes via `<FINAL_ANSWER>`; workers always report to lead; parallel fan-out via `<FANOUT>` (up to 8 concurrent) |
| `tree` | `langgraph_tree.py` | Binary tree (child = `2i+1`/`2i+2`); `<DELEGATE_DOWN>`/`<RETURN_TO_ROOT>`/`<TREE_END>` tags; leaves always report to root |
| `mesh` | `langgraph_mesh.py` | Hub + spokes, any-to-any via `<NEXT_AGENT>` tag (falls back to round-robin); each staff sees last 3–5 messages from others |
| `custom` | `langgraph_custom.py` | User-drawn DAG (`CustomGraphSpec` from a React Flow editor); multi-in nodes merge via shared working memory, multi-out nodes fan out in parallel; no edges → falls back to sequential |

**Subagents** (`server/domain/staff/subagents.py`) are not persistent Staff — a recursive
tool-calling loop spawned when a staff (with `subagent_enabled=True`, which turns on
`parallel_tools`) invokes the `task` tool. Three built-in types (`general-purpose`, `research`,
`coding`), each capped at 6 turns with an allowlisted tool set and no access to the `task` tool
itself (prevents infinite nesting).

**Run/stream/restart**: execution is driven by `POST /llm/staff-graph/run-stream` (SSE), keyed by
`meeting_id == task_id` — see [§8 Tasks](#8-tasks) for the restart/history semantics and
[streaming-guide.md](streaming-guide.md) for the SSE event catalog. Full reliability details:
[agent-orchestration.md](agent-orchestration.md).

**Endpoints** (`server/api/routers/staff.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/staff` | List staff (company/visibility filtered) |
| POST | `/staff` | Create/upsert (name, role, skills, prompt, subagent flag) |
| GET | `/staff/{id}/impact` | Preview cascade-delete impact |
| DELETE | `/staff/{id}` | Delete + cascade |

## 4. Departments

A **Department** groups staff under one topology: `id, name, staff (ids), active_tasks, mode,
max_steps (1–10), flow` (React Flow graph, only used when `mode="custom"`).

- Topology is a single field at department granularity — every staff in the department runs
  under the same mode.
- No uniqueness constraint on staff membership across departments.
- On creation with staff, `activate_department_staff()` flips roster status to `active` and
  `seed_department_kickoff_messages()` writes 3 scripted kickoff messages to bootstrap a visible
  conversation. No explicit deactivation path exists.
- `DepartmentBuilder.tsx` has an in-place **Test** flow (`DepartmentTestDialog`) that streams a
  sample prompt through the configured topology without creating a real Task.

**Endpoints** (`server/api/routers/departments.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/departments` | List, optional `company_id` filter |
| POST | `/departments` | Create/upsert (activates staff + seeds kickoff messages on new dept) |
| GET | `/departments/{id}/impact` | Preview which companies are affected by delete |
| DELETE | `/departments/{id}` | Delete + cascade-update referencing companies |

## 5. Recruiting (Shared Catalog)

Copies items from the shared catalog (`owner_id="default"`, `company_id="__default__"`) into the
caller's own scope, always as an **independent, fully-detached copy** with fresh ids — editing
the copy never touches the original.

- **Skill**: new id, config shallow-copied.
- **Staff**: new id, `skill_ids` deep-cloned, `status` reset to idle; dangling skill refs are
  skipped, not errored.
- **Department**: new id, `staff` list deep-cloned, `active_tasks` reset to 0, attached to the
  target company.
- **Task**: department/staff deep-cloned only if catalog-owned; `status`→pending, timestamps
  cleared.
- **Project**: full cascading copy of its Epics/Sprints/Tasks with id-remapping; `key` deduped
  per owner (`NUC` → `NUC2` → `NUC3`...) — the only dedup logic in the service.
- **Document**: file bytes re-fetched and recreated in the target company's library; both source
  and destination require a `company_id`.

**Endpoints** (`server/api/routers/recruiting.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/recruiting/skills` \| `/staff` \| `/departments` \| `/tasks` \| `/projects` \| `/documents` | List that catalog kind |
| POST | `/recruiting/copy` | Copy one catalog item into the caller's scope |

## 6. Meetings

There is no dedicated `Meeting` entity — a meeting is the conceptual conversation-log container
for a **Task**, 1:1 keyed by `task_id`/`meeting_id`. Messages: `id, staff_id, content, timestamp,
task_id`.

- `GET /meetings` filters out system divider messages (`staff_id="system"`) from the default
  list view.
- Live streaming happens on a separate endpoint (`POST /llm/staff-graph/run-stream`, SSE) — the
  Meetings page itself is a historical, fetch-once log; live view is owned by `RunEngineContext`.
- File attachments live in the task's sandbox workspace: upload (25 MB cap, text/json/pdf/images/
  office docs only, no executables), list, and download by `rel_path` confined to `uploads/`.

**Endpoints** (`server/api/routers/meetings.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/meetings` | List messages, optional `task_id` filter |
| POST | `/meetings` | Append a message |
| GET | `/meetings/{task_id}/files` | List attached files |
| POST | `/meetings/{task_id}/files` | Upload a file into the sandbox workspace |
| GET | `/meetings/{task_id}/files/download` | Download a file |

## 7. Office Builder, Virtual Office & Simulations

- **Office Builder** — a conversational, AI-assisted wizard that scaffolds a brand-new Company.
  The user chats a description; `POST /office-builder/plan` (or streaming `/plan-stream`)
  returns an LLM-generated `OfficePlan` (Departments → Staff → Skills hierarchy), refinable via
  follow-up messages. Draft sessions (chat + plan) persist so drafting can resume later.
  `POST /office-builder/apply` materializes the plan: creates the Company, reuses/clones Skills
  and Staff per department (cloning catalog templates where applicable), creates Departments,
  activates staff, and seeds kickoff messages (same activation path as §4).
- **Simulations** — `POST /simulations/plan` generates an ordered list of `SimulationStep`s
  (`staff, msg, delay_ms, phase 1–4`) for a task description, via LLM or a hardcoded 10-step
  fallback if no LLM is configured. These steps are **purely presentational choreography** for
  the Virtual Office animation — they do not themselves drive real LLM calls; actual execution
  is the independent staff-graph run.
- **Virtual Office** — 2D floor-plan visualization: staff avatars positioned at desks/meeting
  room/coffee room/collaboration zone based on live status (`idle`/`thinking`/`collaborating`/
  `coffee`), driven by `RunEngineContext` SSE events, with speech bubbles and flying-document
  hand-off animations.

**Endpoints**

| Router | Method | Path | Purpose |
|---|---|---|---|
| `office_builder.py` | POST | `/office-builder/plan` | Generate a plan from chat |
| | POST | `/office-builder/plan-stream` | Same, SSE-streamed |
| | POST | `/office-builder/apply` | Materialize plan → Company + Departments + Staff + Skills |
| | GET/POST/DELETE | `/office-builder/sessions[/{id}]` | Manage draft sessions |
| `simulations.py` | POST | `/simulations/plan` | Generate SimulationSteps for Virtual Office animation |

## 8. Tasks

A **Task** is the Kanban "issue" — Jira-style fields folded into one entity so the run
engine/queue/registry code only deals with one type.

- **Status lifecycle**: `pending → in-progress → in-review → completed`, plus `paused`/`stopped`
  interrupts. All transitions go through the single upsert endpoint (`POST /tasks`).
- **Assignment**: `department_id` and/or `assigned_staff` (list) and/or a single `assignee_id`.
- **Restart** (`completed`/`stopped` → `in-progress`): does **not** wipe history. Progress resets
  to 0, `start_time`/`end_time` reset, and a system divider message
  (`"— New session started {timestamp} —"`) is appended so the model reads it as a continuation.
  Resuming `paused → in-progress` preserves the original `start_time` instead.
- **`DELETE /tasks/{id}/history`** is the explicit full wipe (owner/admin-gated): deletes all
  meeting messages, resets the graph-context snapshot, deletes working memory — distinct from
  restart.
- **Execution is decoupled from this router** — `POST /tasks` only persists state; the actual
  run is `POST /llm/staff-graph/run-stream`, which owns the live SSE handle keyed by
  `meeting_id == task_id`.
- Every upsert/delete recomputes `department.active_tasks` and flips staff `status` between
  `active`/`idle`.
- Shared "default" tasks are view-only for regular users — status changes are admin-gated.
- Jira-hierarchy fields: `project_id, epic_id, sprint_id, issue_type (epic|story|task|bug|
  subtask), story_points, issue_key` (e.g. `NUC-42`, allocated once from the parent Project's
  counter, immutable after).

```
Task lifecycle
├─ POST /tasks (status → in-progress)
│  ├─ resume from paused        → keep start_time, keep progress
│  └─ restart from completed/stopped
│     ├─ reset progress = 0, fresh start_time
│     └─ append system divider message to meeting history
├─ POST /llm/staff-graph/run-stream   (actual execution, SSE, keyed by meeting_id)
│  └─ selected topology's run()/run_stream() drives Staff turns
└─ DELETE /tasks/{id}/history          (explicit full wipe, not part of restart)
   ├─ delete all meeting messages
   ├─ reset graph-context snapshot
   └─ delete working memory
```

**Endpoints** (`server/api/routers/tasks.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks/queue/status` | Live queue state (running/waiting ids, concurrency limits) |
| GET | `/tasks` | List tasks visible to caller |
| POST | `/tasks` | Create/update (drives status transitions, restart/resume, Jira fields) |
| DELETE | `/tasks/{id}` | Delete + meeting messages + sandbox cleanup + resync dept/staff state |
| DELETE | `/tasks/{id}/history` | Wipe meeting history + graph context + working memory |
| GET | `/tasks/{id}/graph-context` | Read the task's knowledge-graph snapshot |

## 9. Projects, Epics & Sprints

Jira-like hierarchy: **Project** (key namespace, e.g. `NUC`) → **Epic**/**Sprint** (both scoped
to one project) → **Task**.

- **Project**: `key` (unique, uppercase, enforced at upsert — 409 on collision within visible
  scope), `lead_id`, `planner_staff_id` + `planner_system_prompt` (drives the AI Planner persona,
  §10), `issue_counter` (server-owned, monotonic), `company_id`.
- **Epic**: `project_id, key` (shares the project's counter), `title, status` (reuses
  `TaskStatus`), `color`, `start_date`/`due_date` (used by the Roadmap timeline).
- **Sprint**: `project_id, name, goal, status (planned|active|completed), start_date/end_date`.
- **Cascade delete**: deleting a Project removes all its Tasks/Epics/Sprints (best-effort,
  reports `removed_tasks`/`removed_epics`/`removed_sprints` counts).
- **Backlog** (`Backlog.tsx`): sprint sections + an unsprinted "Backlog" bucket; inline epic/
  sprint creation, manual issue creation, drag issues between sprints, and one-click invocation
  of the AI Planner to bulk-generate issues into an epic/sprint.

**Endpoints**

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/projects` | List (optional `company_id`) / create-upsert (unique key enforced) |
| DELETE | `/projects/{id}` | Delete, cascading to tasks/epics/sprints |
| GET/POST/DELETE | `/epics` \| `/epics/{id}` | List / upsert (auto-allocates `NUC-N` key) / delete |
| GET/POST/DELETE | `/sprints` \| `/sprints/{id}` | List / upsert / delete |

## 10. Planner

AI-assisted **backlog decomposition** — turns a free-text description into a batch of draft
issues for the user to review before committing. It does **not** do sprint planning, staff
suggestion, scheduling, or effort estimation beyond story points (verified by reading the full
router — no such logic exists).

- **`POST /planner/decompose`**: `{projectId, description, count, epicId?}` → builds a system
  prompt from the Project's `planner_system_prompt` override, or the assigned
  `planner_staff_id`'s prompt/description, or a generic "expert technical project planner"
  fallback; calls the LLM for structured JSON; clamps `count` to 1–30, coerces unknown
  `issue_type` to `task`. Returns drafts **without persisting anything**.
- **`POST /planner/commit`**: persists the (possibly edited) draft list as real Tasks —
  allocates real `issue_key`s via the project's counter, sets `status=pending`,
  `priority=medium`, no `assigned_staff`.
- Requires an LLM provider configured (503 otherwise).

**Endpoints** (`server/api/routers/planner.py`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/planner/decompose` | LLM-decompose a description into draft issues (not persisted) |
| POST | `/planner/commit` | Persist a draft list as real Tasks under a project/epic/sprint |

## 11. Activity Feed

⚠ **Read-only surface with no active producer.** `ActivityFeedItem` (`id, staff_id, action,
time` — `time` is a free-text string, not a real timestamp type) has only a list endpoint.
`ActivityFeedService.add_item()` exists but no router or event handler calls it anywhere in the
codebase, and nothing seeds initial items. In practice the feed is empty by default on every
install unless something writes to storage directly. `Dashboard.tsx` renders whatever comes back
with an explicit empty state.

**Endpoints** (`server/api/routers/activity_feed.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/activity-feed` | List items, scoped to staff visible to the caller (no create/delete endpoint) |

## 12. Analytics

⚠ **Half live, half static.** `GET /analytics` returns a single `Analytics` object (not a
time-series):

- `tasks_completed`, `avg_completion_time` — computed live per request, scoped to the caller's
  own tasks.
- `department_efficiency`, `staff_productivity` — read verbatim from a **global singleton**
  document that nothing in the codebase ever writes (no seed, no service call) — starts at
  `0`/`{}` and is identical for every user unless hand-edited in storage.
- `AnalyticsPage.tsx` knows this: inside a company scope it discards the backend's
  `departmentEfficiency`/`tasksCompleted`/`avgCompletionTime` and recomputes them client-side
  from the company's own task list; it only trusts the backend payload in "Overall" scope. Other
  cards (status breakdown, active-department count) are computed entirely client-side.

**Endpoints** (`server/api/routers/analytics.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/analytics` | Aggregate: live task stats (owner-scoped) + static department/staff stats (unpopulated singleton) |

## 13. Consumption & Cost Tracking

- `TokenUsageRecord`: one LLM call's usage — `provider, model, input/output/total_tokens,
  user_id` (real user or `"system"`), `timestamp, staff_name, department_id` (attribution, empty
  if unattributed), `cache_read_tokens`/`cache_creation_tokens`.
- `ModelPricing`: admin-editable `$/1M tokens` in/out; cost = tokens/1e6 × price; records for an
  unpriced model contribute `cost=None`.
- **`GET /consumption`** (any authenticated user, own data only): filters to `user_id==caller`,
  optional `company_id` narrows to that company's departments; returns totals + breakdowns by
  department/staff/user + a zero-filled daily series (default 30 days, 1–365 range).
- Global (all-user) usage, pricing CRUD, and active-model switching live in
  [§20 Admin Monitoring](#20-admin-monitoring), not here — same `MonitoringService`, different
  router/authorization level.

**Endpoints** (`server/api/routers/consumption.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/consumption?days=&company_id=` | Caller's own usage, broken down by department/staff/user/day |

## 14. Dashboard / Reports / Roadmap

⚠ **No dedicated backend endpoints** — all three are frontend-only composite views (verified: no
`/reports` or `/roadmap` backend path exists anywhere).

- **Dashboard** (`Dashboard.tsx`): fires `listStaff`/`getAnalytics`/`listActivityFeed`/
  `listTasks`/`listCompanies`/`listDepartments` in parallel and derives KPI cards + per-company
  stat rollups client-side.
- **Reports** (`Reports.tsx`, per-project): calls only `listSprints`+`listTasks`; computes
  status-breakdown, issue-type counts, and velocity-by-sprint client-side.
- **Roadmap** (`Roadmap.tsx`, per-project): calls only `listEpics`+`listTasks`; renders a
  Gantt-style epic timeline (bars from `start_date`/`due_date`, 90-day default window,
  "today" marker, per-epic progress %, overdue detection) entirely client-side.

Both Reports and Roadmap are fully functional, just not backed by server-side aggregation
(unlike Consumption/Analytics).

## 15. Document Library

Per-**Company** file storage (not per-department), path-traversal-guarded, filtered by
`owner_id` and optional `company_id`.

- Direct upload, URL ingestion (fetches a page, strips HTML, stores as `.md`), download, owner-
  only delete, and **attach to a Task** — copies the doc's bytes into that task's meeting sandbox
  `uploads/` dir so a running Staff can read it via tools.
- ⚠ **No RAG/embedding ingestion for library docs** — the only path from library → running Staff
  is the explicit attach action; after that, Staff read the file via tool calls during the run,
  not automatic retrieval.
- **DocumentToolkit** (`server/domain/tools/document_tools.py`, tool name `documents`) operates
  on the meeting sandbox, not the library directly: `document_extract_text` (pdf/docx/xlsx/csv/
  tsv/txt/md/json/log), `document_read_table` (xlsx/csv → markdown table), `document_fetch_url`
  (SSRF-protected), `document_describe_image` (vision-LLM description + dimensions). Parser
  libraries import lazily; a missing package produces a readable error, not a crash.
  Full details: [document-library-and-file-storage.md context — see architecture.md].
- **Local vs S3**: `storage.file_backend` config wins if set; else auto-selects `s3` if
  `minio.enabled`, else `local`. Writes always hit the host cache; `s3` mode also mirrors to
  MinIO, and reads fall back to S3 + repopulate the host cache — restores files across container/
  host restarts.
- **Upload rules** (shared with Meetings): MIME allow-list, 25 MB cap, filename sanitized against
  path traversal. No virus scanning.

**Endpoints** (`server/api/routers/documents.py`, prefix `/library`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/documents` | List, optional `company_id` filter |
| POST | `/documents` | Upload (multipart) |
| POST | `/documents/ingest-url` | Fetch a URL → store as `.md` |
| GET | `/documents/{id}/download` | Stream file bytes |
| POST | `/documents/{id}/attach` | Copy into a task's meeting sandbox `uploads/` |
| DELETE | `/documents/{id}` | Owner-only delete |

## 16. Skills & Tools (incl. MCP)

A **Skill** (`id, name, description, kind` [`integration`|`custom-js`], `config, tool_name, code,
instruction`) is the unit that attaches a capability to Staff via `Staff.skill_ids`.

- **47 built-in tool types** (`server/domain/tools/tool_registry.py`): core (`bash`, `sandbox`,
  `documents`, `browser`, `http`, `websearch`, `brave_search`); agent protocols (`mcp`, `a2a`);
  search/data (`parallel_search`, `openrouter_search`, `hackernews`, `polymarket`, `bluesky`,
  `reddit`, `reddit_enrich`, `xiaohongshu`, `truthsocial`, `tiktok`, `youtube`, `instagram`,
  `scrapecreators_x`, `xai`); Google Workspace (`sheet`, `drive`, `docs`, `slides`, `calendar`);
  16 messaging platforms (Telegram, Discord, Slack, Teams, WhatsApp, Messenger, Instagram, LINE,
  Viber, Zalo, Signal, Skype, Wire, WeChat, Snapchat); generation (`image_generation`,
  `text_to_speech`, `video_generation`, Gemini image/tts/video variants).
- **Credential config**: DB-stored `config` dict, UI form driven by
  `SkillToolPresetSchema.config_fields`. Secret masking on read (keys matching
  key/secret/token/password/credential), preserved from storage on save unless changed.
- **MCP as a skill** (`tool_name="mcp"`): `transport` (`stdio`/`streamable_http`/`sse`),
  `command`+`args`+`env` or `url`+`headers`, `allowed_tools` whitelist, `timeout_seconds`. Tool
  discovery happens once at bind time; each call opens a fresh session. Full guide:
  [mcp-guide.md](mcp-guide.md).
- No generic "test connection" endpoint exists — only the Google Workspace tool family gets an
  OAuth status-poll flow ([§18](#18-auth--accounts)).

**Endpoints** (`server/api/routers/skills.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/skills` | List, filterable by `company_id` |
| GET | `/skills/tools` | List all built-in tool type names |
| GET | `/skills/tool-presets` | UI presets (label + config field schema) per tool |
| POST | `/skills` | Upsert (secret-preserving merge) |
| GET | `/skills/{id}/impact` | Preview staff/companies affected by delete |
| DELETE | `/skills/{id}` | Delete with cascade |

## 17. Connections & Webhooks

Unified `Connection` model (`kind="inbound_webhook"` = former PlatformHook, `kind="outbound"` =
former ThirdPartyConnection): `id, platform, name, config, enabled, company_id` (`""` = global),
plus inbound-only `routing_department_id`/`routing_staff_ids`.

- **15 supported inbound platforms**: telegram, discord, slack, teams, whatsapp_business,
  facebook_messenger, instagram, line_messaging, viber_messaging, zalo_messaging,
  signal_messaging, skype_messaging, wire_messaging, wechat_messaging, snapchat_messaging.
- **Signature verification, per platform, opt-in**: Slack (HMAC-SHA256 + 5-min replay window),
  LINE (base64 HMAC-SHA256), WhatsApp/Messenger/Instagram (shared Meta `X-Hub-Signature-256`),
  Discord (Ed25519), Teams/Skype (Bearer JWT), Wire (pre-shared secret header). All comparisons
  constant-time; failure → HTTP 403.
- ⚠ **Telegram/Zalo/Viber/Signal/WeChat have no per-message verification** — always accepted.
  WeChat's SHA1(sorted token/timestamp/nonce) check only guards the one-time GET setup handshake
  (`get_verification_response`); `WeChatHookProcessor` never overrides `verify_request`, so every
  inbound POST message is accepted via `BaseHookProcessor`'s default (`return True`) with no
  signature check at all. Confirmed by `test_wechat_verify_request_has_no_real_signature_check_yet`
  in `test/unit/test_third_party_hooks.py`.
- **Routing priority** for an inbound message: `routing_staff_ids` → `routing_department_id` →
  company's primary/first department.
- Secrets masked/preserved the same way as Skills config. Full security model:
  [security.md](security.md), [webhooks.md](webhooks.md).

**Endpoints**

| Router | Method | Path | Purpose |
|---|---|---|---|
| `connections.py` (admin-only) | GET/POST/DELETE | `/connections[/{id}]` | List/upsert/delete |
| `webhook.py` (public, platform-facing) | GET | `/webhook/{platform}/{company_id}/{hook_id}` | Verification handshake (Meta/WeChat) |
| | POST | `/webhook/{platform}/{company_id}/{hook_id}` | Receive message → verify signature → dispatch to staff graph |

## 18. Auth & Accounts

Three surfaces under `/auth`:

- **Local JWT** (`auth.py`): register, login, `GET /auth/me`, `PATCH /auth/profile`,
  `POST /auth/avatar` (max 5 MB), `PATCH /auth/password`, `POST /auth/logout` (client-side
  token discard, no server state), `DELETE /auth/account` (full cascade delete). ⚠ No
  password-reset or email-verification endpoints exist.
- **Google SSO** (`auth_google_sso.py`, sign-in only): `GET /auth/google/login`,
  `GET /auth/google/callback` (requires `email_verified=true`, find-or-creates user, issues local
  JWT), `POST /auth/google/unlink`.
- **"Google Sheets" OAuth** (`auth_google_sheets.py`) — ⚠ misnamed: it's a generic Google
  Workspace OAuth flow for **Staff tool credentials** (`sheet`/`drive`/`docs`/`slides`/
  `calendar` tools), not sign-in. Tokens stored per-owner-per-tool on disk, consumed by the
  matching toolkit at runtime.
- **User model**: `id, name, email, hashed_password, role` (free string, not enum — `"user"` by
  default), `provider ("local"|google)`.
- **Roles/guest scope**: no dedicated guest role — guest mode is the *absence of a token*,
  falling back to a shared `guest` owner scope; a valid admin/system token maps to the shared
  `default` owner scope; a regular user maps to their own id. `require_admin_dep` requires
  `role in ("admin", "system")`. An expired/malformed-but-present token → 401, never a silent
  guest fallback.

## 19. LLM / Model Management

- `llm.py` is mostly the **chat/graph execution surface**: `POST /llm/chat` (single-turn),
  `/llm/staff-graph/interject|respond|pause|resume` (in-flight run controls),
  `/llm/staff-graph/run` and `/run-stream` (multi-agent execution). Only one config-read
  endpoint: `GET /llm/models`.
- **Switching the active model** lives in Admin Monitoring, not here:
  `PUT /admin/monitoring/active-model` (validates against enabled models, persists via
  `SystemSettingsRepository`, refreshes the cached provider).
- **`models:` config** (`ModelConfig`): `name, display_name, model, provider_name, base_url,
  enabled`, capability flags (vision/embedding/image_gen/tts/video_gen/thinking), plus a
  `failover:` block (`strategy: rotate|9router`, `rotate_max_requests_per_min`,
  `rotate_max_tokens_per_min`, `key_cooldown_seconds`) — **per-model-entry API-key rotation**,
  not cross-provider fallback (that needs the external 9Router gateway). Full reference:
  [llm-key-rotation.md](llm-key-rotation.md), [9router-setup.md](9router-setup.md).
- ⚠ No runtime API to add/edit/delete model registry entries — strictly `config.yml`-edited; the
  Settings UI is switch-only.
- ⚠ Model selection is **global/app-wide only** — `Staff` and `Department` have no `model` field.
  One active model for the whole deployment, DB-persisted override taking priority over
  `config.yml`'s first-enabled default.

**Endpoints** (`server/api/routers/llm.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/llm/models` | List enabled models for the UI picker |
| POST | `/llm/chat` | Direct single-turn chat |
| POST | `/llm/staff-graph/interject` | Queue a message into an active streaming run |
| POST | `/llm/staff-graph/respond` | Answer a staff's blocking `ask_user` tool call |
| POST | `/llm/staff-graph/pause` \| `/resume` | Pause/resume an active run |
| POST | `/llm/staff-graph/run` \| `/run-stream` | Multi-agent graph execution (sync / SSE) |

## 20. Admin Monitoring

All endpoints admin-only. Plain point-in-time REST — no real-time/streaming; UI polls on manual
refresh.

- Global token/cost usage by model/user/day (zero-filled series, 1–365-day window).
- Model pricing table CRUD.
- Active LLM model switch.
- Per-user activity: usage + owned entity counts.
- File storage stats: backend (local/s3), MinIO connectivity, object counts/bytes for sandbox and
  library buckets.
- System health snapshot: storage connectivity, LLM provider/active model, in-process request
  metrics (uptime, total/error requests, error rate, avg latency — resets on restart), queue/lock
  backend names, entity counts, `status: ok|degraded`.
- ⚠ **Not present**: sandbox CPU/memory limits or usage, security audit logs, in-flight task
  counts, structured error logs, rate-limit status, queue depth beyond backend name.

**Endpoints** (`server/api/routers/admin_monitoring.py`, prefix `/admin/monitoring`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/usage` | Global token/cost usage summary |
| GET/PUT/DELETE | `/pricing` | Model pricing table |
| GET | `/users` | Per-user activity + usage |
| PUT | `/active-model` | Switch app-wide active LLM model |
| GET | `/file-storage` | Storage/MinIO/library usage stats |
| GET | `/health` | System health snapshot |

## 21. Playground & Settings

- **Playground** ("Training Center" in nav) — ⚠ narrower than the nav doc implies: there is
  **no Staff picker or live prompt-testing**. The user enters a free-text task description
  (textarea + 6 canned examples), which fires a single one-shot `POST /simulations/plan` call.
  The response is replayed client-side with `setTimeout` per step to fake streaming — not real
  SSE. Nothing is persisted (no task/meeting IDs); it's a single-shot plan simulation demo, not
  an isolated per-staff sandbox.
- **Settings** — a single scrolling page, not tabs, with two sections: **Active Model**
  (admin-only, lists via `GET /llm/models`, sets via `PUT /admin/monitoring/active-model`) and
  **Third-Party Connections** (full CRUD over `Connection` records). No profile,
  notification-preference, or theme UI lives here (profile edits are on `Profile.tsx`, §18;
  language switching is app-wide via `LanguageContext`).

## 22. Health

`GET /health` — a static liveness stub, always returns `{"status": "ok"}`, no dependency checks.
Real infra health is `GET /admin/monitoring/health` (§20, admin-only).

## 23. Internationalization

4 languages: `en`, `vi`, `zh`, `ja` (`ui/src/locales/index.ts`), switched app-wide via
`LanguageContext`.

## 24. Known Gaps / Partial Features

Collected from the callouts above, for visibility:

- **Activity Feed** (§11) — list endpoint exists, but nothing in the codebase ever writes to it;
  empty by default on every install.
- **Analytics** (§12) — `department_efficiency`/`staff_productivity` are read from a global
  singleton that no code path updates; the frontend silently recomputes them client-side inside
  a company scope to compensate.
- **Reports / Roadmap** (§14) — fully functional but entirely frontend-computed; no server-side
  aggregation endpoint backs them.
- **Document Library** (§15) — no RAG/embedding ingestion; retrieval is explicit attach + tool
  call, not automatic.
- **LLM model management** (§19) — no runtime CRUD for the model registry (`config.yml`-only);
  model selection is global, not per-staff/department.
- **Auth** (§18) — no password-reset or email-verification flow; the "Google Sheets" OAuth
  router is a generic Workspace-tool credential flow, not a sign-in method.
- **Admin Monitoring** (§20) — no sandbox resource usage, security audit log, or in-flight task
  count surfaced.
- **Connections & Webhooks** (§17) — WeChat has no per-message signature verification; only the
  GET setup handshake is checked. Every inbound POST is accepted regardless of origin.
- **Playground** (§21) — a one-shot plan simulation, not a live per-staff prompt sandbox; no
  persistence.
- **Company types** (§2) — `software`/`marketing`/`research`/`general` are a UI convention only;
  the backend accepts any string.

## 25. Cross-Cutting Systems

These aren't user-facing "features" so much as the plumbing behind everything above — each has
its own deep-dive doc, linked rather than re-explained here:

| System | What it does | Doc |
|---|---|---|
| Staff execution reliability | Recursion limits, partial-state recovery, retry/timeout wrapper around LLM calls | [agent-orchestration.md](agent-orchestration.md) |
| Working memory | Shared anti-context-loss layer across staff within one multi-agent run | [agent-memory.md](agent-memory.md) |
| Long-term memory | Cross-conversation memory, embeddings/RAG, FAISS/Qdrant/Neo4j backends | [long-term-memory.md](long-term-memory.md) |
| LLM middleware stack | Limits, retries, summary, LTM, cache, cost guard, guardrail, PII redaction | [llm-middleware.md](llm-middleware.md) |
| Sandbox execution | `local`/`k8s` code-execution modes for staff-issued shell/file commands | [sandbox.md](sandbox.md) |
| Streaming | SSE event catalog for staff-graph runs | [streaming-guide.md](streaming-guide.md) |
| Security | Auth, JWT, CORS, SSRF guard, webhook signatures, logging hygiene | [security.md](security.md) |
| Deployment | Docker image, task-queue/lock/sandbox backend selection, graceful shutdown | [deployment.md](deployment.md) |
