# Realistic-usecase E2E findings (2026-09-28)

Tested against the already-running full docker dev stack (`make dev`: mongo, rabbitmq,
redis, qdrant, neo4j, minio, k8s sandbox via provisioner+k3s) at `localhost:2026`,
using real LLM calls (deepseek-flash, active model). Raw commands are not preserved as
a script here since most of the value was in the discovery, not the harness; see the
per-case notes below for exact endpoints/payloads to reproduce.

## Use cases run

1. **Software company happy path** (Company→Department[sequential]→Staff→Skill→ad-hoc
   Task→real run via `POST /llm/staff-graph/run-stream`) — PASS. Confirmed real k8s
   sandbox Pod+Service creation/teardown-on-delete via the provisioner + a real k3s
   cluster on the host, tool calls (`sandbox_write_file`/`sandbox_read_file`/`sandbox_bash`)
   executed inside it correctly.
2. **AI Planner flow** (Project w/ `plannerStaffId` → `POST /planner/decompose` (real LLM)
   → `POST /planner/commit`) — PASS. Correct issue keys (`UC2-1..4`), department/project
   linkage, story points preserved.
3. **Recruiting clone** (`POST /recruiting/copy` for a catalog Staff) — PASS on the copy
   mechanism itself (skills deep-copied with fresh ids, correctly re-scoped to the target
   company). But surfaced Bug #1 below while inspecting the source catalog record.
4. **Restart & history** — PASS for the documented contract: completed→in-progress
   preserves history and appends a `"— New session started —"` system message; progress
   resets to 0. Non-owner `DELETE /tasks/{id}/history` on an admin-owned (shared "default")
   task correctly returns 403 (visible-but-not-modifiable), and non-owners correctly don't
   see the task at all via `GET /tasks` (count 0). No bug here, but see Finding #3 below
   (found while setting this up).
5. **Guest/anonymous ownership** — Bug #2 below (confirmed, not fixed).
6. **Document Library**, **Consumption/analytics**, **Meetings/webhook** — not reached;
   ran out of time budget for this pass. Flagging as untested, not as pass/fail.

## Bugs found

### Bug #1 — FIXED, tested: Staff could be equipped with another owner's skill (secret leak)
- `POST /staff` (`server/api/routers/staff.py`, `upsert_staff`) accepted `skill_ids`
  verbatim, no ownership check. `StaffService.list_staff_with_skills`/`get_staff_skills`
  (`server/app/service/staff_service.py:23-58`) resolve skill_ids to full `Skill` records
  (incl. the `config` dict, which can hold secrets for other skill kinds) without any
  visibility filter.
- **Confirmed exploited in this live environment**: the Recruiting catalog Staff
  `agent_0798e88decd74b9e876fb0b5e2d20aec` ("Gold Price Researcher", `owner_id=default`)
  has a `skill_id` (`skill_aa21bdc1e4f141e2af5d58fb47e7290d`, an "HTTP Client" skill) that
  actually belongs to a different real user/company (`owner_id=c26404fb-...`,
  `company_id=ws_c7516616324a490d8fbf7a7d2f187e80`). Every caller of `GET /recruiting/staff`
  or `GET /staff` got that skill's full config embedded in the response. In this instance
  the leaked config only held `timeout`/`retries`/`user_agent` (no literal secret), but the
  same code path would leak an API key/token for any skill kind that stores one in `config`.
  Root cause of *how* it got there wasn't chased down (likely a prior manual catalog edit or
  an earlier version of the copy path) — not fixed at the data level, only at the code level
  (see below), since the code fix already stops it from being served.
- **Fix applied** (branch: `test/realistic-usecases-fixes` in this worktree, commit `9696be6`):
  - `upsert_staff` now drops any `skill_ids` entry the caller can't see
    (`server/api/routers/staff.py`).
  - `GET /staff`'s nested skill list is filtered to skills visible to the caller
    (`server/api/routers/staff.py`, `list_staff`).
  - `RecruitingService.list_default_staff` filters nested skills to `owner_id==DEFAULT_OWNER_ID`
    (`server/app/service/recruiting_service.py`).
  - New regression test: `test/api/test_api_staff_skill_ownership.py` (2 tests, both verified
    to fail on the pre-fix code and pass after).
  - Full suite re-run: `469 passed, 1 pre-existing unrelated failure (missing optional `faiss`
    package), 2 skipped` — no regressions.

### Bug #2 — CONFIRMED, NOT fixed (needs a product decision): guest mode has zero session isolation
- `current_owner_id_dep` (`server/api/deps/auth.py:72-84`) returns the literal string
  `"guest"` for *every* request with no `Authorization` header — there is no cookie,
  session id, or client-generated fingerprint distinguishing one anonymous visitor from
  another.
