import { H1, P, H2, ApiRow, CodeBlock, Callout, DocLink, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    p1: "Tasks are the Jira-style Issue in this system — see ",
    p1b: " for the full picture. The same Task record carries project_id, issue_type, issue_key, epic_id, sprint_id, and story_points alongside the department/staff assignment.",
    statusH2: "Status values",
    statusP: "pending → in-progress → in-review → completed, with paused and stopped as detours back to in-progress. Restarting a completed/stopped task keeps its message history and knowledge graph (a session-divider message is appended) rather than wiping it.",
    doubleH2: "POST does double duty",
    doubleP: "The same endpoint creates a task, updates its fields, or changes its status, depending on what the body contains — there's no separate PATCH or status-only route.",
    historyWarn: "DELETE .../history is the explicit, owner/admin-gated full wipe of a task's message history and knowledge graph — distinct from restarting it, which preserves both.",
  },
  vi: {
    p1: "Task chính là Issue kiểu Jira trong hệ thống này — xem ",
    p1b: " để có bức tranh đầy đủ. Cùng một bản ghi Task mang project_id, issue_type, issue_key, epic_id, sprint_id, và story_points bên cạnh việc gán department/staff.",
    statusH2: "Các giá trị status",
    statusP: "pending → in-progress → in-review → completed, với paused và stopped là các nhánh rẽ quay lại in-progress. Khởi động lại một task đã completed/stopped sẽ giữ nguyên lịch sử tin nhắn và knowledge graph (một tin nhắn session-divider sẽ được thêm vào) thay vì xóa sạch.",
    doubleH2: "POST đảm nhiệm hai vai trò",
    doubleP: "Cùng một endpoint tạo task, cập nhật các trường của nó, hoặc đổi status, tùy vào những gì body chứa — không có route PATCH riêng hay route chỉ đổi status riêng.",
    historyWarn: "DELETE .../history là thao tác xóa sạch tường minh, chỉ chủ sở hữu/admin mới được phép, xóa toàn bộ lịch sử tin nhắn và knowledge graph của task — khác với việc khởi động lại, vốn giữ nguyên cả hai.",
  },
  zh: {
    p1: "在本系统中，Task 就是 Jira 风格的 Issue——完整说明见 ",
    p1b: "。同一条 Task 记录除了部门/员工分配外，还带有 project_id、issue_type、issue_key、epic_id、sprint_id 和 story_points。",
    statusH2: "状态取值",
    statusP: "pending → in-progress → in-review → completed，paused 和 stopped 是回到 in-progress 的分支。重新启动已 completed/stopped 的任务会保留其消息历史和知识图谱（会追加一条 session-divider 消息），而不是清空它们。",
    doubleH2: "POST 身兼两职",
    doubleP: "同一个接口既能创建任务，也能更新其字段，或更改其状态，具体取决于请求体的内容——没有单独的 PATCH 接口或仅限状态的接口。",
    historyWarn: "DELETE .../history 是明确的、仅限所有者/管理员操作的完全清空——会清除任务的消息历史和知识图谱，这与保留两者的“重新启动”不同。",
  },
  ja: {
    p1: "このシステムでは Task が Jira 風の Issue にあたります——全体像は ",
    p1b: " を参照してください。同じ Task レコードが、部門・スタッフの割り当てに加えて project_id、issue_type、issue_key、epic_id、sprint_id、story_points を持ちます。",
    statusH2: "ステータス値",
    statusP: "pending → in-progress → in-review → completed で、paused と stopped は in-progress へ戻る寄り道です。completed/stopped のタスクを再開すると、メッセージ履歴とナレッジグラフは消去されず保持されます（session-divider メッセージが追加されます）。",
    doubleH2: "POST は二役を兼ねる",
    doubleP: "同じエンドポイントが、リクエストボディの内容に応じてタスクの作成、フィールドの更新、ステータスの変更のいずれも行います——専用の PATCH やステータス専用ルートはありません。",
    historyWarn: "DELETE .../history は、所有者/管理者のみが実行できる明示的な完全消去です——タスクのメッセージ履歴とナレッジグラフを消去します。両方を保持する「再開」とは異なります。",
  },
} as const;

export default function ApiTasksDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Tasks API</H1>
      <P>{t.p1}<DocLink id="tasks" onNavigate={onNavigate}>Tasks</DocLink>{t.p1b}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/tasks" desc="List all tasks" />
        <ApiRow method="POST" path="/api/v1/tasks" desc="Create, update, or change status (id + status in body)" />
        <ApiRow method="GET" path="/api/v1/tasks/queue/status" desc="Current task-queue backend status" />
        <ApiRow method="GET" path="/api/v1/tasks/{id}/graph-context" desc="The task's accumulated knowledge-graph context" />
        <ApiRow method="DELETE" path="/api/v1/tasks/{id}/history" desc="Wipe message history + knowledge graph (owner/admin only)" />
        <ApiRow method="DELETE" path="/api/v1/tasks/{id}" desc="Delete the task" />
      </div>

      <H2>{t.statusH2}</H2>
      <P>{t.statusP}</P>
      <CodeBlock lang="text" code={`pending ──▶ in-progress ──▶ in-review ──▶ completed\n                 │\n                 ├──▶ paused ──▶ in-progress\n                 └──▶ stopped ──▶ in-progress (history + knowledge graph kept)`} />

      <H2>{t.doubleH2}</H2>
      <P>{t.doubleP}</P>
      <CodeBlock lang="json" title="POST /api/v1/tasks — create" code={`{\n  "title": "Q3 market research",\n  "description": "Summarize competitor pricing changes this quarter.",\n  "department_id": "department_abc",\n  "priority": "high",\n  "project_id": "project_nuc",\n  "issue_type": "task"\n}`} />
      <CodeBlock lang="json" title="Response — 200 OK (create)" code={`{\n  "id": "task_xyz789",\n  "title": "Q3 market research",\n  "description": "Summarize competitor pricing changes this quarter.",\n  "department_id": "department_abc",\n  "status": "pending",\n  "progress": 0,\n  "assigned_staff": [],\n  "priority": "high",\n  "project_id": "project_nuc",\n  "issue_type": "task",\n  "issue_key": "NUC-42",\n  "owner_id": "company_42"\n}`} />
      <CodeBlock lang="json" title="POST /api/v1/tasks — change status (id present)" code={`{\n  "id": "task_xyz789",\n  "status": "in-progress"\n}`} />
      <CodeBlock lang="json" title="Response — 200 OK (status change)" code={`{\n  "id": "task_xyz789",\n  "status": "in-progress",\n  "progress": 0,\n  "start_time": "2026-09-04T09:00:00Z"\n  /* ...other fields unchanged... */\n}`} />

      <Callout type="warning">{t.historyWarn}</Callout>
    </div>
  );
}
