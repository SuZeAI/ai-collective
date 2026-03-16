from __future__ import annotations

from datetime import datetime

from backend.domain.enums import AgentStatus, TaskStatus
from backend.domain.models import Agent, Skill, Team, Task, Message, Analytics, ActivityFeedItem


def seed_agents() -> list[Agent]:
    return [
        Agent(id="a1", name="Sarah", role="Project Manager", description="Coordinates agents, assigns subtasks, and ensures timely delivery.", skills=[], status=AgentStatus.active, avatar="S"),
        Agent(id="a2", name="Cortex", role="Research Agent", description="Collects data, analyzes competitors, and surfaces insights.", skills=[], status=AgentStatus.active, avatar="C"),
        Agent(id="a3", name="Unit 7", role="Developer Agent", description="Implements technical solutions and builds structures.", skills=[], status=AgentStatus.idle, avatar="U"),
        Agent(id="a4", name="Echo", role="Marketing Agent", description="Creates copy, campaigns, and high-conversion content.", skills=[], status=AgentStatus.idle, avatar="E"),
        Agent(id="a5", name="Sigma", role="Reviewer Agent", description="Evaluates output quality and suggests improvements.", skills=[], status=AgentStatus.idle, avatar="Σ"),
        Agent(
            id="a6",
            name="Aki",
            role="AI Engineer",
            description="Builds and evaluates AI workflows, monitors quality, and ships improvements.",
            skills=[
                Skill(
                    id="skill_ai_engineer_toolkit",
                    name="AI Engineer Toolkit",
                    description="Automate common AI engineering tasks: eval plans, prompt tests, dataset checks.",
                    third_party="Custom",
                    kind="custom-js",
                    config={},
                    code=(
                        "// AI Engineer Toolkit (custom)\n"
                        "// Input: { task: string, data?: any }\n"
                        "// Output: { ok: boolean, notes?: string, result?: any }\n"
                        "export default async function run(input) {\n"
                        "  return { ok: true, notes: 'Toolkit ready', result: input };\n"
                        "}\n"
                    ),
                ),
                Skill(
                    id="skill_github_issues",
                    name="GitHub Issues",
                    description="Create issues, triage labels, and summarize bug threads.",
                    third_party="GitHub",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_market_research",
                    name="Market & Competitor Research",
                    description="Collect sources, summarize competitors, and extract actionable insights.",
                    third_party="Web",
                    kind="integration",
                    config={"auth": {"type": "api-key", "provider": "Tavily", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_gdocs",
                    name="Google Docs",
                    description="Create/update docs, generate briefs and reports.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="A",
        ),
        Agent(
            id="a7",
            name="Bao",
            role="Businessman",
            description="Runs business operations, tracks KPIs, and coordinates execution across teams.",
            skills=[
                Skill(
                    id="skill_startup_kpi_sheets",
                    name="Startup KPI Tracker (Sheets)",
                    description="Maintain KPIs (MRR, churn, CAC/LTV) and generate weekly snapshots.",
                    third_party="Google Sheets",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_slack_messaging",
                    name="Slack Messaging",
                    description="Post updates, respond to threads, and route alerts to channels.",
                    third_party="Slack",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_notion_kb",
                    name="Notion Knowledge Base",
                    description="Create/update pages, maintain playbooks, and publish SOPs.",
                    third_party="Notion",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="B",
        ),
        Agent(
            id="a8",
            name="Linh",
            role="Sales Executive",
            description="Finds leads, drafts outreach, and handles follow-ups across channels.",
            skills=[
                Skill(
                    id="skill_sales_outreach_docs",
                    name="Sales Outreach Drafting (Docs)",
                    description="Draft personalized outreach, proposals, and follow-ups in docs.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_market_research",
                    name="Market & Competitor Research",
                    description="Collect sources, summarize competitors, and extract actionable insights.",
                    third_party="Web",
                    kind="integration",
                    config={"auth": {"type": "api-key", "provider": "Tavily", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_slack_messaging",
                    name="Slack Messaging",
                    description="Post updates, respond to threads, and route alerts to channels.",
                    third_party="Slack",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_telegram_bot",
                    name="Telegram Bot",
                    description="Send notifications and handle basic command interactions.",
                    third_party="Telegram",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="L",
        ),
        Agent(
            id="a9",
            name="Huy",
            role="Customer Support",
            description="Triages requests, drafts replies, and maintains support playbooks.",
            skills=[
                Skill(
                    id="skill_slack_messaging",
                    name="Slack Messaging",
                    description="Post updates, respond to threads, and route alerts to channels.",
                    third_party="Slack",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_notion_kb",
                    name="Notion Knowledge Base",
                    description="Create/update pages, maintain playbooks, and publish SOPs.",
                    third_party="Notion",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_market_research",
                    name="Market & Competitor Research",
                    description="Collect sources, summarize competitors, and extract actionable insights.",
                    third_party="Web",
                    kind="integration",
                    config={"auth": {"type": "api-key", "provider": "Tavily", "api_key": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="H",
        ),
        Agent(
            id="a10",
            name="Trang",
            role="HR Recruiter",
            description="Screens candidates, schedules interviews, and maintains hiring pipelines.",
            skills=[
                Skill(
                    id="skill_gdocs",
                    name="Google Docs",
                    description="Create/update docs, generate briefs and reports.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_calendar_scheduling",
                    name="Calendar Scheduling",
                    description="Coordinate meetings, propose times, and create calendar events.",
                    third_party="Google Calendar",
                    kind="integration",
                    config={
                        "auth": {
                            "type": "oauth",
                            "client_id": "",
                            "client_secret": "",
                            "refresh_token": "",
                        }
                    },
                    code=None,
                ),
                Skill(
                    id="skill_market_research",
                    name="Market & Competitor Research",
                    description="Collect sources, summarize competitors, and extract actionable insights.",
                    third_party="Web",
                    kind="integration",
                    config={"auth": {"type": "api-key", "provider": "Tavily", "api_key": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="T",
        ),
        Agent(
            id="a11",
            name="Khanh",
            role="Finance Analyst",
            description="Builds reports, tracks cashflow KPIs, and prepares monthly summaries.",
            skills=[
                Skill(
                    id="skill_startup_kpi_sheets",
                    name="Startup KPI Tracker (Sheets)",
                    description="Maintain KPIs (MRR, churn, CAC/LTV) and generate weekly snapshots.",
                    third_party="Google Sheets",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_gsheets",
                    name="Google Sheets",
                    description="Read/write rows, sync data, generate reports.",
                    third_party="Google Sheets",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_gdocs",
                    name="Google Docs",
                    description="Create/update docs, generate briefs and reports.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="K",
        ),
        Agent(
            id="a12",
            name="Phuong",
            role="Legal Counsel",
            description="Drafts policies and contracts, reviews terms, and maintains compliance docs.",
            skills=[
                Skill(
                    id="skill_contract_drafting_docs",
                    name="Contract Drafting (Docs)",
                    description="Draft and revise contracts, policies, and clauses with tracked sections.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_gdocs",
                    name="Google Docs",
                    description="Create/update docs, generate briefs and reports.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="P",
        ),
        Agent(
            id="a13",
            name="Nam",
            role="DevOps Engineer",
            description="Automates deployments, handles incident notes, and routes alerts.",
            skills=[
                Skill(
                    id="skill_github_issues",
                    name="GitHub Issues",
                    description="Create issues, triage labels, and summarize bug threads.",
                    third_party="GitHub",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_slack_messaging",
                    name="Slack Messaging",
                    description="Post updates, respond to threads, and route alerts to channels.",
                    third_party="Slack",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_custom_js",
                    name="Custom JS",
                    description="Run custom JavaScript to integrate with third parties.",
                    third_party="Custom",
                    kind="custom-js",
                    config={},
                    code="// Write custom JS here\n// Example: return { ok: true }\n",
                ),
            ],
            status=AgentStatus.idle,
            avatar="N",
        ),
        Agent(
            id="a14",
            name="Mai",
            role="Product Manager",
            description="Writes specs, aligns stakeholders, and keeps execution on track.",
            skills=[
                Skill(
                    id="skill_gdocs",
                    name="Google Docs",
                    description="Create/update docs, generate briefs and reports.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_notion_kb",
                    name="Notion Knowledge Base",
                    description="Create/update pages, maintain playbooks, and publish SOPs.",
                    third_party="Notion",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_slack_messaging",
                    name="Slack Messaging",
                    description="Post updates, respond to threads, and route alerts to channels.",
                    third_party="Slack",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_market_research",
                    name="Market & Competitor Research",
                    description="Collect sources, summarize competitors, and extract actionable insights.",
                    third_party="Web",
                    kind="integration",
                    config={"auth": {"type": "api-key", "provider": "Tavily", "api_key": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="M",
        ),
        Agent(
            id="a15",
            name="Quynh",
            role="Content & Community",
            description="Plans content, maintains community guidelines, and publishes playbooks.",
            skills=[
                Skill(
                    id="skill_gdocs",
                    name="Google Docs",
                    description="Create/update docs, generate briefs and reports.",
                    third_party="Google Docs",
                    kind="integration",
                    config={"auth": {"type": "service-account", "service_account_json": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_notion_kb",
                    name="Notion Knowledge Base",
                    description="Create/update pages, maintain playbooks, and publish SOPs.",
                    third_party="Notion",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
                Skill(
                    id="skill_telegram_bot",
                    name="Telegram Bot",
                    description="Send notifications and handle basic command interactions.",
                    third_party="Telegram",
                    kind="integration",
                    config={"auth": {"type": "api-key", "api_key": ""}},
                    code=None,
                ),
            ],
            status=AgentStatus.idle,
            avatar="Q",
        ),
    ]


def seed_skills() -> list[Skill]:
    return [
        Skill(
            id="skill_gsheets",
            name="Google Sheets",
            description="Read/write rows, sync data, generate reports.",
            third_party="Google Sheets",
            kind="integration",
            config={
                "auth": {
                    "type": "service-account",
                    "service_account_json": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_gdocs",
            name="Google Docs",
            description="Create/update docs, generate briefs and reports.",
            third_party="Google Docs",
            kind="integration",
            config={
                "auth": {
                    "type": "service-account",
                    "service_account_json": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_websearch",
            name="Web Search",
            description="Search the web via a provider API.",
            third_party="Web",
            kind="integration",
            config={
                "auth": {
                    "type": "api-key",
                    "provider": "Tavily",
                    "api_key": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_custom_js",
            name="Custom JS",
            description="Run custom JavaScript to integrate with third parties.",
            third_party="Custom",
            kind="custom-js",
            config={},
            code="// Write custom JS here\n// Example: return { ok: true }\n",
        ),
        Skill(
            id="skill_ai_engineer_toolkit",
            name="AI Engineer Toolkit",
            description="Automate common AI engineering tasks: eval plans, prompt tests, dataset checks.",
            third_party="Custom",
            kind="custom-js",
            config={},
            code=(
                "// AI Engineer Toolkit (custom)\n"
                "// Input: { task: string, data?: any }\n"
                "// Output: { ok: boolean, notes?: string, result?: any }\n"
                "export default async function run(input) {\n"
                "  return { ok: true, notes: 'Toolkit ready', result: input };\n"
                "}\n"
            ),
        ),
        Skill(
            id="skill_startup_kpi_sheets",
            name="Startup KPI Tracker (Sheets)",
            description="Maintain KPIs (MRR, churn, CAC/LTV) and generate weekly snapshots.",
            third_party="Google Sheets",
            kind="integration",
            config={
                "auth": {
                    "type": "service-account",
                    "service_account_json": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_sales_outreach_docs",
            name="Sales Outreach Drafting (Docs)",
            description="Draft personalized outreach, proposals, and follow-ups in docs.",
            third_party="Google Docs",
            kind="integration",
            config={
                "auth": {
                    "type": "service-account",
                    "service_account_json": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_contract_drafting_docs",
            name="Contract Drafting (Docs)",
            description="Draft and revise contracts, policies, and clauses with tracked sections.",
            third_party="Google Docs",
            kind="integration",
            config={
                "auth": {
                    "type": "service-account",
                    "service_account_json": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_market_research",
            name="Market & Competitor Research",
            description="Collect sources, summarize competitors, and extract actionable insights.",
            third_party="Web",
            kind="integration",
            config={
                "auth": {
                    "type": "api-key",
                    "provider": "Tavily",
                    "api_key": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_github_issues",
            name="GitHub Issues",
            description="Create issues, triage labels, and summarize bug threads.",
            third_party="GitHub",
            kind="integration",
            config={
                "auth": {
                    "type": "api-key",
                    "api_key": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_slack_messaging",
            name="Slack Messaging",
            description="Post updates, respond to threads, and route alerts to channels.",
            third_party="Slack",
            kind="integration",
            config={
                "auth": {
                    "type": "api-key",
                    "api_key": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_telegram_bot",
            name="Telegram Bot",
            description="Send notifications and handle basic command interactions.",
            third_party="Telegram",
            kind="integration",
            config={
                "auth": {
                    "type": "api-key",
                    "api_key": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_notion_kb",
            name="Notion Knowledge Base",
            description="Create/update pages, maintain playbooks, and publish SOPs.",
            third_party="Notion",
            kind="integration",
            config={
                "auth": {
                    "type": "api-key",
                    "api_key": "",
                }
            },
            code=None,
        ),
        Skill(
            id="skill_calendar_scheduling",
            name="Calendar Scheduling",
            description="Coordinate meetings, propose times, and create calendar events.",
            third_party="Google Calendar",
            kind="integration",
            config={
                "auth": {
                    "type": "oauth",
                    "client_id": "",
                    "client_secret": "",
                    "refresh_token": "",
                }
            },
            code=None,
        ),
    ]


def seed_teams() -> list[Team]:
    return [
        Team(id="t1", name="Launch Squad Alpha", description="Full-stack product launch team for rapid MVPs.", agents=["a1", "a2", "a3", "a4", "a5"], active_tasks=3),
        Team(id="t2", name="Content Ops", description="Content strategy and production pipeline.", agents=["a1", "a2", "a4"], active_tasks=2),
        Team(id="t3", name="Code Review Cell", description="Automated code quality and architecture review.", agents=["a3", "a5"], active_tasks=1),
        Team(id="t4", name="Customer Support Desk", description="Triage tickets, draft replies, and escalate bugs with context.", agents=["a1", "a2", "a5"], active_tasks=0),
        Team(id="t5", name="Community Moderation Guild", description="Moderate community channels, enforce rules, and summarize incidents.", agents=["a1", "a4", "a5"], active_tasks=0),
        Team(id="t6", name="Sales Outreach Pod", description="Prospect research, personalized outreach, and follow-up sequences.", agents=["a2", "a4", "a5"], active_tasks=0),
        Team(id="t7", name="HR & Recruiting Cell", description="Job posts, candidate screening summaries, and interview coordination.", agents=["a1", "a2", "a5"], active_tasks=0),
        Team(id="t8", name="SRE / DevOps Rotation", description="Incident response support, runbooks, and postmortem drafts.", agents=["a1", "a3", "a5"], active_tasks=0),
        Team(id="t9", name="Finance Ops", description="Invoice parsing, spend summaries, and monthly reporting packets.", agents=["a1", "a2", "a5"], active_tasks=0),
        Team(id="t10", name="Legal & Compliance Desk", description="Policy drafts, vendor/security questionnaires, and compliance checklists.", agents=["a1", "a2", "a5"], active_tasks=0),
        Team(id="t11", name="Education & Training Studio", description="Create onboarding docs, tutorials, quizzes, and internal playbooks.", agents=["a1", "a4", "a5"], active_tasks=0),
        Team(id="t12", name="Research Lab", description="Deep research, experiment notes, and decision memos for leaders.", agents=["a2", "a3", "a5"], active_tasks=0),
    ]


def seed_tasks() -> list[Task]:
    return [
        Task(id="task1", title="Create landing page for AI startup", description="Design and build a high-conversion landing page.", team_id="t1", status=TaskStatus.in_progress, progress=65, assigned_agents=["a1", "a2", "a3", "a4", "a5"]),
        Task(id="task2", title="Competitive analysis report", description="Research top 10 competitors in the AI agent space.", team_id="t1", status=TaskStatus.completed, progress=100, assigned_agents=["a2", "a1"]),
        Task(id="task3", title="Write product documentation", description="Create comprehensive docs for the API.", team_id="t2", status=TaskStatus.pending, progress=0, assigned_agents=["a4", "a5"]),
        Task(id="task4", title="Refactor authentication module", description="Improve security and code quality of auth.", team_id="t3", status=TaskStatus.in_progress, progress=40, assigned_agents=["a3", "a5"]),
        Task(id="task5", title="Design marketing campaign", description="Q1 launch campaign across channels.", team_id="t2", status=TaskStatus.in_progress, progress=30, assigned_agents=["a4", "a1"]),
    ]


def seed_conversations() -> list[Message]:
    # Timestamps are synthetic; keep them deterministic-ish.
    base = datetime.utcnow().replace(microsecond=0)
    return [
        Message(id="m1", agent_id="a1", content="I've broken down the landing page task into 4 subtasks. Assigning now.", timestamp=base, task_id="task1"),
        Message(id="m2", agent_id="a2", content="Analyzing 5 competitor landing pages for structure and messaging patterns.", timestamp=base, task_id="task1"),
        Message(id="m3", agent_id="a3", content="Scaffolding the component architecture. Using a hero + features + CTA layout.", timestamp=base, task_id="task1"),
        Message(id="m4", agent_id="a4", content="Drafting headline variants: 'Deploy AI Teams in Seconds' scored highest.", timestamp=base, task_id="task1"),
        Message(id="m5", agent_id="a5", content="Review: Headline is strong. Suggest adding social proof above the fold.", timestamp=base, task_id="task1"),
        Message(id="m6", agent_id="a1", content="Good catch, Sigma. Echo, add a testimonial section. Unit 7, make room in the layout.", timestamp=base, task_id="task1"),
    ]


def seed_analytics() -> Analytics:
    return Analytics(
        tasks_completed=42,
        avg_completion_time="3.8 min",
        team_efficiency=92,
        agent_productivity={"a1": 95, "a2": 88, "a3": 91, "a4": 85, "a5": 98},
    )


def seed_activity_feed() -> list[ActivityFeedItem]:
    return [
        ActivityFeedItem(id="f1", agent_id="a2", action="collected competitor data", time="2 min ago"),
        ActivityFeedItem(id="f2", agent_id="a3", action="generated UI structure", time="4 min ago"),
        ActivityFeedItem(id="f3", agent_id="a4", action="created product description", time="6 min ago"),
        ActivityFeedItem(id="f4", agent_id="a5", action="approved output quality", time="8 min ago"),
        ActivityFeedItem(id="f5", agent_id="a1", action="assigned new subtasks", time="10 min ago"),
    ]

