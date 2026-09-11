import { H1, H2, P, OL, OLI, Callout, CodeBlock, ApiRow, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro1: "A company organizes work along two independent axes, and it's easy to conflate them at first. A Department decides who runs a Task and how — which Staff are involved and which of the six topologies coordinates them. A Project decides where that same Task sits — which backlog it belongs to, which epic and sprint it's part of, and what its issue key is. Neither axis knows about the other: a Department has no idea what project its tasks are filed under, and a Project has no idea whether its tasks run sequentially or get argued over by a mesh of five specialists.",
    intro2: "A concrete example makes this click: imagine a Task titled \"Fix the checkout timeout bug.\" It's executed by the Engineering Department, running in supervisor mode — a lead Staff delegates investigation to a backend specialist and verification to a QA Staff. Separately, that same Task is filed under the NUC project, tagged as a bug in Sprint 4. Change the Department's topology from supervisor to sequential tomorrow and the Task's place in Sprint 4 doesn't move an inch — the two systems are genuinely orthogonal.",
    issueH2: "A Task is the Issue",
    issueP: "There's no separate \"Issue\" entity bolted on top. The domain model stays Task — the exact same entity the run engine, task queue, and knowledge graph already operate on — but it grows Jira-style fields the moment it's attached to a project: project_id, issue_type (epic | story | task | bug | subtask), issue_key (\"NUC-42\", assigned once at creation from the project's counter), epic_id, sprint_id, story_points. A Task that was never attached to a project simply leaves all of these at their defaults; it still runs exactly the same way. See ", // continues DocLink
    tasksLink: "Tasks",
    issueP2: " for the full Task schema and status lifecycle.",
    schemaH2: "Schema",
    schemaP: "Project owns the key namespace; Epic and Sprint both belong to exactly one Project and reuse its issue_counter for key numbering, which is why issue keys never collide within a project even as epics and sprints are created and deleted around them.",
    plannerH2: "The AI planner",
    plannerP: "Turning a vague goal into a concrete list of tasks is itself something a Staff member can help with. Each project can name a planner_staff_id — the Staff responsible for breaking a goal down — plus an optional planner_system_prompt override that tunes how it reasons about scope and granularity. The flow is deliberately two steps, so nothing gets written to your backlog without a human looking at it first:",
    plannerSteps: [
      { h: "You describe a goal.", d: "For example: \"Ship a CSV export for the analytics dashboard.\" This is sent to POST /api/v1/planner/decompose along with the project id." },
      { h: "The planner staff proposes a breakdown.", d: "It returns a list of candidate tasks — titles, descriptions, suggested epic/sprint placement — reasoning the way any experienced project lead would. Nothing is persisted yet; this is a preview." },
      { h: "You review and edit the proposal.", d: "Rename a task, merge two that are really one, delete one that's out of scope, reassign which sprint something lands in — the response is just JSON you can freely modify before the next step." },
      { h: "You commit.", d: "POST /api/v1/planner/commit sends back the (possibly edited) proposal. This is the step that actually creates the Task rows, assigning issue keys in order from the project's counter." },
    ],
    plannerNote: "Because decompose and commit are separate calls, you can also build your own UI around just the decompose step — use the planner purely as a brainstorming aid and create tasks by hand instead.",
    restH2: "REST API",
    nextH2: "Next",
    nextTasks: "The full Task schema, status lifecycle, and history semantics.",
    nextDepartments: "How a Department actually executes the tasks a Project tracks.",
  },
  vi: {
    intro1: "Một công ty tổ chức công việc theo hai trục độc lập, và lúc đầu rất dễ nhầm lẫn giữa chúng. Department quyết định ai chạy một Task và chạy như thế nào — Staff nào tham gia và topology nào trong sáu loại điều phối họ. Project quyết định chính Task đó nằm ở đâu — thuộc backlog nào, thuộc epic và sprint nào, và issue key của nó là gì. Không trục nào biết về trục kia: một Department không hề biết task của nó được xếp vào project nào, và một Project không hề biết task của nó chạy tuần tự hay bị tranh luận bởi một mesh gồm năm chuyên gia.",
    intro2: "Một ví dụ cụ thể sẽ giúp dễ hình dung: hãy tưởng tượng một Task có tiêu đề \"Sửa lỗi timeout khi thanh toán.\" Nó được thực thi bởi Department Engineering, chạy ở chế độ supervisor — một Staff lead ủy thác việc điều tra cho một chuyên gia backend và việc kiểm tra cho một Staff QA. Song song đó, chính Task này được xếp vào project NUC, gắn nhãn là bug trong Sprint 4. Ngày mai đổi topology của Department từ supervisor sang sequential thì vị trí của Task trong Sprint 4 không hề thay đổi — hai hệ thống thực sự độc lập với nhau.",
    issueH2: "Task chính là Issue",
    issueP: "Không có entity \"Issue\" riêng biệt được gắn thêm vào. Domain model vẫn là Task — chính entity mà run engine, task queue, và knowledge graph đang thao tác — nhưng nó có thêm các trường kiểu Jira ngay khi được gắn vào một project: project_id, issue_type (epic | story | task | bug | subtask), issue_key (\"NUC-42\", được gán một lần khi tạo, lấy từ bộ đếm của project), epic_id, sprint_id, story_points. Một Task chưa từng được gắn vào project đơn giản là giữ nguyên các trường này ở giá trị mặc định; nó vẫn chạy y hệt như bình thường. Xem ",
    tasksLink: "Tasks",
    issueP2: " để biết đầy đủ schema và vòng đời trạng thái của Task.",
    schemaH2: "Schema",
    schemaP: "Project sở hữu không gian tên key; Epic và Sprint đều thuộc về đúng một Project và dùng chung issue_counter của project đó để đánh số key, đó là lý do issue key không bao giờ trùng nhau trong một project dù epic và sprint có được tạo và xóa liên tục xung quanh nó.",
    plannerH2: "AI planner",
    plannerP: "Biến một mục tiêu mơ hồ thành một danh sách task cụ thể cũng là điều mà một Staff có thể giúp. Mỗi project có thể chỉ định planner_staff_id — Staff chịu trách nhiệm chia nhỏ mục tiêu — cùng với planner_system_prompt tùy chọn để tinh chỉnh cách nó suy luận về phạm vi và độ chi tiết. Quy trình cố tình chia làm hai bước, để không có gì được ghi vào backlog của bạn mà chưa qua mắt người xem trước:",
    plannerSteps: [
      { h: "Bạn mô tả một mục tiêu.", d: "Ví dụ: \"Xuất CSV cho dashboard phân tích.\" Nội dung này được gửi tới POST /api/v1/planner/decompose kèm id của project." },
      { h: "Planner staff đề xuất một bản chia nhỏ.", d: "Nó trả về danh sách các task ứng viên — tiêu đề, mô tả, epic/sprint gợi ý — suy luận theo cách một project lead giàu kinh nghiệm sẽ làm. Chưa có gì được lưu; đây chỉ là bản xem trước." },
      { h: "Bạn xem lại và chỉnh sửa đề xuất.", d: "Đổi tên một task, gộp hai task thực chất là một, xóa một task nằm ngoài phạm vi, đổi sprint mà một task sẽ thuộc về — phản hồi chỉ là JSON mà bạn có thể tự do chỉnh trước bước tiếp theo." },
      { h: "Bạn commit.", d: "POST /api/v1/planner/commit gửi lại đề xuất (có thể đã chỉnh sửa). Đây là bước thực sự tạo ra các dòng Task, gán issue key lần lượt từ bộ đếm của project." },
    ],
    plannerNote: "Vì decompose và commit là hai lệnh gọi tách biệt, bạn cũng có thể xây UI riêng chỉ quanh bước decompose — dùng planner thuần túy như một công cụ hỗ trợ brainstorm và tự tay tạo task theo cách khác.",
    restH2: "REST API",
    nextH2: "Tiếp theo",
    nextTasks: "Toàn bộ schema Task, vòng đời trạng thái, và ngữ nghĩa lịch sử.",
    nextDepartments: "Cách một Department thực sự thực thi các task mà Project theo dõi.",
  },
  zh: {
    intro1: "一家公司沿着两个独立的维度组织工作，起初很容易把它们混为一谈。Department 决定谁来运行一个 Task 以及如何运行——涉及哪些 Staff，由六种拓扑中的哪一种来协调它们。Project 决定同一个 Task 位于何处——属于哪个 backlog，属于哪个 epic 和 sprint，issue key 是什么。两个维度互不知晓：Department 完全不知道自己的任务归属于哪个 project，Project 也完全不知道自己的任务是按顺序执行，还是被五位专家组成的 mesh 反复讨论。",
    intro2: "一个具体例子会让这一点一目了然：假设有一个标题为\"修复结账超时 bug\"的 Task。它由 Engineering Department 执行，运行在 supervisor 模式下——一位 lead 员工把调查工作委派给一位后端专家，把验证工作委派给一位 QA 员工。与此同时，这同一个 Task 被归档在 NUC project 下，在 Sprint 4 中被标记为 bug。明天把 Department 的拓扑从 supervisor 改成 sequential，这个 Task 在 Sprint 4 中的位置丝毫不会变化——这两个系统确实是正交的。",
    issueH2: "Task 就是 Issue",
    issueP: "并没有额外挂载一个独立的\"Issue\"实体。领域模型仍然是 Task——与运行引擎、任务队列、知识图谱所操作的是同一个实体——但一旦关联到某个 project，它会立刻获得 Jira 风格的字段：project_id、issue_type（epic | story | task | bug | subtask）、issue_key（如\"NUC-42\"，创建时从项目计数器分配一次）、epic_id、sprint_id、story_points。一个从未关联过 project 的 Task 只是把这些字段保留为默认值；它的运行方式完全不受影响。完整的 Task schema 与状态生命周期见",
    tasksLink: "Tasks",
    issueP2: "页面。",
    schemaH2: "数据结构",
    schemaP: "Project 拥有 key 命名空间；Epic 和 Sprint 都归属于唯一一个 Project，并复用其 issue_counter 来编号 key，这也是为什么即使 epic 和 sprint 不断被创建和删除，issue key 在一个 project 内也永远不会冲突。",
    plannerH2: "AI 规划助手（Planner）",
    plannerP: "把一个模糊的目标变成一份具体的任务清单，本身也是 Staff 可以协助完成的事。每个 project 都可以指定 planner_staff_id——负责拆解目标的 Staff——以及可选的 planner_system_prompt 覆盖项，用来调整它在范围和粒度上的推理方式。流程被有意设计为两步，确保在有人过目之前不会有任何内容写入您的 backlog：",
    plannerSteps: [
      { h: "您描述一个目标。", d: "例如：\"为分析仪表盘做一个 CSV 导出功能。\"这会连同 project id 一起发送给 POST /api/v1/planner/decompose。" },
      { h: "planner staff 提出拆解方案。", d: "它返回一份候选任务列表——标题、描述、建议的 epic/sprint 归属——推理方式就像一位经验丰富的项目负责人。此时尚未持久化任何内容，这只是一次预览。" },
      { h: "您审阅并编辑该方案。", d: "重命名某个任务、合并两个实际上是一回事的任务、删除一个超出范围的任务、改变某项任务所属的 sprint——响应只是 JSON，您可以在下一步之前自由修改。" },
      { h: "您提交（commit）。", d: "POST /api/v1/planner/commit 回传（可能已编辑的）方案。这一步才会真正创建 Task 记录，并按顺序从 project 的计数器分配 issue key。" },
    ],
    plannerNote: "由于 decompose 和 commit 是两个独立的调用，您也可以只围绕 decompose 步骤构建自己的界面——把 planner 纯粹当作头脑风暴辅助工具，再手动创建任务。",
    restH2: "REST API",
    nextH2: "下一步",
    nextTasks: "完整的 Task schema、状态生命周期和历史语义。",
    nextDepartments: "Department 究竟如何执行 Project 所追踪的任务。",
  },
  ja: {
    intro1: "会社は 2 つの独立した軸に沿って作業を整理します。最初はこの 2 つを混同しがちです。Department は誰が Task を実行するか、どう実行するかを決めます——どの Staff が関与し、6 つのトポロジーのどれが彼らを調整するか。Project は同じ Task がどこに位置するかを決めます——どの backlog に属し、どの epic・sprint の一部で、issue key は何かを。どちらの軸も互いのことを知りません。Department は自分のタスクがどの project に紐づいているか知りませんし、Project は自分のタスクが逐次実行されるのか、5 人の専門家からなる mesh で議論されるのかを知りません。",
    intro2: "具体例で見るとはっきりします。「チェックアウトのタイムアウトバグを修正する」というタイトルの Task があるとします。これは Engineering Department によって、supervisor モードで実行されます——lead スタッフが調査をバックエンド担当に、検証を QA スタッフに委任します。それとは別に、同じ Task は NUC project の下に、Sprint 4 内で bug として登録されています。明日 Department のトポロジーを supervisor から sequential に変更しても、Sprint 4 内でのこの Task の位置は 1 ミリも動きません——2 つのシステムは本当に直交しています。",
    issueH2: "Task が Issue そのもの",
    issueP: "後付けの独立した「Issue」エンティティは存在しません。ドメインモデルは引き続き Task のままです——実行エンジン、タスクキュー、ナレッジグラフが操作するのとまったく同じエンティティです——ただし project に紐づいた瞬間に Jira スタイルのフィールドが加わります：project_id、issue_type（epic | story | task | bug | subtask）、issue_key（作成時に project のカウンターから一度だけ割り当てられる「NUC-42」など）、epic_id、sprint_id、story_points。project に一度も紐づいたことがない Task は、単にこれらのフィールドをデフォルト値のままにしているだけで、実行のされ方はまったく変わりません。Task の完全なスキーマとステータスのライフサイクルは",
    tasksLink: "Tasks",
    issueP2: "ページを参照してください。",
    schemaH2: "スキーマ",
    schemaP: "Project が key の名前空間を持ちます。Epic と Sprint はいずれもちょうど 1 つの Project に属し、その issue_counter を共有して key を採番します。だからこそ、epic や sprint が作成・削除され続けても、1 つの project 内で issue key が衝突することはありません。",
    plannerH2: "AI プランナー",
    plannerP: "曖昧な目標を具体的なタスクのリストに変えること自体も、Staff が助けてくれる領域です。各 project には planner_staff_id（目標を分解する担当 Staff）と、スコープや粒度についての推論を調整する任意の planner_system_prompt 上書きを設定できます。フローは意図的に 2 ステップに分かれており、人間が確認するまでは backlog に何も書き込まれません。",
    plannerSteps: [
      { h: "目標を記述します。", d: "例：「分析ダッシュボード用に CSV エクスポートを実装する」。これは project id とともに POST /api/v1/planner/decompose に送信されます。" },
      { h: "planner staff が分解案を提案します。", d: "候補タスクのリスト——タイトル、説明、推奨される epic/sprint への配置——を、経験豊富なプロジェクトリードのように推論して返します。この時点ではまだ何も保存されません。これはプレビューです。" },
      { h: "提案を確認・編集します。", d: "タスクの名前を変更したり、実質同じ 2 つのタスクを統合したり、範囲外のタスクを削除したり、あるタスクが属する sprint を変更したり——レスポンスは単なる JSON なので、次のステップの前に自由に修正できます。" },
      { h: "commit します。", d: "POST /api/v1/planner/commit は（編集済みかもしれない）提案を送り返します。これが実際に Task レコードを作成し、project のカウンターから順に issue key を割り当てるステップです。" },
    ],
    plannerNote: "decompose と commit は別々の呼び出しなので、decompose ステップだけを使って独自の UI を構築することもできます——プランナーを純粋にブレインストーミングの補助として使い、タスクは手動で作成するという使い方も可能です。",
    restH2: "REST API",
    nextH2: "次に読む",
    nextTasks: "Task の完全なスキーマ、ステータスのライフサイクル、履歴の扱い。",
    nextDepartments: "Project が追跡するタスクを Department が実際にどう実行するか。",
  },
} as const;

