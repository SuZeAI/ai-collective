import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "A Task is a unit of work assigned to a Department (or a single Staff via assignee_id) and run through that department's topology. It's the thing that actually moves through idle → thinking → active status changes on the Staff involved, and the thing the run engine, the task queue, and the knowledge graph all key off of.",
    lead2: "A Task also has a second identity: it doubles as the \"Issue\" in a Jira-style Project → Epic/Sprint → Task hierarchy. Those two identities live on the exact same row — there's no separate Issue entity.",
    dualIdentityH2: "Why one entity, not two",
    dualIdentityP: "It would have been simpler, conceptually, to split \"the thing a Department executes\" from \"the thing a Project tracks\" into two models kept in sync. The domain model doesn't do that: a Task is a Task everywhere, and the Jira-style fields (project_id, issue_type, issue_key, epic_id, sprint_id, story_points) are just additional columns on it, empty by default. This means the run engine, the task queue, and the knowledge-graph extraction pipeline never have to know or care whether the Task in front of them happens to belong to a Project — they operate on exactly the same object either way. See ",
    dualIdentityLink: "Projects",
    dualIdentitySuffix: " for the Project/Epic/Sprint side of this.",

    schemaH2: "Schema",
    schemaP: "The domain model (server/domain/models.py). Everything above project_id drives execution; project_id and below are the Jira-style fields layered on top.",

    lifecycleH2: "Status lifecycle",
    lifecycleP: "status (TaskStatus) drives both the Task Board's columns and the run engine's behavior — it isn't just a UI label.",

    lifecycleWalkthroughH2: "A task's life, start to finish",
    lifecycleSteps: [
      "Created in pending. Nothing has run yet.",
      "Moved to in-progress — either manually or by the run engine picking it up. The assigned Department's topology starts executing, Staff cycle through idle/thinking/active as described in the Staff and Departments pages.",
      "Optionally paused mid-run (paused) and later resumed back to in-progress — the run engine picks up exactly where the topology left off.",
      "Reaches in-review — a manual column for human sign-off between execution finishing and the task being marked done.",
      "Marked completed. Or, if the run was aborted rather than finished, stopped instead.",
      "If you restart a completed or stopped task later — see the callout below — it goes straight back to in-progress, and nothing about steps 1-5 is lost.",
    ],
    restartCallout: "Restarting a completed or stopped task (POST /api/v1/tasks with status → \"in-progress\") does not wipe anything — message history and the knowledge graph are preserved, and a session-divider message is appended so it's clear in the transcript where the old run ended and the new one began. DELETE /api/v1/tasks/{id}/history is the separate, explicit, owner/admin-gated operation that actually wipes everything — restarting never does this implicitly.",

    fieldsH2: "Notable fields",
    fields: [
      { k: "priority", d: "TaskPriority — low | medium | high | urgent. A plain triage signal for the Task Board; it doesn't change execution order on its own." },
      { k: "assignee_id", d: "Set when the task is assigned to one Staff member rather than the whole department; department_id may be empty in that case, since there's no topology to route through — the assignee just handles it directly." },
      { k: "labels", d: "Freeform tags for filtering and grouping on the Task Board — no fixed taxonomy, same philosophy as Staff's role field." },
      { k: "comments", d: "A user-authored comment thread, kept deliberately separate from the Staff live-chat transcript recorded in Meetings — comments are people talking about the task, Meetings is the task talking to itself." },
      { k: "issue_type", d: "IssueType — epic | story | task | bug | subtask. A Task IS the Issue; issue_key (e.g. \"NUC-42\") is assigned once at create time from the owning Project's issue_counter." },
      { k: "story_points", d: "Optional effort estimate, standard Jira-style planning field — has no effect on execution, purely for planning/reporting." },
    ],

    graphH2: "Knowledge graph context",
    graphP: "Each task run builds a knowledge graph of entities and relationships extracted from the conversation. You can inspect what it currently knows directly, or check overall queue health across every task:",

    restH2: "REST API",
    restP: "POST doubles as create, update, or status change — pass id (and status, for a transition) in the body rather than looking for a separate PATCH or status-specific endpoint.",

    nextProjectsTitle: "Projects", nextProjects: "The Project → Epic/Sprint → Task hierarchy this Task can optionally belong to.",
    nextDeptTitle: "Departments", nextDept: "How the topology that executes a task's assigned_staff actually works.",
    nextMeetingsTitle: "Meetings", nextMeetings: "The Staff-to-Staff transcript a Task's run produces, separate from user comments.",
  },
  vi: {
    lead1: "Một Task là một đơn vị công việc được giao cho một Department (hoặc một Staff đơn lẻ qua assignee_id) và chạy qua topology của department đó. Đây là thứ thực sự di chuyển qua các thay đổi trạng thái idle → thinking → active trên các Staff liên quan, và là thứ mà run engine, task queue, và knowledge graph đều dựa vào.",
    lead2: "Task còn có một danh tính thứ hai: nó đồng thời là \"Issue\" trong hệ thống phân cấp kiểu Jira Project → Epic/Sprint → Task. Hai danh tính đó nằm trên đúng cùng một bản ghi — không có một entity Issue riêng biệt nào cả.",
    dualIdentityH2: "Vì sao là một entity, không phải hai",
    dualIdentityP: "Về mặt khái niệm, sẽ đơn giản hơn nếu tách \"thứ mà một Department thực thi\" khỏi \"thứ mà một Project theo dõi\" thành hai model được đồng bộ với nhau. Domain model không làm vậy: Task là Task ở khắp mọi nơi, và các trường kiểu Jira (project_id, issue_type, issue_key, epic_id, sprint_id, story_points) chỉ là các cột bổ sung trên đó, mặc định để trống. Điều này có nghĩa là run engine, task queue, và pipeline trích xuất knowledge graph không bao giờ phải biết hay quan tâm liệu Task trước mặt chúng có thuộc về một Project hay không — chúng thao tác trên đúng cùng một object trong cả hai trường hợp. Xem ",
    dualIdentityLink: "Projects",
    dualIdentitySuffix: " để biết về khía cạnh Project/Epic/Sprint.",

    schemaH2: "Schema",
    schemaP: "Domain model (server/domain/models.py). Mọi thứ phía trên project_id điều khiển việc thực thi; project_id trở xuống là các trường kiểu Jira được thêm vào phía trên.",

    lifecycleH2: "Vòng đời trạng thái",
    lifecycleP: "status (TaskStatus) điều khiển cả các cột trên Task Board lẫn hành vi của run engine — nó không chỉ là một nhãn UI.",

    lifecycleWalkthroughH2: "Vòng đời của một task, từ đầu tới cuối",
    lifecycleSteps: [
      "Được tạo ở trạng thái pending. Chưa có gì chạy cả.",
      "Chuyển sang in-progress — thủ công hoặc do run engine tự lấy lên. Topology của Department được giao bắt đầu thực thi, các Staff luân phiên qua idle/thinking/active như mô tả ở trang Staff và Departments.",
      "Có thể tạm dừng giữa chừng (paused) và sau đó tiếp tục quay lại in-progress — run engine tiếp tục đúng từ nơi topology đã dừng lại.",
      "Đạt tới in-review — một cột thủ công để con người phê duyệt giữa lúc thực thi xong và task được đánh dấu hoàn tất.",
      "Được đánh dấu completed. Hoặc, nếu phiên chạy bị huỷ giữa chừng thay vì hoàn tất, thì là stopped.",
      "Nếu bạn khởi động lại một task đã completed hoặc stopped sau đó — xem callout bên dưới — nó quay thẳng về in-progress, và không có gì ở các bước 1-5 bị mất.",
    ],
    restartCallout: "Khởi động lại một task đã hoàn thành hoặc đã dừng (POST /api/v1/tasks với status → \"in-progress\") không xoá bất cứ điều gì — lịch sử tin nhắn và knowledge graph được giữ nguyên, và một tin nhắn phân cách phiên (session-divider) được thêm vào để transcript thể hiện rõ phiên cũ kết thúc ở đâu và phiên mới bắt đầu từ đâu. DELETE /api/v1/tasks/{id}/history mới là thao tác riêng, tường minh, chỉ dành cho owner/admin, thực sự xoá mọi thứ — khởi động lại không bao giờ ngầm làm điều này.",

    fieldsH2: "Các trường đáng chú ý",
    fields: [
      { k: "priority", d: "TaskPriority — low | medium | high | urgent. Một tín hiệu phân loại đơn giản cho Task Board; tự nó không thay đổi thứ tự thực thi." },
      { k: "assignee_id", d: "Được đặt khi task được giao cho một Staff cụ thể thay vì cả department; trong trường hợp đó department_id có thể để trống, vì không có topology nào để định tuyến qua — người được giao xử lý trực tiếp." },
      { k: "labels", d: "Nhãn tự do để lọc và nhóm trên Task Board — không có phân loại cố định, cùng triết lý với trường role của Staff." },
      { k: "comments", d: "Một luồng bình luận do người dùng viết, được cố tình tách biệt khỏi transcript trò chuyện trực tiếp của staff được ghi trong Meetings — comment là con người bàn về task, còn Meetings là task tự nói chuyện với chính nó." },
      { k: "issue_type", d: "IssueType — epic | story | task | bug | subtask. Một Task CHÍNH LÀ Issue; issue_key (ví dụ \"NUC-42\") được gán một lần khi tạo, lấy từ issue_counter của Project sở hữu nó." },
      { k: "story_points", d: "Ước lượng công sức tuỳ chọn, trường lập kế hoạch kiểu Jira tiêu chuẩn — không ảnh hưởng tới thực thi, chỉ để lập kế hoạch/báo cáo." },
    ],

    graphH2: "Ngữ cảnh knowledge graph",
    graphP: "Mỗi phiên chạy task xây dựng một knowledge graph gồm các thực thể và quan hệ được trích xuất từ hội thoại. Bạn có thể xem trực tiếp những gì nó biết hiện tại, hoặc kiểm tra tình trạng chung của hàng đợi trên mọi task:",

    restH2: "REST API",
    restP: "POST vừa dùng để tạo, cập nhật, hoặc đổi trạng thái — đưa id (và status, khi chuyển trạng thái) vào body thay vì tìm một endpoint PATCH riêng hay endpoint theo từng trạng thái.",

    nextProjectsTitle: "Projects", nextProjects: "Hệ thống phân cấp Project → Epic/Sprint → Task mà Task này có thể thuộc về (tuỳ chọn).",
    nextDeptTitle: "Departments", nextDept: "Cách topology thực thi assigned_staff của một task thực sự hoạt động.",
    nextMeetingsTitle: "Meetings", nextMeetings: "Transcript giữa các Staff mà phiên chạy của một Task tạo ra, tách biệt khỏi comment của người dùng.",
  },
  zh: {
    lead1: "Task（任务）是分配给某个 Department（或通过 assignee_id 分配给单个 Staff）并通过该部门拓扑运行的一个工作单元。它是真正在相关 Staff 上经历 idle → thinking → active 状态变化的对象，也是运行引擎、任务队列和知识图谱共同依赖的核心对象。",
    lead2: "Task 还有第二重身份：它同时也是 Jira 风格 Project → Epic/Sprint → Task 层级结构中的\"Issue\"。这两重身份存在于同一条记录上——并不存在一个独立的 Issue 实体。",
    dualIdentityH2: "为什么是一个实体，而不是两个",
    dualIdentityP: "从概念上讲，把\"Department 执行的东西\"和\"Project 追踪的东西\"拆成两个需要保持同步的模型会更简单。但领域模型没有这样做：Task 在任何地方都是 Task，Jira 风格字段（project_id、issue_type、issue_key、epic_id、sprint_id、story_points）只是叠加在其上的额外列，默认都是空的。这意味着运行引擎、任务队列和知识图谱抽取管线永远不需要知道、也不需要关心眼前这个 Task 是否恰好属于某个 Project——无论哪种情况，它们操作的都是同一个对象。关于 Project/Epic/Sprint 这一侧的内容，见",
    dualIdentityLink: "Projects",
    dualIdentitySuffix: "。",

    schemaH2: "数据结构",
    schemaP: "领域模型（server/domain/models.py）。project_id 以上的字段驱动执行；project_id 及以下是叠加其上的 Jira 风格字段。",

    lifecycleH2: "状态生命周期",
    lifecycleP: "status（TaskStatus）同时驱动任务看板的列和运行引擎的行为——它不仅仅是一个界面标签。",

    lifecycleWalkthroughH2: "一个任务从开始到结束的一生",
    lifecycleSteps: [
      "以 pending 状态创建。此时尚未运行任何内容。",
      "被移动到 in-progress——可以是手动的，也可以是运行引擎主动接手。被分配的 Department 的拓扑开始执行，Staff 在 idle/thinking/active 之间循环，正如 Staff 与 Departments 页面所描述的那样。",
      "运行过程中可以暂停（paused），之后再恢复回 in-progress——运行引擎会从拓扑之前停下的确切位置继续。",
      "到达 in-review——这是执行完成到任务被标记为完成之间，供人工审核的手动列。",
      "被标记为 completed。或者，如果运行是被中止而非完成的，则标记为 stopped。",
      "如果您之后重启一个 completed 或 stopped 的任务——见下方提示——它会直接回到 in-progress，且第 1-5 步的任何内容都不会丢失。",
    ],
    restartCallout: "重启一个已完成或已停止的任务（POST /api/v1/tasks，status → \"in-progress\"）不会清空任何内容——消息历史与知识图谱都会保留，并会追加一条会话分隔消息，以便在记录中清楚看出旧运行在哪里结束、新运行从哪里开始。DELETE /api/v1/tasks/{id}/history 才是那个独立的、明确的、仅限所有者/管理员的操作，会真正清空一切——重启操作绝不会隐式执行这一点。",

    fieldsH2: "需要注意的字段",
    fields: [
      { k: "priority", d: "TaskPriority —— low | medium | high | urgent。任务看板上单纯的分诊信号；它本身不会改变执行顺序。" },
      { k: "assignee_id", d: "当任务分配给单个 Staff 而非整个部门时设置；此时 department_id 可以为空，因为没有拓扑需要路由——被分配者直接处理即可。" },
      { k: "labels", d: "用于在任务看板上筛选和分组的自由标签——没有固定分类体系，与 Staff 的 role 字段理念一致。" },
      { k: "comments", d: "由用户撰写的评论线程，刻意与记录在 Meetings 中的员工实时聊天记录分开——评论是人在讨论任务，Meetings 是任务在自我对话。" },
      { k: "issue_type", d: "IssueType —— epic | story | task | bug | subtask。Task 本身就是 Issue；issue_key（如 \"NUC-42\"）在创建时从所属 Project 的 issue_counter 一次性分配。" },
      { k: "story_points", d: "可选的工作量估算，标准的 Jira 风格规划字段——不影响执行，纯粹用于规划/报表。" },
    ],

    graphH2: "知识图谱上下文",
    graphP: "每次任务运行都会构建一个从对话中抽取出的实体与关系的知识图谱。您可以直接查看它当前掌握的内容，也可以查看所有任务的整体队列健康状况：",

    restH2: "REST API",
    restP: "POST 同时用于创建、更新或更改状态——在请求体中带上 id（状态变更时还需带上 status），而不是去找单独的 PATCH 接口或按状态区分的接口。",

    nextProjectsTitle: "Projects", nextProjects: "该 Task 可以选择归属的 Project → Epic/Sprint → Task 层级结构。",
    nextDeptTitle: "Departments", nextDept: "执行任务 assigned_staff 的拓扑究竟是如何运作的。",
    nextMeetingsTitle: "Meetings", nextMeetings: "Task 运行产生的员工间对话记录，与用户评论相互独立。",
  },
  ja: {
    lead1: "Task は Department（または assignee_id 経由で単一の Staff）に割り当てられ、その部門のトポロジーを通じて実行される作業単位です。関与する Staff 上で実際に idle → thinking → active というステータス変化を経るのはこの Task であり、実行エンジン・タスクキュー・ナレッジグラフがすべて軸にしているのもこの Task です。",
    lead2: "Task にはもう 1 つの側面もあります。Jira 風の Project → Epic/Sprint → Task 階層における「Issue」を兼ねているのです。この 2 つの側面はまったく同じレコード上に存在します — 別の Issue エンティティは存在しません。",
    dualIdentityH2: "なぜ 2 つではなく 1 つのエンティティなのか",
    dualIdentityP: "概念的には、「Department が実行するもの」と「Project が追跡するもの」を、同期の取れた 2 つのモデルに分けるほうがシンプルだったかもしれません。しかしドメインモデルはそうしていません。Task はどこでも Task であり、Jira 風フィールド（project_id、issue_type、issue_key、epic_id、sprint_id、story_points）はその上に重ねられた追加の列にすぎず、デフォルトでは空です。つまり実行エンジン、タスクキュー、ナレッジグラフ抽出パイプラインは、目の前の Task がたまたま Project に属しているかどうかを知る必要も気にする必要もなく、どちらの場合もまったく同じオブジェクトを操作します。Project/Epic/Sprint 側については",
    dualIdentityLink: "Projects",
    dualIdentitySuffix: " を参照してください。",

    schemaH2: "スキーマ",
    schemaP: "ドメインモデル（server/domain/models.py）。project_id より上のフィールドは実行を駆動し、project_id 以降はその上に重ねられた Jira 風フィールドです。",

    lifecycleH2: "ステータスのライフサイクル",
    lifecycleP: "status（TaskStatus）はタスクボードの列と実行エンジンの挙動の両方を駆動します — 単なる UI ラベルではありません。",

    lifecycleWalkthroughH2: "タスクの一生、始まりから終わりまで",
    lifecycleSteps: [
      "pending で作成される。まだ何も実行されていない。",
      "in-progress に移る——手動で、あるいは実行エンジンが自動的に拾い上げる形で。割り当てられた Department のトポロジーが実行を開始し、Staff と Departments のページで説明した通り、スタッフは idle/thinking/active を巡回する。",
      "実行途中で一時停止（paused）でき、後で in-progress に戻せる——実行エンジンはトポロジーが中断したまさにその場所から再開する。",
      "in-review に到達する——実行が終わってからタスクが完了とマークされるまでの間、人間による承認のための手動の列。",
      "completed とマークされる。あるいは、実行が完了ではなく中断された場合は stopped になる。",
      "後で completed または stopped のタスクを再開すると——下記のコールアウト参照——in-progress に直接戻り、1〜5 のステップで得られたものは何も失われない。",
    ],
    restartCallout: "完了または停止したタスクを再開すると（POST /api/v1/tasks、status → \"in-progress\"）、何も消去されません — メッセージ履歴とナレッジグラフは保持され、旧い実行がどこで終わり新しい実行がどこから始まったかが記録上わかるよう、セッション区切りメッセージが追加されます。DELETE /api/v1/tasks/{id}/history が、オーナー/管理者限定で実際にすべてを消去する、別個の明示的な操作です — 再開処理がこれを暗黙に行うことは決してありません。",

    fieldsH2: "注目すべきフィールド",
    fields: [
      { k: "priority", d: "TaskPriority — low | medium | high | urgent。タスクボード上の単純なトリアージ信号であり、それ自体が実行順序を変えることはありません。" },
      { k: "assignee_id", d: "部門全体ではなく単一の Staff にタスクが割り当てられている場合に設定され、その場合 department_id は空になることがあります——ルーティングすべきトポロジーがなく、割り当てられた本人が直接処理するためです。" },
      { k: "labels", d: "タスクボード上でのフィルタリングとグルーピングのための自由記述タグ——固定の分類法はなく、Staff の role フィールドと同じ思想です。" },
      { k: "comments", d: "ユーザーが書き込むコメントスレッドで、Meetings に記録されるスタッフのライブチャット記録とは意図的に分離されています——コメントは人間がタスクについて話すもの、Meetings はタスクが自分自身と話すものです。" },
      { k: "issue_type", d: "IssueType — epic | story | task | bug | subtask。Task はそのまま Issue であり、issue_key（例:「NUC-42」）は作成時に所属 Project の issue_counter から一度だけ割り当てられます。" },
      { k: "story_points", d: "任意の工数見積もり。標準的な Jira 風の計画用フィールドで、実行には影響せず、純粋に計画/レポート用です。" },
    ],

    graphH2: "ナレッジグラフのコンテキスト",
    graphP: "各タスクの実行は、会話から抽出されたエンティティと関係のナレッジグラフを構築します。現在わかっている内容を直接確認することも、すべてのタスクにわたるキュー全体の状態を確認することもできます。",

    restH2: "REST API",
    restP: "POST は作成・更新・ステータス変更を兼ねます — 個別の PATCH やステータス専用エンドポイントを探す代わりに、body に id（ステータス変更時は status も）を含めます。",

    nextProjectsTitle: "Projects", nextProjects: "この Task が任意で所属できる Project → Epic/Sprint → Task 階層。",
    nextDeptTitle: "Departments", nextDept: "タスクの assigned_staff を実行するトポロジーが実際にどう動くか。",
    nextMeetingsTitle: "Meetings", nextMeetings: "Task の実行が生成する、ユーザーコメントとは別のスタッフ間トランスクリプト。",
  },
} as const;

