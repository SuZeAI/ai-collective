import { H1, H2, P, Pill, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const MODES: { id: string; color: "blue" | "green" | "orange" | "purple"; file: string; title: Record<string, string>; desc: Record<string, string>; scenario: Record<string, string> }[] = [
  {
    id: "sequential", color: "purple", file: "langgraph_orchestrator.py",
    title: { en: "The default", vi: "Mặc định", zh: "默认模式", ja: "デフォルト" },
    desc: {
      en: "A single staff member processes the full request. The fastest and most predictable mode — no hand-offs, no coordination overhead.",
      vi: "Một staff duy nhất xử lý toàn bộ yêu cầu. Chế độ nhanh nhất và dễ đoán nhất — không có bàn giao, không có chi phí điều phối.",
      zh: "由单个员工处理整个请求。最快、最可预测的模式——没有交接，没有协调开销。",
      ja: "1 人のスタッフがリクエスト全体を処理します。最も高速で予測可能なモード — 引き渡しも調整のオーバーヘッドもありません。",
    },
    scenario: {
      en: "Pick this for: \"Summarize this document\" — one Staff, one clear task, no benefit from a second opinion or a second pair of hands.",
      vi: "Chọn khi: \"Tóm tắt tài liệu này\" — một Staff, một nhiệm vụ rõ ràng, không có lợi ích gì từ ý kiến thứ hai hay thêm người làm.",
      zh: "适用场景：\"总结这份文档\"——一个员工，一个明确的任务，第二意见或第二双手都没有额外价值。",
      ja: "こんなときに: 「この文書を要約して」— スタッフ 1 人、明確なタスク 1 つ。セカンドオピニオンや追加の人手は不要。",
    },
  },
  {
    id: "ring", color: "green", file: "langgraph_ring.py",
    title: { en: "Iterative refinement", vi: "Tinh chỉnh lặp lại", zh: "迭代打磨", ja: "反復的な改善" },
    desc: {
      en: "Staff execute in circular order — Staff 0 → Staff 1 → … → Staff N → Staff 0. Each turn sees the full accumulated conversation history. Continues until max_rounds is reached.",
      vi: "Các staff chạy theo thứ tự vòng tròn — Staff 0 → Staff 1 → … → Staff N → Staff 0. Mỗi lượt đều thấy toàn bộ lịch sử hội thoại tích luỹ. Tiếp tục cho tới khi đạt max_rounds.",
      zh: "员工按环形顺序执行——Staff 0 → Staff 1 → … → Staff N → Staff 0。每个回合都能看到完整的累积对话历史，直到达到 max_rounds 为止。",
      ja: "スタッフは円環状の順序で実行されます — Staff 0 → Staff 1 → … → Staff N → Staff 0。各ターンは累積された会話履歴全体を参照でき、max_rounds に達するまで続きます。",
    },
    scenario: {
      en: "Pick this for: a Writer and an Editor trading drafts back and forth for a fixed number of rounds until the copy converges — each round sees exactly what the previous one produced.",
      vi: "Chọn khi: một Writer và một Editor trao đổi bản nháp qua lại trong một số vòng cố định cho tới khi nội dung hội tụ — mỗi vòng thấy đúng những gì vòng trước tạo ra.",
      zh: "适用场景：一位 Writer 和一位 Editor 在固定的若干轮次内来回交换草稿，直到文案收敛——每一轮都能看到上一轮产出的确切内容。",
      ja: "こんなときに: Writer と Editor が固定回数のラウンドの間、原稿を行き来させて収束させる — 各ラウンドは直前のラウンドの成果をそのまま参照できます。",
    },
  },
  {
    id: "mesh", color: "blue", file: "langgraph_mesh.py",
    title: { en: "Hub and spoke", vi: "Trung tâm và nhánh", zh: "中心-辐射", ja: "ハブ＆スポーク" },
    desc: {
      en: "A hub staff member connects bidirectionally to N spoke staff members and decides which spoke to activate using control blocks (<NEXT_AGENT>, <DISCUSSION_END>).",
      vi: "Một staff trung tâm (hub) kết nối hai chiều với N staff nhánh (spoke) và quyết định kích hoạt nhánh nào bằng các control block (<NEXT_AGENT>, <DISCUSSION_END>).",
      zh: "一个中心（hub）员工与 N 个分支（spoke）员工双向连接，并通过控制块（<NEXT_AGENT>、<DISCUSSION_END>）决定激活哪个分支。",
      ja: "ハブとなるスタッフが N 人のスポークスタッフと双方向に接続し、制御ブロック（<NEXT_AGENT>、<DISCUSSION_END>）を使ってどのスポークを起動するか決定します。",
    },
    scenario: {
      en: "Pick this for: a support-desk hub that reads an incoming question and routes it to a Billing, Technical, or Refunds specialist, possibly bouncing between two of them before closing out with <DISCUSSION_END>.",
      vi: "Chọn khi: một hub tổng đài hỗ trợ đọc câu hỏi đến và định tuyến nó tới chuyên gia Billing, Technical, hoặc Refunds, có thể chuyển qua lại giữa hai chuyên gia trước khi kết thúc bằng <DISCUSSION_END>.",
      zh: "适用场景：一个客服中心 hub 读取用户的提问，并将其路由给 Billing、Technical 或 Refunds 专员，可能在两位专员之间来回后再以 <DISCUSSION_END> 结束。",
      ja: "こんなときに: サポートデスクの hub が問い合わせ内容を読み取り、Billing・Technical・Refunds の専門スタッフへルーティングし、必要なら 2 人の間を往復してから <DISCUSSION_END> でクローズする。",
    },
  },
  {
    id: "supervisor", color: "orange", file: "langgraph_supervisor.py",
    title: { en: "Manager / worker", vi: "Quản lý / nhân viên", zh: "经理 / 员工", ja: "マネージャー/ワーカー" },
    desc: {
      en: "A lead staff member delegates to N worker staff members via <DELEGATE_TO>WorkerName</DELEGATE_TO>. Workers report back to the lead, which synthesizes results and either delegates again or returns a <FINAL_ANSWER>.",
      vi: "Một staff lãnh đạo (lead) uỷ thác công việc cho N staff nhân viên (worker) qua <DELEGATE_TO>WorkerName</DELEGATE_TO>. Worker báo cáo lại cho lead, lead tổng hợp kết quả rồi hoặc uỷ thác tiếp hoặc trả về <FINAL_ANSWER>.",
      zh: "领导（lead）员工通过 <DELEGATE_TO>WorkerName</DELEGATE_TO> 将任务委派给 N 个执行（worker）员工。Worker 向 lead 汇报，lead 综合结果后再次委派或返回 <FINAL_ANSWER>。",
      ja: "リーダースタッフが <DELEGATE_TO>WorkerName</DELEGATE_TO> を使って N 人のワーカースタッフに委任します。ワーカーはリーダーに報告し、リーダーは結果を統合して再委任するか <FINAL_ANSWER> を返します。",
    },
    scenario: {
      en: "Pick this for: a lead engineer breaking a feature request into a frontend piece and a backend piece, delegating each to the matching worker, then synthesizing both into one final answer.",
      vi: "Chọn khi: một lead engineer chia một yêu cầu tính năng thành phần frontend và phần backend, giao mỗi phần cho worker tương ứng, rồi tổng hợp cả hai thành một câu trả lời cuối cùng.",
      zh: "适用场景：一位主管工程师把功能需求拆成前端部分和后端部分，分别委派给对应的执行员工，再把两者综合成一个最终答案。",
      ja: "こんなときに: リード エンジニアが機能要件をフロントエンド部分とバックエンド部分に分割し、それぞれ対応するワーカーに委任し、両方を 1 つの最終回答にまとめる。",
    },
  },
  {
    id: "tree", color: "blue", file: "langgraph_tree.py",
    title: { en: "Hierarchical delegation", vi: "Uỷ thác phân cấp", zh: "层级委派", ja: "階層的な委任" },
    desc: {
      en: "Staff are arranged in a hierarchical parent/child tree; results roll up from leaves to root, each parent synthesizing what its children returned.",
      vi: "Staff được sắp xếp thành cây phân cấp cha/con; kết quả được tổng hợp dần từ lá lên gốc, mỗi cha tổng hợp những gì các con của nó trả về.",
      zh: "员工按父子层级树排列；结果从叶节点逐级汇总到根节点，每个父节点综合其子节点返回的内容。",
      ja: "スタッフは親子関係の階層ツリーに配置され、結果は葉から根に向かって集約され、各親ノードは子ノードの結果を統合します。",
    },
    scenario: {
      en: "Pick this for: a multi-level research org — a root Staff assigns three sub-topics to mid-level Staff, each of which further splits its sub-topic across its own children, and the synthesis rolls back up level by level.",
      vi: "Chọn khi: một tổ chức nghiên cứu nhiều tầng — một Staff gốc giao ba tiểu chủ đề cho các Staff tầng giữa, mỗi Staff đó lại chia nhỏ tiểu chủ đề của mình cho các con của nó, và bản tổng hợp được đưa dần lên từng tầng.",
      zh: "适用场景：一个多层级的研究组织——根 Staff 把三个子课题分配给中层 Staff，每个中层 Staff 又把自己的子课题进一步拆分给它自己的子节点，综合结果逐级向上汇总。",
      ja: "こんなときに: 多段階の研究組織 — ルートの Staff が 3 つのサブトピックを中間層の Staff に割り当て、それぞれがさらに自分の子ノードにサブトピックを分割し、統合結果が段階的に上へ集約される。",
    },
  },
  {
    id: "custom", color: "purple", file: "langgraph_custom.py",
    title: { en: "User-defined DAG", vi: "DAG tự định nghĩa", zh: "自定义 DAG", ja: "カスタム DAG" },
    desc: {
      en: "A user-drawn graph (CustomGraphSpec) built with the visual flow editor — for workflows that don't fit the built-in topologies. Stored as Department.flow (React Flow nodes/edges + positions).",
      vi: "Một đồ thị do người dùng tự vẽ (CustomGraphSpec) bằng trình chỉnh sửa flow trực quan — dành cho các luồng công việc không phù hợp với các topology có sẵn. Được lưu trong Department.flow (node/edge + vị trí của React Flow).",
      zh: "通过可视化流程编辑器绘制的用户自定义图（CustomGraphSpec）——用于不适合内置拓扑的工作流。存储在 Department.flow 中（React Flow 的节点/边与位置信息）。",
      ja: "ビジュアルフローエディタで作成するユーザー定義グラフ（CustomGraphSpec）— 組み込みトポロジーに合わないワークフロー向け。Department.flow（React Flow のノード/エッジと位置情報）に保存されます。",
    },
    scenario: {
      en: "Pick this for: anything that needs a loop, a conditional branch, or a shape the five built-ins genuinely don't cover — draw the graph node by node in the visual editor instead of forcing the workflow into a topology it doesn't fit.",
      vi: "Chọn khi: bất cứ thứ gì cần một vòng lặp, một nhánh điều kiện, hoặc một hình dạng mà năm topology có sẵn thực sự không đáp ứng được — vẽ đồ thị từng node một trong trình chỉnh sửa trực quan thay vì gò ép luồng công việc vào một topology không phù hợp.",
      zh: "适用场景：需要循环、条件分支，或五种内置拓扑确实无法覆盖的形态——在可视化编辑器中逐节点绘制图，而不是把工作流硬塞进不合适的拓扑里。",
      ja: "こんなときに: ループ、条件分岐、あるいは 5 つの組み込みトポロジーでは本当に対応できない形が必要な場合 — ワークフローを合わないトポロジーに無理やり当てはめる代わりに、ビジュアルエディタでノードを 1 つずつ描画する。",
    },
  },
];

const TXT = {
  en: {
    lead1: "A Department is where Staff stop being individuals and become a coordinated unit. On its own, a Staff just answers whatever it's asked. Put two or more Staff into a Department, pick one of six topology modes, and the topology takes over: it decides who speaks first, what each Staff sees of the others' output, when to loop back for another round, and when the whole thing is done.",
    lead2: "The topology is implemented as a LangGraph state machine in server/domain/staff/ — one file per mode — and it's genuinely a different program for each mode, not a configuration flag on one shared implementation. That's why switching a Department's mode can change its behavior qualitatively, not just its pacing.",
    departmentLink: "Staff",
    lead3prefix: "Departments don't do any of the reasoning themselves — see ",
    lead3suffix: " for what a Staff actually is and how its status changes as a run moves through the topology.",

    schemaH2: "Schema",
    schemaP: "flow is only populated when mode is \"custom\"; every other mode ignores it entirely — the field exists purely to let the visual editor restore your exact node layout on reload.",

    modesH2: "The six topology modes, in depth",
    modesP: "Selected at runtime via the mode field. Each is a genuinely different execution shape, not a variation on the same loop — read the scenario under each one to get a feel for which fits your Department.",

    compareH2: "At a glance",

    tableHeaders: ["Mode", "Shape", "Best for"],
    tableRows: [
      ["sequential", "One staff, one pass", "Simple, single-owner tasks"],
      ["ring", "Circular, N rounds", "Iterative critique and refinement"],
      ["mesh", "Hub + N spokes", "Centrally-routed specialists"],
      ["supervisor", "Lead + N workers", "Hierarchical delegation, one level"],
      ["tree", "Parent/child tree", "Multi-level delegation"],
      ["custom", "Whatever you draw", "Anything the other five don't fit"],
    ],

    maxStepsH2: "max_steps is your safety net",
    maxStepsP: "Every topology respects max_steps — a hard cap on total graph steps/turns for a single run, regardless of mode. This exists because some topologies (ring especially, and any custom graph with a cycle) can in principle run indefinitely if the Staff never naturally converge; max_steps guarantees the run terminates and returns whatever it has, rather than looping forever.",

    restH2: "REST API",
    restP: "POST doubles as create-or-update: include an existing id in the body to update that department instead of creating a new one.",

    nextStaffTitle: "Staff", nextStaff: "The individual worker every Department is built from.",
    nextTasksTitle: "Tasks", nextTasks: "What a Department actually executes when a run starts.",
  },
  vi: {
    lead1: "Một Department là nơi các Staff không còn là những cá thể riêng lẻ mà trở thành một đơn vị phối hợp. Đứng một mình, một Staff chỉ trả lời bất cứ điều gì được hỏi. Đặt từ hai Staff trở lên vào một Department, chọn một trong sáu chế độ topology, và topology sẽ tiếp quản: nó quyết định ai lên tiếng trước, mỗi Staff thấy được gì từ output của người khác, khi nào lặp lại thêm một vòng, và khi nào toàn bộ hoàn tất.",
    lead2: "Topology được cài đặt như một state machine LangGraph trong server/domain/staff/ — mỗi mode một file — và nó thực sự là một chương trình khác nhau cho mỗi mode, không phải một cờ cấu hình trên một cài đặt dùng chung. Đó là lý do vì sao đổi mode của một Department có thể thay đổi hành vi của nó về chất, chứ không chỉ về nhịp độ.",
    departmentLink: "Staff",
    lead3prefix: "Department tự nó không thực hiện suy luận nào — xem ",
    lead3suffix: " để biết Staff thực sự là gì và trạng thái của nó thay đổi ra sao khi một phiên chạy đi qua topology.",

    schemaH2: "Schema",
    schemaP: "flow chỉ có giá trị khi mode là \"custom\"; mọi mode khác đều bỏ qua hoàn toàn trường này — trường này tồn tại chỉ để trình chỉnh sửa trực quan khôi phục đúng bố cục node của bạn khi tải lại.",

    modesH2: "Sáu chế độ topology, đi sâu",
    modesP: "Được chọn khi chạy thông qua trường mode. Mỗi chế độ thực sự có hình dạng thực thi khác nhau, không phải một biến thể của cùng một vòng lặp — đọc kịch bản dưới mỗi chế độ để cảm nhận cái nào phù hợp với Department của bạn.",

    compareH2: "Nhìn tổng quan",

    tableHeaders: ["Mode", "Hình dạng", "Phù hợp cho"],
    tableRows: [
      ["sequential", "Một staff, một lượt chạy", "Nhiệm vụ đơn giản, một chủ sở hữu"],
      ["ring", "Vòng tròn, N vòng", "Phê bình và tinh chỉnh lặp lại"],
      ["mesh", "Hub + N nhánh", "Chuyên gia được định tuyến tập trung"],
      ["supervisor", "Lead + N worker", "Uỷ thác phân cấp, một tầng"],
      ["tree", "Cây cha/con", "Uỷ thác nhiều tầng"],
      ["custom", "Bất cứ gì bạn vẽ", "Bất cứ gì năm chế độ kia không phù hợp"],
    ],

    maxStepsH2: "max_steps là lưới an toàn của bạn",
    maxStepsP: "Mọi topology đều tuân theo max_steps — một giới hạn cứng về tổng số bước/lượt của đồ thị cho một phiên chạy, bất kể mode nào. Điều này tồn tại vì một số topology (đặc biệt là ring, và bất kỳ đồ thị custom nào có chu trình) về nguyên tắc có thể chạy vô hạn nếu các Staff không bao giờ hội tụ tự nhiên; max_steps đảm bảo phiên chạy kết thúc và trả về những gì nó có, thay vì lặp mãi mãi.",

    restH2: "REST API",
    restP: "POST vừa dùng để tạo vừa để cập nhật: đưa một id đã tồn tại vào body để cập nhật department đó thay vì tạo mới.",

    nextStaffTitle: "Staff", nextStaff: "Nhân sự riêng lẻ mà mọi Department được xây dựng từ đó.",
    nextTasksTitle: "Tasks", nextTasks: "Những gì một Department thực sự thực thi khi một phiên chạy bắt đầu.",
  },
  zh: {
    lead1: "Department 是 Staff 从个体转变为协同单元的地方。单独来看，一个 Staff 只是回答被问到的问题。把两个或更多 Staff 放进一个 Department，选择六种拓扑模式之一，拓扑就会接管一切：决定谁先发言、每个员工能看到其他人输出的哪些内容、何时循环进入下一轮，以及整个过程何时结束。",
    lead2: "拓扑在 server/domain/staff/ 中以 LangGraph 状态机的形式实现——每种模式一个文件——对每种模式而言它确实是一个不同的程序，而不是同一份实现上的一个配置开关。这就是为什么切换 Department 的模式会在行为上产生质的变化，而不仅仅是节奏上的变化。",
    departmentLink: "Staff",
    lead3prefix: "Department 本身不做任何推理——关于 Staff 究竟是什么，以及运行过程中其状态如何随拓扑变化，见",
    lead3suffix: "。",

    schemaH2: "数据结构",
    schemaP: "只有当 mode 为 \"custom\" 时 flow 才会有值；其他所有模式都会完全忽略该字段——它存在的唯一目的，是让可视化编辑器在重新加载时恢复您确切的节点布局。",

    modesH2: "六种拓扑模式，深入讲解",
    modesP: "通过 mode 字段在运行时选择。每种模式在执行形态上都真正不同，而不是同一个循环的变体——阅读每种模式下的场景说明，感受哪一种适合您的 Department。",

    compareH2: "一览对比",

    tableHeaders: ["模式", "形态", "最适合"],
    tableRows: [
      ["sequential", "单员工，单次处理", "简单的单一负责人任务"],
      ["ring", "环形，N 轮", "迭代式的批评与打磨"],
      ["mesh", "中心 + N 分支", "由中心统一路由的专家"],
      ["supervisor", "领导 + N 执行者", "单层级的层级委派"],
      ["tree", "父子树", "多层级委派"],
      ["custom", "您绘制的任何形态", "其他五种都不适合的场景"],
    ],

    maxStepsH2: "max_steps 是您的安全网",
    maxStepsP: "无论是哪种模式，每种拓扑都遵循 max_steps——对单次运行的图步骤/回合总数设定的硬性上限。之所以需要它，是因为某些拓扑（尤其是 ring，以及任何带环的自定义图）如果员工始终无法自然收敛，理论上可能无限运行下去；max_steps 保证运行一定会终止并返回已有的结果，而不是永远循环下去。",

    restH2: "REST API",
    restP: "POST 同时承担创建和更新的作用：在请求体中带上已存在的 id 即可更新该部门，而不是创建新部门。",

    nextStaffTitle: "Staff", nextStaff: "每个 Department 都由其构建而成的单个员工。",
    nextTasksTitle: "Tasks", nextTasks: "运行开始时 Department 实际执行的内容。",
  },
  ja: {
    lead1: "Department は、Staff が個体であることをやめ、協調するひとつの単位になる場所です。単独では、Staff はただ聞かれたことに答えるだけです。2 人以上の Staff を Department に入れ、6 つのトポロジーモードのいずれかを選ぶと、トポロジーが主導権を握ります——誰が最初に発言するか、各スタッフが他者の出力の何を見るか、いつもう一巡するか、そしていつ全体が完了するかを決めます。",
    lead2: "トポロジーは server/domain/staff/ 内で LangGraph のステートマシンとして実装されており——モードごとに 1 ファイル——各モードは共有実装上の設定フラグではなく、本当に異なるプログラムです。だからこそ、Department のモードを切り替えると、ペースだけでなく振る舞いそのものが質的に変わることがあります。",
    departmentLink: "Staff",
    lead3prefix: "Department 自体は推論を一切行いません — Staff が実際に何であり、実行がトポロジーを進む中でそのステータスがどう変化するかについては ",
    lead3suffix: " を参照してください。",

    schemaH2: "スキーマ",
    schemaP: "flow は mode が \"custom\" のときのみ値が入ります。それ以外のモードでは完全に無視されます——このフィールドが存在するのは、再読み込み時にビジュアルエディタが正確なノードレイアウトを復元できるようにするためだけです。",

    modesH2: "6 つのトポロジーモードを詳しく",
    modesP: "mode フィールドで実行時に選択します。各モードは同じループのバリエーションではなく、本当に異なる実行形態です — 各モードの下にあるシナリオを読んで、どれが自分の Department に合うか感触をつかんでください。",

    compareH2: "早見表",

    tableHeaders: ["モード", "形態", "最適な用途"],
    tableRows: [
      ["sequential", "スタッフ 1 人、1 パス", "シンプルな単一担当タスク"],
      ["ring", "円環、N ラウンド", "反復的な批評と改善"],
      ["mesh", "ハブ + N スポーク", "中央でルーティングされる専門家"],
      ["supervisor", "リーダー + N ワーカー", "単一階層の委任"],
      ["tree", "親子ツリー", "多段階の委任"],
      ["custom", "自由に描いた形", "他の 5 つでは対応できない場合"],
    ],

    maxStepsH2: "max_steps はセーフティネット",
    maxStepsP: "どのトポロジーも max_steps に従います——モードに関わらず、1 回の実行におけるグラフのステップ/ターン総数へのハード上限です。これが必要な理由は、一部のトポロジー（特に ring、そして循環を含むあらゆるカスタムグラフ）は、スタッフが自然に収束しない場合、原理的には無限に実行され続ける可能性があるからです。max_steps は、実行が永遠にループし続けるのではなく、必ず終了してその時点の結果を返すことを保証します。",

    restH2: "REST API",
    restP: "POST は作成と更新の両方を兼ねます。既存の id を body に含めると新規作成ではなくその部門を更新します。",

    nextStaffTitle: "Staff", nextStaff: "すべての Department の構成要素である個々のワーカー。",
    nextTasksTitle: "Tasks", nextTasks: "実行が開始したときに Department が実際に実行するもの。",
  },
} as const;

export default function DepartmentsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Departments</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>
      <P>
        {t.lead3prefix}
        <DocLink id="staff" onNavigate={onNavigate}>{t.departmentLink}</DocLink>
        {t.lead3suffix}
      </P>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Department:\n    id: str\n    name: str\n    description: str\n    staff: list[str]           # Staff IDs\n    active_tasks: int\n    avatar: str = ""\n    avatar_icon: str = ""\n    avatar_color: str = ""\n    avatar_url: str = ""\n    mode: str = "sequential"   # sequential|mesh|ring|supervisor|tree|custom\n    max_steps: int = 6\n    owner_id: str = "default"\n    flow: dict[str, Any] | None = None  # only set when mode == "custom"`} />

      <H2>{t.modesH2}</H2>
      <P>{t.modesP}</P>
      <div className="space-y-4 my-5">
        {MODES.map((m) => (
          <div key={m.id} className="p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="font-bold mb-1.5 flex items-center gap-2 flex-wrap">
              <Pill color={m.color}>{m.id}</Pill>
              <span>{m.title[lang]}</span>
              <code className="text-[11px] text-muted-foreground/60 font-mono">{m.file}</code>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-2">{m.desc[lang]}</p>
            <p className="text-[13px] text-foreground/70 leading-relaxed italic">{m.scenario[lang]}</p>
          </div>
        ))}
      </div>

      <H2>{t.compareH2}</H2>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {t.tableHeaders.map((h) => (
                <th key={h} className="text-left py-2 pr-6 font-semibold text-foreground/80">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-muted-foreground divide-y divide-border/40">
            {t.tableRows.map((row) => (
              <tr key={row[0]}>
                <td className="py-2 pr-6 font-mono text-foreground/70">{row[0]}</td>
                <td className="py-2 pr-6">{row[1]}</td>
                <td className="py-2">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>{t.maxStepsH2}</H2>
      <P>{t.maxStepsP}</P>
      <Callout type="warning"><InlineCode>max_steps</InlineCode></Callout>

      <H2>{t.restH2}</H2>
      <P>{t.restP}</P>
      <CodeBlock lang="bash" title="Create or update a department" code={`curl -X POST http://localhost:8000/api/v1/departments \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Research",\n    "description": "Gathers and synthesizes market research.",\n    "staff": ["staff_abc123"],\n    "active_tasks": 0,\n    "mode": "supervisor",\n    "max_steps": 6\n  }'`} />
      <CodeBlock lang="bash" title="List / delete" code={`curl http://localhost:8000/api/v1/departments\ncurl -X DELETE http://localhost:8000/api/v1/departments/{department_id}`} />

      <NextSteps>
        <NextStepCard id="staff" onNavigate={onNavigate} title={t.nextStaffTitle} desc={t.nextStaff} />
        <NextStepCard id="tasks" onNavigate={onNavigate} title={t.nextTasksTitle} desc={t.nextTasks} />
      </NextSteps>
    </div>
  );
}
