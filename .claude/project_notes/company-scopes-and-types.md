# Project notes — company scopes & types (read this first)

Quick orientation for anyone touching the workspace/company, navigation, or scope code.
Full design write-up: `docs/company-model.md`.

## Mental model
- A **"workspace" = a "company" = an "office"** (same thing, named "Company" in the UI now).
  Hierarchy: Company → Departments (`Team`) → Staff (`Agent`) → Skills.
- Two scopes, switched from the left rail:
  - **"All" / Overall** (globe "All" icon) = **company control center**: create + control + monitor
    companies. Monitoring-only for operational data — you do NOT create tasks/projects/staff here.
  - **Inside a company** = that company's operations (departments, staff, tasks, …).

## Scope plumbing (don't reinvent)
- Active scope is stored in `localStorage.activeWorkspaceId`. Sentinel `OVERALL_WORKSPACE_ID = "__overall__"`
  (or missing) = Overall. Defined in `src/hooks/use-workspace-scope.ts`.
- **Switch scope with `setActiveWorkspaceId(id | null)`** (same file) — it writes localStorage AND dispatches
  the `activeWorkspaceChanged` event. Do not write localStorage directly.
- Consumers: `useWorkspaceScope()` returns `{ isOverall, workspace, teamIds, agentIds, skillIds, ready }`.
  `AppLayout` tracks `activeWorkspace` and listens to BOTH `activeWorkspaceChanged` and `workspaceChanged`.
- `isOverall` is reliable immediately; `ready` is false only while a company's membership loads.

## Navigation rules (`src/components/AppLayout.tsx`)
- `NAV_GROUPS` items each have `visibleIn: "overall" | "company" | "both"`. Filter = adminOnly + visibleIn.
  - Overall shows: `overviewGroup` + `companiesGroup` (AI Office Designer, Manage Companies) + `adminGroup`.
  - Inside a company shows: overview + org + operations + office + system + admin. `companiesGroup` is hidden.
- Nav **labels are i18n**, in `src/locales/index.ts` (4 locales: en/vi/zh/ja), keyed by the nav item key.
  Labels intentionally differ from keys (e.g. `tasks` → "Task Board", `marketplace` → "Recruiting").
  Group label keys: overviewGroup, companiesGroup, orgGroup, operationsGroup, officeGroup("Workspace"),
  systemGroup("Tools"), adminGroup.

## Route guards (`src/App.tsx`)
- `WithCompanyLayout` (= `RequireCompany`) redirects to `/dashboard` when `isOverall` → use for company-only
  pages (`/teams`, `/tasks`, `/projects`, `/agents`, `/skills`, `/conversations`, `/virtual-office`,
  `/documents`, `/marketplace`, `/playground`).
- `WithLayout` is reachable in both scopes → monitoring + company-management pages
  (`/dashboard`, `/analytics`, `/consumption`, `/office-builder`, `/workspaces`, `/settings`, `/profile`).

## Company type (`Workspace.type`)
- 4 types: `software | marketing | research | general` (default `general`).
- **Flexible rule**: type never hides options. It (a) is stored on the company and (b) highlights
  "suggested" nav items with a star inside that company. Mapping + icons + accents live in
  `src/lib/company-types.ts` (`COMPANY_TYPES`, `companyTypeOf`, `suggestedNavKeys`). Type labels are i18n
  (`t.companyTypes[...]`, `t.companyTypeLabel`).
- **Persistence chain** (all must stay in sync):
  - frontend `Workspace.type` / `OfficePlan.company_type` (`src/lib/api.ts`)
  - backend domain `Workspace.company_type` (`backend/domain/models.py`)
  - schema field **`type`** ↔ domain `company_type` (`backend/api/schemas/workspace.py` from_domain + UpsertWorkspaceRequest)
  - routers set it: `backend/api/routers/workspaces.py` (upsert) and `office_builder.py` (apply)
  - repos read/write JSON key **`type`**: `infrastructure/repositories/{json_files,mongo_repositories}/workspaces.py`

## Where companies are created/controlled
- **AI Office Designer** = `src/pages/OfficeBuilder.tsx` (`/office-builder`): chat → `api.applyOfficePlan`
  creates workspace + departments + staff + skills, sets type from the in-page selector, switches into it.
- **Manage Companies** = `src/pages/Workspaces.tsx` (`/workspaces`): CRUD + platform hooks + type selector +
  "import from another company" cloning. The left-rail "+" goes here.
- `src/pages/Dashboard.tsx` Overview shows a per-company "Companies" grid in Overall scope (click to switch in).

## Gotchas
- Importing backend **routers** in a sandbox can fail with `PermissionError` writing `logs/ai_collective.log`
  (logging side-effect, unrelated to code). Smoke-test domain/schemas in isolation instead.
- Pre-existing `@typescript-eslint/no-explicit-any` errors live in `Dashboard.tsx` and `Workspaces.tsx`
  (e.g. `import.meta as any`, Badge `as any`) — not from this work; don't be alarmed.
- Shell `cd backend` persists cwd across Bash calls in some setups — pass absolute paths or `pwd`-check.
