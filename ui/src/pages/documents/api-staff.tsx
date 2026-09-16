import { H1, P, ApiRow, CodeBlock, DocLink, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    p1: "Manage Staff members. Every route is mounted under the API prefix (/api/v1 by default). For the full schema and what each field does, see ",
    p1b: ".",
  },
  vi: {
    p1: "Quản lý các Staff. Mọi route đều được gắn dưới tiền tố API (mặc định /api/v1). Để biết schema đầy đủ và ý nghĩa từng trường, xem ",
    p1b: ".",
  },
  zh: {
    p1: "管理 Staff（员工）。所有路由都挂载在 API 前缀下（默认 /api/v1）。完整的数据结构及各字段含义请参见 ",
    p1b: "。",
  },
  ja: {
    p1: "Staff を管理します。すべてのルートは API プレフィックス（デフォルト /api/v1）配下にマウントされます。完全なスキーマと各フィールドの意味は ",
    p1b: " を参照してください。",
  },
} as const;

export default function ApiStaffDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Staff API</H1>
      <P>{t.p1}<DocLink id="staff" onNavigate={onNavigate}>Staff</DocLink>{t.p1b}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/staff" desc="List all staff visible to the current owner scope" />
        <ApiRow method="POST" path="/api/v1/staff" desc="Create a staff, or update one if id is present in the body" />
        <ApiRow method="DELETE" path="/api/v1/staff/{id}" desc="Delete a staff (owner/admin only for shared defaults)" />
      </div>
      <CodeBlock lang="json" title="POST /api/v1/staff — create" code={`{\n  "name": "Alice",\n  "role": "Research Staff",\n  "description": "Gathers and summarizes web research.",\n  "skill_ids": [],\n  "status": "idle",\n  "avatar": "A",\n  "subagent_enabled": false\n}`} />
      <CodeBlock lang="json" title="Response — 200 OK" code={`{\n  "id": "staff_abc123",\n  "name": "Alice",\n  "role": "Research Staff",\n  "description": "Gathers and summarizes web research.",\n  "skill_ids": [],\n  "status": "idle",\n  "avatar": "A",\n  "avatar_icon": "",\n  "avatar_color": "",\n  "avatar_url": "",\n  "system_prompt": "",\n  "subagent_enabled": false,\n  "owner_id": "company_42"\n}`} />
      <CodeBlock lang="json" title="POST /api/v1/staff — update (id present)" code={`{\n  "id": "staff_abc123",\n  "name": "Alice",\n  "role": "Senior Research Staff",\n  "description": "Gathers and summarizes web research.",\n  "skill_ids": ["skill_websearch"],\n  "status": "idle",\n  "avatar": "A",\n  "subagent_enabled": true\n}`} />
    </div>
  );
}