export default function TasksDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Tasks</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>

      <H2>{t.dualIdentityH2}</H2>
      <P>
        {t.dualIdentityP}
        <DocLink id="projects" onNavigate={onNavigate}>{t.dualIdentityLink}</DocLink>
        {t.dualIdentitySuffix}
      </P>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Task:\n    id: str\n    title: str\n    description: str\n    department_id: str\n    status: TaskStatus            # see lifecycle below\n    progress: int\n    assigned_staff: list[str]\n    start_time: datetime | None = None\n    end_time: datetime | None = None\n    owner_id: str = "default"\n    priority: TaskPriority = TaskPriority.medium\n    due_date: datetime | None = None\n    labels: list[str] = field(default_factory=list)\n    assignee_id: str | None = None\n    comments: list[dict] = field(default_factory=list)\n    project_id: str = ""\n    issue_type: IssueType = IssueType.task\n    issue_key: str = ""            # "NUC-42", assigned once at create time\n    epic_id: str | None = None\n    sprint_id: str | None = None\n    story_points: int | None = None`} />

      <H2>{t.lifecycleH2}</H2>
      <P>{t.lifecycleP}</P>
      <CodeBlock lang="text" code={`pending ──▶ in-progress ──▶ in-review ──▶ completed\n                 │  ▲\n                 │  └──────────────┐\n                 ├──▶ paused ───────┤\n                 └──▶ stopped ──────┘   (restart re-enters in-progress)`} />

      <H2>{t.lifecycleWalkthroughH2}</H2>
      <OL>
        {t.lifecycleSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>
      <Callout type="tip">{t.restartCallout}</Callout>

      <H2>{t.fieldsH2}</H2>
      <UL>
        {t.fields.map(({ k, d }) => (
          <LI key={k}><InlineCode>{k}</InlineCode> — {d}</LI>
        ))}
      </UL>

      <H2>{t.graphH2}</H2>
      <P>{t.graphP}</P>
      <CodeBlock lang="bash" code={`curl http://localhost:8000/api/v1/tasks/{task_id}/graph-context\ncurl http://localhost:8000/api/v1/tasks/queue/status`} />

      <H2>{t.restH2}</H2>
      <P>{t.restP}</P>
      <CodeBlock lang="bash" title="Create a task" code={`curl -X POST http://localhost:8000/api/v1/tasks \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "title": "Q3 market research",\n    "description": "Summarize competitor pricing moves.",\n    "department_id": "department_abc123",\n    "status": "pending",\n    "progress": 0,\n    "assigned_staff": [],\n    "priority": "high"\n  }'`} />
      <CodeBlock lang="bash" title="Change status / delete / wipe history" code={`curl -X POST http://localhost:8000/api/v1/tasks \\\n  -H "Content-Type: application/json" \\\n  -d '{"id": "task_abc123", "status": "in-progress"}'\n\ncurl -X DELETE http://localhost:8000/api/v1/tasks/{task_id}\ncurl -X DELETE http://localhost:8000/api/v1/tasks/{task_id}/history   # owner/admin only`} />

      <NextSteps>
        <NextStepCard id="projects" onNavigate={onNavigate} title={t.nextProjectsTitle} desc={t.nextProjects} />
        <NextStepCard id="departments" onNavigate={onNavigate} title={t.nextDeptTitle} desc={t.nextDept} />
        <NextStepCard id="meetings" onNavigate={onNavigate} title={t.nextMeetingsTitle} desc={t.nextMeetings} />
      </NextSteps>
    </div>
  );
}
