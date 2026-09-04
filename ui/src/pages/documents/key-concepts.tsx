import { Building2, Users, UserCircle, Wrench, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { H1, H2, P, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const ICONS = [
  { icon: Building2, color: "text-sky-500 bg-sky-500/10" },
  { icon: Users, color: "text-violet-500 bg-violet-500/10" },
  { icon: UserCircle, color: "text-amber-500 bg-amber-500/10" },
  { icon: Wrench, color: "text-emerald-500 bg-emerald-500/10" },
  { icon: CheckSquare, color: "text-cyan-500 bg-cyan-500/10" },
];

const TXT = {
  en: {
    intro: "Five concepts make up the object model. Everything else in the product — the AI Office Designer, Recruiting, the Task Board — is built on top of these five.",
    composeH2: "How they compose",
    composeP: "The five nest inside each other in a single chain: a Company owns Departments, a Department owns (a subset of) Staff and gives them a topology, a Staff member is given Skills so it can act instead of just talk, and all of that machinery exists to move a Task from pending to completed. Nothing here is optional plumbing — delete any one link and the chain doesn't work: a Staff with no Department never runs, a Department with no topology has no way to decide who speaks, a Task with no assigned Department or Staff has nobody to do it.",
    concepts: [
      { title: "Company", desc: "An isolated organization. Has a type (software, marketing, research, or general) that seeds its suggested structure without ever restricting it, and owns a set of Departments, Projects, and a Document Library. All of a company's data — staff, tasks, history — is scoped away from every other company.", nuance: "\"Isolated\" is literal, not just visual: every entity carries an owner_id, and a company only ever sees rows scoped to it (plus the shared \"default\" catalog it can clone from)." },
      { title: "Department", desc: "A group of Staff plus a topology (mode: sequential, ring, mesh, supervisor, tree, or custom) that decides how those Staff hand off work to each other during a run. A Department also caps run length via max_steps.", nuance: "The topology is not a label on top of a generic loop — each mode is its own compiled LangGraph state machine, so switching modes genuinely changes how state moves between staff, not just the order they're called in." },
      { title: "Staff", desc: "One AI worker: a role, a system prompt, and a bound list of Skills. A Staff member is never run standalone — it's always a node inside a Department's topology graph, and can optionally spawn subagents for concurrent sub-work.", nuance: "role has no fixed vocabulary — it's a plain string, so a Staff for a research lab and a Staff for a marketing agency can look nothing alike." },
      { title: "Skill", desc: "A bound tool or integration — a preset toolkit (web search, Google Sheets, a messaging platform, ...) or a custom-JS function — attached to a Staff member so it can act, not just talk.", nuance: "MCP servers plug in as just another Skill (tool_name = \"mcp\"), so connecting a new external service rarely means writing new integration code." },
      { title: "Task", desc: "The unit of work a Department or Staff runs against. A Task is also the Jira-style Issue in the project hierarchy: it can belong to a Project, an Epic, and a Sprint, and carries priority, labels, and a comment thread.", nuance: "Restarting a stopped or completed Task preserves its message history and knowledge graph — a session divider is appended, nothing is wiped, unless you explicitly call the history-wipe endpoint." },
    ],
    nextStaff: "Every field on the Staff schema, and how status changes live during a run.",
    nextDepartments: "The six topologies in full, with a concrete status walkthrough.",
    nextTasks: "The full status lifecycle, priorities, and the Project/Epic/Sprint hierarchy.",
  },
  vi: {
    intro: "Năm khái niệm tạo nên mô hình đối tượng của sản phẩm. Mọi thứ khác — AI Office Designer, Recruiting, Task Board — đều được xây dựng dựa trên năm khái niệm này.",
    composeH2: "Chúng ghép với nhau như thế nào",
    composeP: "Năm khái niệm lồng vào nhau theo một chuỗi duy nhất: một Company sở hữu các Department, một Department sở hữu (một phần) Staff và cho chúng một topology, một Staff được cấp Skills để có thể hành động thay vì chỉ trò chuyện, và toàn bộ cỗ máy đó tồn tại để đưa một Task từ pending đến completed. Không có gì ở đây là phụ tùng tùy chọn — bỏ đi bất kỳ mắt xích nào thì chuỗi không hoạt động: một Staff không có Department thì không bao giờ chạy, một Department không có topology thì không có cách nào quyết định ai lên tiếng, một Task không có Department hay Staff được gán thì không ai làm cả.",
    concepts: [
      { title: "Company", desc: "Một tổ chức được cách ly riêng. Có một type (software, marketing, research, hoặc general) gợi ý cấu trúc mà không bao giờ giới hạn nó, và sở hữu một tập các Department, Project, cùng một Document Library. Toàn bộ dữ liệu của một company — staff, task, lịch sử — được tách biệt khỏi mọi company khác.", nuance: "\"Cách ly\" là theo nghĩa đen, không chỉ là hiển thị: mọi entity đều mang một owner_id, và một company chỉ bao giờ thấy các dòng thuộc phạm vi của nó (cộng với catalog dùng chung \"default\" mà nó có thể clone)." },
      { title: "Department", desc: "Một nhóm Staff cùng một topology (mode: sequential, ring, mesh, supervisor, tree, hoặc custom) quyết định cách các Staff đó chuyển giao công việc cho nhau trong một phiên chạy. Department cũng giới hạn độ dài phiên chạy qua max_steps.", nuance: "Topology không phải một cái nhãn dán lên một vòng lặp chung — mỗi mode là một cỗ máy trạng thái LangGraph được biên dịch riêng, nên đổi mode thực sự thay đổi cách trạng thái di chuyển giữa các staff, không chỉ thứ tự chúng được gọi." },
      { title: "Staff", desc: "Một nhân sự AI: có role, system prompt, và một danh sách Skills được gắn kèm. Staff không bao giờ chạy độc lập — luôn là một node trong đồ thị topology của một Department, và có thể tùy chọn sinh subagent để xử lý công việc song song.", nuance: "role không có từ vựng cố định — nó là một chuỗi văn bản thuần, nên một Staff cho phòng nghiên cứu và một Staff cho agency marketing có thể trông hoàn toàn khác nhau." },
      { title: "Skill", desc: "Một công cụ hoặc tích hợp được gắn vào — một bộ công cụ dựng sẵn (tìm kiếm web, Google Sheets, một nền tảng nhắn tin, ...) hoặc một hàm custom-JS — gắn cho một Staff để staff đó có thể hành động, không chỉ trò chuyện.", nuance: "MCP server cắm vào chỉ như một Skill khác (tool_name = \"mcp\"), nên kết nối một dịch vụ ngoài mới hiếm khi cần viết code tích hợp mới." },
      { title: "Task", desc: "Đơn vị công việc mà một Department hoặc Staff thực thi. Task cũng chính là Issue kiểu Jira trong cây phân cấp dự án: có thể thuộc về một Project, một Epic, và một Sprint, mang theo priority, label, và một luồng bình luận.", nuance: "Khởi động lại một Task đã dừng hoặc hoàn thành sẽ giữ nguyên lịch sử tin nhắn và knowledge graph của nó — một session divider được thêm vào, không có gì bị xóa, trừ khi bạn gọi tường minh endpoint xóa lịch sử." },
    ],
    nextStaff: "Mọi trường trong schema Staff, và cách status thay đổi trực tiếp trong một phiên chạy.",
    nextDepartments: "Đầy đủ sáu topology, kèm một ví dụ status cụ thể.",
    nextTasks: "Toàn bộ vòng đời status, priority, và cây phân cấp Project/Epic/Sprint.",
  },
  zh: {
    intro: "对象模型由五个核心概念组成。产品中的其他一切——AI Office Designer、Recruiting、Task Board——都建立在这五者之上。",
    composeH2: "它们如何组合在一起",
    composeP: "这五个概念以单一链条相互嵌套：一家 Company 拥有若干 Department，一个 Department 拥有（一部分）Staff 并赋予他们一种拓扑，一个 Staff 被赋予 Skills 以便能够行动而不仅仅是对话，而这整套机制存在的目的，就是把一个 Task 从 pending 推进到 completed。这里没有任何一环是可有可无的：去掉任何一环，链条都无法运转——没有 Department 的 Staff 永远不会运行，没有拓扑的 Department 无法决定谁来发言，没有指派 Department 或 Staff 的 Task 无人执行。",
    concepts: [
      { title: "Company（公司）", desc: "一个相互隔离的组织。拥有一个 type（software、marketing、research 或 general），为其提供建议结构而绝不加以限制，并拥有一组 Department、Project 以及一个 Document Library。一家公司的全部数据——员工、任务、历史记录——都与其他任何公司相互隔离。", nuance: "\"隔离\"是字面意义上的，而不仅仅是界面层面的：每个实体都带有 owner_id，一家公司只能看到属于自己范围的记录（加上它可以克隆的共享\"default\"目录）。" },
      { title: "Department（部门）", desc: "一组 Staff 加上一种拓扑（mode：sequential、ring、mesh、supervisor、tree 或 custom），决定这些 Staff 在一次运行中如何交接工作。Department 还通过 max_steps 限制运行长度。", nuance: "拓扑并不是贴在一个通用循环之上的标签——每种模式都是各自独立编译的 LangGraph 状态机，因此切换模式真正改变的是状态在员工之间如何流动，而不仅仅是调用顺序。" },
      { title: "Staff（员工）", desc: "一个 AI 工作者：拥有角色、系统提示词，以及一份绑定的 Skills 列表。Staff 从不单独运行——始终是某个 Department 拓扑图中的一个节点，并可以选择性地生成子智能体以并发处理子工作。", nuance: "role 没有固定词汇表——它只是一个纯字符串，因此研究实验室的员工和营销代理机构的员工可以完全不同。" },
      { title: "Skill（技能）", desc: "一个被绑定的工具或集成——一个预设工具包（网页搜索、Google 表格、某个消息平台……）或一段自定义 JS 函数——附加到某个 Staff 上，使其能够“行动”而不仅仅是“对话”。", nuance: "MCP 服务器以完全相同的方式接入——只是另一种 Skill（tool_name = \"mcp\"）——因此接入一项新的外部服务通常不需要编写新的集成代码。" },
      { title: "Task（任务）", desc: "Department 或 Staff 执行的工作单元。Task 同时也是项目层级中 Jira 风格的 Issue：可以归属于某个 Project、Epic 和 Sprint，并带有优先级、标签与评论线程。", nuance: "重启一个已停止或已完成的 Task 会保留其消息历史和知识图谱——只会追加一条会话分隔记录，除非您显式调用历史清除接口，否则不会清空任何内容。" },
    ],
    nextStaff: "Staff 数据结构的每一个字段，以及运行期间 status 如何实时变化。",
    nextDepartments: "完整的六种拓扑，附带一个具体的状态走查示例。",
    nextTasks: "完整的状态生命周期、优先级，以及 Project/Epic/Sprint 层级结构。",
  },
  ja: {
    intro: "オブジェクトモデルは 5 つの概念で構成されます。AI Office Designer、Recruiting、Task Board など製品内のその他すべては、この 5 つの上に成り立っています。",
    composeH2: "5 つがどう組み合わさるか",
    composeP: "この 5 つは 1 本の連鎖として入れ子になっています。Company が Department を所有し、Department が（一部の）Staff を所有してトポロジーを与え、Staff は会話するだけでなく行動できるよう Skills を与えられ、そしてこの仕組み全体は Task を pending から completed へ進めるために存在します。ここには不要な配管は 1 つもありません——どれか 1 つの輪を外すと連鎖は機能しなくなります。Department のない Staff は決して実行されず、トポロジーのない Department は誰が発言するか決められず、Department や Staff が割り当てられていない Task は誰も実行しません。",
    concepts: [
      { title: "Company", desc: "分離された組織。type（software、marketing、research、general）を持ち、これは推奨構成の種となるだけで何かを制限することはありません。一連の Department、Project、および Document Library を所有します。会社のすべてのデータ（スタッフ、タスク、履歴）は他の会社から完全に分離されています。", nuance: "「分離」は見た目だけでなく文字通りの意味です。すべてのエンティティは owner_id を持ち、ある会社は自分のスコープに属する行（と、クローン元となる共有の \"default\" カタログ）しか見えません。" },
      { title: "Department", desc: "Staff のグループと、実行中にそれらの Staff がどのように作業を受け渡すかを決めるトポロジー（mode：sequential、ring、mesh、supervisor、tree、custom）。Department は max_steps によって実行の長さも制限します。", nuance: "トポロジーは汎用ループの上に貼られたラベルではありません——各モードはそれぞれ独立してコンパイルされた LangGraph ステートマシンであり、モードを切り替えると呼び出し順序だけでなく、スタッフ間で状態がどう移動するかが本質的に変わります。" },
      { title: "Staff", desc: "1 人の AI ワーカー：役割、システムプロンプト、そして紐づけられた Skills のリストを持ちます。Staff が単独で実行されることはなく、常に Department のトポロジーグラフ内の 1 ノードであり、任意でサブエージェントを生成して並行作業を行えます。", nuance: "role に固定の語彙はありません——単なる文字列なので、研究ラボ向けの Staff とマーケティングエージェンシー向けの Staff はまったく異なる見た目になり得ます。" },
      { title: "Skill", desc: "紐づけられたツールまたは連携——プリセットのツールキット（Web 検索、Google スプレッドシート、メッセージングプラットフォームなど）またはカスタム JS 関数——を Staff に付与し、会話するだけでなく行動できるようにします。", nuance: "MCP サーバーも単なる別の Skill（tool_name = \"mcp\"）として接続されるため、新しい外部サービスを繋ぐのに新しい連携コードを書く必要はほとんどありません。" },
      { title: "Task", desc: "Department や Staff が実行する作業単位。Task はプロジェクト階層における Jira 風の Issue でもあり、Project・Epic・Sprint に属し、優先度、ラベル、コメントスレッドを持ちます。", nuance: "停止済みまたは完了済みの Task を再開すると、メッセージ履歴とナレッジグラフはそのまま保持されます——セッション区切りが追加されるだけで、履歴削除エンドポイントを明示的に呼ばない限り何も消去されません。" },
    ],
    nextStaff: "Staff スキーマの全フィールドと、実行中に status がどうリアルタイムに変化するか。",
    nextDepartments: "6 つのトポロジーの詳細と、具体的なステータスの流れ。",
    nextTasks: "完全なステータスライフサイクル、優先度、Project/Epic/Sprint 階層。",
  },
} as const;

export default function KeyConceptsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Key Concepts</H1>
      <P>{t.intro}</P>

      <H2>{t.composeH2}</H2>
      <P>{t.composeP}</P>

      <div className="space-y-4 my-5">
        {t.concepts.map(({ title, desc, nuance }, i) => {
          const { icon: Icon, color } = ICONS[i];
          return (
            <div key={title} className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-4 h-4" strokeWidth={2} />
              </div>
              <div>
                <div className="font-bold text-sm mb-1">{title}</div>
                <div className="text-[13px] text-muted-foreground leading-relaxed mb-1.5">{desc}</div>
                <div className="text-[13px] text-foreground/70 leading-relaxed italic">{nuance}</div>
              </div>
            </div>
          );
        })}
      </div>

      <NextSteps>
        <NextStepCard id="staff" onNavigate={onNavigate} title="Staff" desc={t.nextStaff} />
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={t.nextDepartments} />
        <NextStepCard id="tasks" onNavigate={onNavigate} title="Tasks" desc={t.nextTasks} />
      </NextSteps>
    </div>
  );
}