export default function ProjectsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Projects</H1>
      <P>{t.intro1}</P>
      <P>{t.intro2}</P>

      <H2>{t.issueH2}</H2>
      <P>
        {t.issueP}
        <DocLink id="tasks" onNavigate={onNavigate}>{t.tasksLink}</DocLink>
        {t.issueP2}
      </P>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Project:\n    id: str\n    key: str                    # "NUC" — uppercase, unique within owner scope\n    name: str\n    description: str = ""\n    lead_id: str = ""           # Staff id acting as project lead\n    planner_staff_id: str = ""  # which Staff is the configurable AI "planner"\n    planner_system_prompt: str = ""\n    issue_counter: int = 0      # monotonic source of the "-N" suffix in issue keys\n    created_at: datetime | None = None\n    owner_id: str = "default"\n    company_id: str = ""\n\n@dataclass(frozen=True, slots=True)\nclass Epic:\n    id: str\n    project_id: str\n    key: str                    # reuses the project's issue counter, e.g. "NUC-1"\n    title: str\n    description: str = ""\n    status: TaskStatus = TaskStatus.pending\n    color: str = ""\n    start_date: datetime | None = None\n    due_date: datetime | None = None\n    owner_id: str = "default"\n\n@dataclass(frozen=True, slots=True)\nclass Sprint:\n    id: str\n    project_id: str\n    name: str\n    goal: str = ""\n    status: SprintStatus = SprintStatus.planned   # planned | active | completed\n    start_date: datetime | None = None\n    end_date: datetime | None = None\n    owner_id: str = "default"`} />

      <H2>{t.plannerH2}</H2>
      <P>{t.plannerP}</P>
      <OL>
        {t.plannerSteps.map(({ h, d }, i) => (
          <OLI key={h} n={i + 1}><strong>{h}</strong> {d}</OLI>
        ))}
      </OL>
      <Callout type="tip">{t.plannerNote}</Callout>

      <H2>{t.restH2}</H2>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/projects" desc="List projects" />
        <ApiRow method="POST" path="/api/v1/projects" desc="Create or update a project (id in body = update)" />
        <ApiRow method="DELETE" path="/api/v1/projects/:id" desc="Delete project" />
        <ApiRow method="GET" path="/api/v1/epics" desc="List epics" />
        <ApiRow method="POST" path="/api/v1/epics" desc="Create or update an epic" />
        <ApiRow method="DELETE" path="/api/v1/epics/:id" desc="Delete epic" />
        <ApiRow method="GET" path="/api/v1/sprints" desc="List sprints" />
        <ApiRow method="POST" path="/api/v1/sprints" desc="Create or update a sprint" />
        <ApiRow method="DELETE" path="/api/v1/sprints/:id" desc="Delete sprint" />
        <ApiRow method="POST" path="/api/v1/planner/decompose" desc="Propose a task breakdown for a goal (no writes)" />
        <ApiRow method="POST" path="/api/v1/planner/commit" desc="Create the approved tasks with issue keys" />
      </div>
      <CodeBlock lang="bash" title="Create a project" code={`curl -X POST http://localhost:8000/api/v1/projects \\\n  -H "Content-Type: application/json" \\\n  -d '{"key":"NUC","name":"Nucleus Revamp","company_id":"company_abc"}'`} />

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="tasks" onNavigate={onNavigate} title="Tasks" desc={t.nextTasks} />
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={t.nextDepartments} />
      </NextSteps>
    </div>
  );
}
