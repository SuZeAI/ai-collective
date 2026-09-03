# Company model: scopes, the "All" control center & company types

This document describes how the app separates the **global "All" view** from a **single company**,
how companies are created and controlled, and how a company's **type** tailors its options.

> Terminology: **company = workspace = office** (one concept). The UI now says "Company".
> Hierarchy: **Company → Departments (teams) → Staff (agents) → Skills**.

## 1. Two scopes

The left rail switches the active scope. The choice is persisted in `localStorage.activeCompanyId`
(sentinel `__overall__` = "All") and broadcast via the `activeCompanyChanged` event. Always switch with
`setActiveCompanyId()` from `src/hooks/use-company-scope.ts`.

| | **"All" (Overall)** | **Inside a company** |
|---|---|---|
| Purpose | Create, control & monitor **all** companies | Operate **one** company |
| `useCompanyScope().isOverall` | `true` | `false` |
| Creating tasks/projects/staff | ✗ (monitoring only) | ✓ |

### Nav visibility rule (`src/components/AppLayout.tsx`)

Each `NAV_GROUPS` group declares `visibleIn: "overall" | "company" | "both"`:

```
overviewGroup      both     Company Overview · Performance & Cost · Usage & Billing
companiesGroup     overall  AI Office Designer · Manage Companies        ← only in "All", hidden for admins
catalogGroup       overall  Departments · Staff · Skills & Tools · Documents  (admin only, group label: "Catalog")
orgGroup           company  Departments · Staff · Skills & Tools
operationsGroup    company  Projects · Task Board · Meetings
officeGroup        company  Office Map · Documents · Recruiting           (group label: "Workspace")
integrationsGroup  company  Platform                                     (group label: "Integrations")
systemGroup        company  Training                                     (group label: "Tools")
adminGroup         both     System Monitoring                            (admin only)
```

`catalogGroup` is the admin-only, All-scope shared "default" catalog (`/departments`, `/staff`, `/skills`, `/documents`) — the same routes as `orgGroup`/`officeGroup`'s Documents, but curated by admins as the source templates that every company's **Recruiting** page copies from. It replaces `companiesGroup` in the nav for admins (they curate the catalog instead of creating companies from that group).

`integrationsGroup` is `/platform` (`src/pages/Platform.tsx`) — manage per-company `Connection`s (inbound webhooks + outbound third-party hooks) and the messaging platforms wired to staff/departments.

Filter:
```ts
NAV_GROUPS.filter(g =>
  (!g.adminOnly || isAdmin) &&
  (g.visibleIn === "both" || g.visibleIn === (isOverall ? "overall" : "company")));
```

Routes are guarded to match (`src/App.tsx`): company-only pages use `WithCompanyLayout` (redirect to
`/dashboard` when Overall); monitoring + company-management pages use `WithLayout` (reachable in both).
`/office-builder` and `/companies` are intentionally reachable in "All".

## 2. Creating & controlling companies (the "All" hub)

- **AI Office Designer** — `/office-builder` (`src/pages/OfficeBuilder.tsx`). Describe a company in chat;
  the AI proposes departments/staff/skills; pick a **company type** and click **Create Company**.
  `api.applyOfficePlan` materializes the company + departments + staff + skills and switches into it.
- **Manage Companies** — `/companies` (`src/pages/Companies.tsx`). Manual CRUD, company type selector,
  messaging platform hooks, and "import settings from another company" (clone). The left-rail **+** opens this.
- **Company Overview** — `/dashboard` in "All" shows aggregate metrics + a **Companies grid** (one card per
  company with task/staff counts and type); click a card to switch into that company.

## 3. Company types

Every company has a `type` (default `general`). Four types:

| type | label | suggested options (highlighted, never exclusive) |
|---|---|---|
| `software` | Software | Projects, Task Board, Skills & Tools, Training |
| `marketing` | Marketing | Projects, Meetings, Documents, Recruiting |
| `research` | Research | Documents, Task Board, Meetings |
| `general` | General | — (everything, no emphasis) |

**Flexible rule (by design):** the type **never hides** any option. It only:
1. seeds the AI-generated structure / intent, and
2. marks the best-fit options with a ⭐ "Suggested" star inside that company's nav, and shows a type badge
   in the sidebar header and on company cards.

Definitions (icon, accent, suggested nav keys) live in `src/lib/company-types.ts`
(`COMPANY_TYPES`, `companyTypeOf`, `suggestedNavKeys`). Display labels are i18n: `t.companyTypes[type]`.

### Persistence

The type flows through, end to end (keep in sync when changing):

```
UI  Company.type / OfficePlan.company_type   src/lib/api.ts
API schema field `type`  ⇄  domain `company_type`   backend/api/schemas/company.py
                                                     backend/domain/models.py
set in routers:   backend/api/routers/companies.py (upsert), office_builder.py (apply)
stored (JSON key `type`):  infrastructure/repositories/json_files/companies.py
                           infrastructure/repositories/mongo_repositories/companies.py
```

## 4. Naming map (option renames)

| key | old label | new label |
|---|---|---|
| dashboard | Corporate Overview | Company Overview |
| analytics | Staff & Cost Metrics | Performance & Cost |
| consumption | Cost Monitoring | Usage & Billing |
| officeBuilder | Office Designer | AI Office Designer |
| workspaces | Business Units | Manage Companies |
| tasks | Projects & Kanban | Task Board |
| conversations | Internal Meetings | Meetings |
| documentLibrary | Document Library | Documents |
| marketplace | Recruiting Hub | Recruiting |
| playground | Training Center | Training |
| officeGroup (group) | Simulation | Workspace |
| systemGroup (group) | System Settings | Tools |
| companiesGroup (group) | — | Companies (new) |

(teams=Departments, agents=Staff, skills=Skills & Tools, projects=Projects, virtualOffice=Office Map,
monitoring=System Monitoring are unchanged.) All four locales (en/vi/zh/ja) are updated in
`src/locales/index.ts`.

## 5. Where to look

- Scope hook / switch helper: `src/hooks/use-company-scope.ts`
- Nav + suggested stars + type badge: `src/components/AppLayout.tsx`
- Company types: `src/lib/company-types.ts`
- Create (AI): `src/pages/OfficeBuilder.tsx` · Control: `src/pages/Companies.tsx` · Overview: `src/pages/Dashboard.tsx`
- Route guards: `src/App.tsx`
- Backend `company_type`: `backend/domain/models.py`, `backend/api/schemas/company.py`,
  `backend/api/routers/{companies,office_builder}.py`, `backend/infra/repositories/*/companies.py`
