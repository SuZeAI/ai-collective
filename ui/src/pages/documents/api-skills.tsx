import { H1, P, H2, ApiRow, CodeBlock, DocLink, type DocPageProps } from "./_shared";

const TXT = {
  en: { p1: "Manage Skills (tools) and discover what's available to bind to a Staff member. See ", p1b: " for the two kinds of Skill (integration vs custom-js) and the built-in toolkit categories.", presetsH2: "Discover available tools" },
  vi: { p1: "Quản lý Skills (công cụ) và khám phá những gì có thể gắn vào một Staff. Xem ", p1b: " để biết hai loại Skill (integration và custom-js) cùng các nhóm toolkit có sẵn.", presetsH2: "Khám phá các công cụ có sẵn" },
  zh: { p1: "管理 Skills（工具），并查看有哪些可绑定到 Staff 的工具。关于两种 Skill 类型（integration 与 custom-js）及内置工具包分类，参见 ", p1b: "。", presetsH2: "查看可用工具" },
  ja: { p1: "Skills（ツール）を管理し、Staff に紐づけられるツールを確認します。Skill の 2 種類（integration と custom-js）と組み込みツールキットのカテゴリについては ", p1b: " を参照。", presetsH2: "利用可能なツールを確認する" },
} as const;

export default function ApiSkillsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Skills API</H1>
      <P>{t.p1}<DocLink id="skills" onNavigate={onNavigate}>Skills</DocLink>{t.p1b}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/skills" desc="List all skills" />
        <ApiRow method="GET" path="/api/v1/skills/tools" desc="List built-in tool_name values" />
        <ApiRow method="GET" path="/api/v1/skills/tool-presets" desc="List tool presets (name/description/config shape per built-in tool)" />
        <ApiRow method="POST" path="/api/v1/skills" desc="Create a skill, or update one if id is present in the body" />
        <ApiRow method="DELETE" path="/api/v1/skills/{id}" desc="Delete a skill" />
      </div>
      <H2>{t.presetsH2}</H2>
      <CodeBlock lang="bash" code={`curl http://localhost:8000/api/v1/skills/tools\ncurl http://localhost:8000/api/v1/skills/tool-presets`} />
      <CodeBlock lang="json" title="POST /api/v1/skills — custom-js skill" code={`{\n  "name": "Score Filter",\n  "description": "Keeps only items above a score threshold.",\n  "kind": "custom-js",\n  "third_party": "",\n  "config": {},\n  "code": "function run(input) { return JSON.parse(input).filter(i => i.score > 0.8); }"\n}`} />
      <CodeBlock lang="json" title="Response — 200 OK" code={`{\n  "id": "skill_score_filter",\n  "name": "Score Filter",\n  "description": "Keeps only items above a score threshold.",\n  "kind": "custom-js",\n  "third_party": "",\n  "config": {},\n  "tool_name": null,\n  "code": "function run(input) { return JSON.parse(input).filter(i => i.score > 0.8); }",\n  "owner_id": "company_42"\n}`} />
    </div>
  );
}
