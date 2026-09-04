import { H1, P, ApiRow, CodeBlock, Callout, DocLink, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    p1: "A single-staff chat endpoint — send one prompt straight to one ",
    p1b: " member without going through a Department's topology at all. This is what powers the single-staff mode of the ",
    p1c: ".",
    note: "For a full department run — where a topology of staff hand off work to each other — use POST /api/v1/llm/staff-graph/run (blocking, returns the final state) or POST /api/v1/llm/staff-graph/run-stream (Server-Sent Events, turn-by-turn) instead of this endpoint.",
  },
  vi: {
    p1: "Một endpoint chat với một staff duy nhất — gửi thẳng một prompt đến một thành viên ",
    p1b: " mà không đi qua topology của Department nào cả. Đây là thứ vận hành chế độ chat một staff của ",
    p1c: ".",
    note: "Để chạy toàn bộ department — nơi topology của các staff chuyển giao công việc cho nhau — hãy dùng POST /api/v1/llm/staff-graph/run (đồng bộ, trả về trạng thái cuối cùng) hoặc POST /api/v1/llm/staff-graph/run-stream (Server-Sent Events, theo từng lượt) thay vì endpoint này.",
  },
  zh: {
    p1: "一个单员工聊天接口——将一条 prompt 直接发给某一位 ",
    p1b: " 成员，完全不经过任何 Department 拓扑。这正是 ",
    p1c: " 单员工模式背后的接口。",
    note: "如需完整的部门运行（多个员工按拓扑相互交接工作），请改用 POST /api/v1/llm/staff-graph/run（阻塞式，返回最终状态）或 POST /api/v1/llm/staff-graph/run-stream（Server-Sent Events，按回合流式返回），而不是这个接口。",
  },
  ja: {
    p1: "単一スタッフとのチャット用エンドポイントです。Department のトポロジーを一切経由せず、1 つのプロンプトを 1 人の ",
    p1b: " メンバーに直接送ります。これは ",
    p1c: " の単一スタッフモードを支えているエンドポイントです。",
    note: "トポロジーに沿って複数のスタッフが作業を受け渡す完全な部門実行には、このエンドポイントではなく POST /api/v1/llm/staff-graph/run（ブロッキング、最終状態を返す）または POST /api/v1/llm/staff-graph/run-stream（Server-Sent Events、ターンごと）を使ってください。",
  },
} as const;

export default function ApiChatDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Chat API</H1>
      <P>
        {t.p1}<DocLink id="staff" onNavigate={onNavigate}>Staff</DocLink>{t.p1b}
        <DocLink id="playground" onNavigate={onNavigate}>Playground</DocLink>{t.p1c}
      </P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="POST" path="/api/v1/llm/chat" desc="Send a prompt to a specific staff, get one response back" />
      </div>
      <CodeBlock lang="json" title="POST /api/v1/llm/chat" code={`{\n  "prompt": "What are the top Python web frameworks?",\n  "staffId": "staff_abc123"\n}`} />
      <CodeBlock lang="json" title="Response — 200 OK" code={`{\n  "response": "The most widely used are Django, FastAPI, and Flask...",\n  "staffId": "staff_abc123",\n  "toolCalls": []\n}`} />
      <Callout type="info">{t.note}</Callout>
    </div>
  );
}