- **Reproduced live**: created a Company with zero auth headers → `owner_id="guest"`.
  A second, entirely separate `curl` call (also with no auth headers, i.e. simulating a
  different anonymous visitor) immediately saw that company via `GET /companies`.
  Since `can_modify`/`can_delete` (`server/domain/models.py:42-50`) check
  `entity_owner_id == owner_id` and both are literally `"guest"`, any anonymous visitor can
  also edit or delete any other anonymous visitor's data — not just read it.
- This matters concretely if the product ever runs a public/trial mode without forcing
  login (marketing site "try it" flows, demo booths, etc.) — every simultaneous anonymous
  visitor shares one company/task/staff namespace and can stomp on each other.
- Not fixed here: the right fix (server-issued guest-session cookie? client-generated
  UUID header persisted in localStorage and threaded through `api.ts`?) is a scoped
  frontend+backend design decision, not a safe blind patch.

## Weak points found (not bugs, but real customer-facing risk)

### #3 — No server-side source of truth for "did this task finish" or its transcript
- `POST /tasks` with `status:"in-progress"` does **not** itself start a run — by design
  (see the comment at `server/api/routers/tasks.py:224-231`). The actual run is
  `POST /llm/staff-graph/run-stream`, and *both* marking the task `completed` (`progress:100`)
  **and** persisting each turn as a `Meeting`/message record are done by the **frontend**
  (`ui/src/contexts/RunEngineContext.tsx:587` for completion; per-turn message posting is
  also client-driven) after it observes the SSE stream, not by the backend.
- Verified live: running a task directly via `curl` against `run-stream` (bypassing the
  UI) produced a real, correct LLM turn, but left the Task at `status:"in-progress",
  progress:0` forever, and `GET /meetings?task_id=...` stayed empty — the run happened but
  left no record anywhere except the SSE response itself.
- Real-world implication: any non-browser integration (webhook-triggered tasks, a future
  public API, a mobile client with flaky connectivity, or just a closed browser tab mid-run)
  silently loses the transcript and leaves the task stuck "in-progress" at 0% with no
  automatic recovery — the only fix today is a manual restart (which re-runs from scratch
  rather than resuming). Recommend moving at least the completion write (and ideally
  message persistence) server-side, driven off the stream's natural end rather than the
  client's `finally` block.

### #4 — k8s sandbox pods/services are never torn down on task completion
- Confirmed via `docker-provisioner` logs + `kubectl get pods`: a sandbox Pod+Service is
  created lazily on first tool use and stays `Running` indefinitely. The only code path
  that deletes it is `DELETE /tasks/{id}` when it's the last task in its project
  (`server/api/routers/tasks.py:242-283`, via `cleanup_meeting_sandbox`) — grepped the
  whole `server/` tree for other callers of the provisioner's delete endpoint and found
  none (no idle-TTL reaper, nothing on task completion).
- Real-world implication: most customers keep completed tasks as history rather than
  deleting them, so in practice nearly every task that ever used a sandbox tool leaves a
  live k8s Pod/Service running forever — unbounded cluster resource growth and a widening
  attack surface over time, purely from normal usage. Observed one sandbox pod in this
  environment already 8 days old with no task referencing it having been deleted.
- Not fixed here: needs a decision (idle-TTL reaper in the provisioner? hibernate/backup
  the workspace and delete the pod on task completion, matching the existing
  backup-to-minio path? explicit "close workspace" UI action?) rather than a guessed patch.

### #5 — minor: `Department.activeTasks` is misleading, not an actual count
- A brand-new Department with staff attached is created with `activeTasks=1`
  (`server/api/routers/departments.py:108-111`, deliberate: "a newly created department
  starts in active mode") even though it has zero real tasks. Not a bug (intentional,
  commented), but the field name strongly implies a live count and will read as wrong on
  any dashboard that surfaces it literally. Consider renaming/repurposing rather than
  overloading a count-shaped field as a status flag.

### #6 — minor: legacy `agent_` id prefix survives the Staff rename
- New Staff records still get ids like `agent_<hex>` (`server/api/routers/staff.py`,
  `f"agent_{uuid4().hex}"`), a leftover from the pre-rename "Agent" vocabulary. Purely
  cosmetic/internal (not user-facing), not worth churning existing data over, but flagging
  since it's easy to trip over when grepping the codebase for "agent" and assuming it's
  dead vocabulary.

## Not reached this pass
Document Library-in-a-run, Consumption/analytics correctness, Meetings (interactive,
non-task-run) conversation flow, and Connections/webhook-triggered task creation were in
scope but not exercised — no findings either way, genuinely untested.
