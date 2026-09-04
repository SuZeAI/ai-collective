import { H1, P, ApiRow, CodeBlock, InlineCode, DocLink, type DocPageProps } from "./_shared";

const TXT = {
  en: { p1: "Manage Departments — groups of Staff arranged into one of six topology modes. See ", p1b: " for what each mode does and how to choose between them." },
  vi: { p1: "Quản lý Departments — nhóm các Staff được sắp xếp theo một trong sáu topology mode. Xem ", p1b: " để biết mỗi mode làm gì và cách chọn giữa chúng." },
  zh: { p1: "管理 Departments——按六种拓扑模式之一组织起来的一组 Staff。关于每种模式的作用以及如何选择，请参见 ", p1b: "。" },
  ja: { p1: "Departments を管理します——6 つのトポロジーモードのいずれかで編成された Staff のグループです。各モードの内容と選び方については ", p1b: " を参照。" },
} as const;

export default function ApiDepartmentsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Departments API</H1>
      <P>{t.p1}<DocLink id="departments" onNavigate={onNavigate}>Departments</DocLink>{t.p1b}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/departments" desc="List all departments" />
        <ApiRow method="POST" path="/api/v1/departments" desc="Create a department, or update one if id is present in the body" />
        <ApiRow method="DELETE" path="/api/v1/departments/{id}" desc="Delete a department" />
      </div>
      <CodeBlock lang="json" title="POST /api/v1/departments — create" code={`{\n  "name": "Research Team",\n  "description": "Gathers, verifies, and writes up findings.",\n  "staff": ["staff_alice", "staff_bob"],\n  "mode": "supervisor",\n  "max_steps": 6\n}`} />
      <CodeBlock lang="json" title="Response — 200 OK" code={`{\n  "id": "department_research_team",\n  "name": "Research Team",\n  "description": "Gathers, verifies, and writes up findings.",\n  "staff": ["staff_alice", "staff_bob"],\n  "active_tasks": 0,\n  "avatar": "",\n  "mode": "supervisor",\n  "max_steps": 6,\n  "owner_id": "company_42",\n  "flow": null\n}`} />
      <CodeBlock lang="json" title="POST /api/v1/departments — custom topology" code={`{\n  "name": "Release Pipeline",\n  "description": "Custom flow: draft -> review -> ship.",\n  "staff": ["staff_dev", "staff_qa", "staff_lead"],\n  "mode": "custom",\n  "max_steps": 10,\n  "flow": { "nodes": [ /* React Flow nodes */ ], "edges": [ /* React Flow edges */ ] }\n}`} />
      <P><InlineCode>mode</InlineCode> is one of <InlineCode>sequential | ring | mesh | supervisor | tree | custom</InlineCode>. When <InlineCode>mode</InlineCode> is <InlineCode>custom</InlineCode>, <InlineCode>flow</InlineCode> holds the user-drawn graph (React Flow nodes/edges) that drives the custom LangGraph orchestrator; it's null for every other mode.</P>
    </div>
  );
}
