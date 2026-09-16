# AI Collective - Dual-Sidebar Dashboard Navigation Guide

This guide explains the architecture of the modern **Dual-Sidebar** dashboard layout and the purpose of each navigation item under the updated business-centric terminology.

---

## 1. Dual-Sidebar Architecture

Instead of using a single dropdown menu, the dashboard uses a nested two-column layout:
- **Sidebar 1: Corporate Directory (Leftmost Narrow Sidebar - 64px)**: Acts as the top-level switcher for your digital corporation's subsidiaries and branches (Business Units). It displays the corporate logo, a vertical list of circular office icons (with tooltips), an "Overall" collective view button, a manage/add units button (+), and global settings (⚙️).
- **Sidebar 2: Main Navigation Menu (Right Column - 208px)**: Dynamically updates to show the operations, department layouts, and staff records of the active Business Unit selected in Sidebar 1. It collapses away entirely when the sidebar is toggled.

---

## 2. Corporate Directory (Sidebar 1)

Provides direct, one-click switching across the organizational context of your digital corporation:
- **Overall Collective**: Select to view resources and manage settings across all business units simultaneously.
- **Business Units (Offices)**: Individual offices or branches with isolated staff, departments, and project databases.
- **Manage Units (+)**: Shortcut to create, edit, or delete business units.
- **System Settings (⚙️)**: General system configurations.

---

## 3. Overview Group

High-level visibility into the operations and financial/resource health of the active unit:
- **Corporate Overview (Dashboard)**: The main command center displaying active/running tasks, staff count, system notifications, and recent operations.
- **Staff & Cost Metrics (Analytics)**: Analytics tracking staff token expenses, response latency, task success rates, and compute costs.

---

## 4. Catalog Group (admin only, "Overall" scope)

Visible only to admins while in the "Overall" scope, in place of the company-creation group above:
- **Departments / Staff / Skills & Tools / Documents**: the shared "default" catalog admins curate — the
  same record types as the Organization Group below, but these are the source templates every company's
  **Recruiting Hub** copies from.

---

## 5. Organization Group

Manages the personnel structures and technical capabilities of the business unit:
- **Staff (AI Agents)**: Register and configure AI personnel, assigning names, corporate roles, LLM backends (GPT, Claude, Gemini), and standard system prompts.
- **Departments (Agent Teams)**: Organizational units grouping staff into functional teams. Configures communication networks (e.g., sequential pipeline or collaborative mesh) for team projects.
- **Skills & Tools**: The capability library. Manage integrations and custom scripts (e.g. web scrapers, database tools) assigned to staff so they can perform tasks.

---

## 6. Operations Group

Manages day-to-day projects and communication within the organization:
- **Projects & Kanban (Tasks)**: The control room for task execution. Define projects, assign them to departments, monitor real-time execution graphs/logs, and retrieve deliverables.
- **Internal Meetings (Conversations)**: Logs of conversations, collaborative transcripts, and discussions between human managers and staff, or internally among staff.

---

## 7. Workspace Group (Virtual Office)

Spatial visualization of the virtual company:
- **Office Map (Virtual Office)**: 2D representation of the active office. Watch staff move between desks, enter meeting rooms, and gather visually to collaborate.
- **Documents**: The company's Document Library.
- **Recruiting Hub (Marketplace)**: A portal to discover and copy pre-configured staff roles, department blueprints, tasks, and documents from the shared catalog.

> **Office Designer (Office Builder)** lives in the "Overall" scope's Companies group (it creates a new
> company), not in this per-company Workspace group.

---

## 8. Integrations Group

- **Platform**: Manage per-company `Connection`s — inbound messaging webhooks and outbound third-party
  hooks — and wire them to staff/departments.

---

## 9. System & Settings Group

- **Training Center (Playground)**: An isolated sandbox to test staff prompts, trial new skills, and experiment with model behaviors without affecting active projects.
- **Settings**: Adjust app-wide integrations, API keys, database settings, and notifications.

---

## 10. Administration Group

- **System Monitoring**: Administrative panel to track server status, sandbox limits, security audits, and system logs.
