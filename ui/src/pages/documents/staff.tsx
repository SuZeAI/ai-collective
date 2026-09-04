import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "A Staff member is the smallest unit of work in AI Collective: one AI worker with a role, a system prompt, a model, and a bound set of Skills. Everything else in the platform — Departments, topologies, Tasks — exists to give Staff something to do and a structure to do it in.",
    lead2: "A Staff never runs on its own. Create one and it just sits there, idle, until it's placed inside a Department. From that point on, it's a node in that Department's topology graph, and the topology — not the Staff itself — decides when it speaks, what it sees, and who it hands off to next. Understanding a Staff member in isolation only gets you half the picture; the other half is in ", // continues with DocLink
    leadDepartmentsLink: "Departments",
    lead3: ", which covers the six ways a group of Staff can collaborate.",

    schemaH2: "What a Staff actually is",
    schemaP: "Every Staff member is a row of this shape (server/domain/models.py). Nothing here is hidden from the API — what you see in the Staff Builder UI is a thin form over exactly these fields.",
    fieldsH2: "Field by field",
    fields: [
      { f: "role / description", d: "Free text. There is no enum of job titles — see \"Role has no fixed vocabulary\" below." },
      { f: "system_prompt", d: "The instructions this Staff member reasons from on every turn. This is the single highest-leverage field for changing how a Staff behaves." },
      { f: "skill_ids", d: "The Skills (tools) this Staff is allowed to call — everything from web search to a Google Sheets integration to a custom-JS function." },
      { f: "status", d: "One of three live values — see \"Status: what a run looks like from the outside\" below." },
      { f: "subagent_enabled", d: "Whether this Staff member is allowed to spawn parallel subagents mid-turn instead of working strictly one step at a time." },
      { f: "owner_id", d: "\"default\" for the shared, admin-curated catalog every company can clone from (see Recruiting); otherwise the id of the company/user that owns this Staff." },
    ],

    statusH2: "Status: what a run looks like from the outside",
    statusP: "While a Department is running, every Staff member inside it carries one of three statuses, and the UI updates them live as the run streams over Server-Sent Events:",
    statuses: [
      { s: "idle", d: "Not part of the active turn. Most Staff in a department sit here most of the time — only the topology decides who's up next." },
      { s: "thinking", d: "The LLM call for this Staff's turn is in flight. You'll see this the instant the orchestrator hands control to this Staff, before any text streams back." },
      { s: "active", d: "This Staff just produced output and is (or just was) the current speaker in the run." },
    ],
    statusWalkthroughH2: "A concrete example",
    statusWalkthroughP: "Say a Department runs in supervisor mode with a lead and two workers. A Task comes in:",
    statusSteps: [
      "The lead Staff flips to thinking, then active as it decides how to break down the request and emits <DELEGATE_TO>Worker A</DELEGATE_TO>.",
      "Worker A flips to thinking while its LLM call runs, then active as it streams its result back.",
      "The lead flips to thinking again to read Worker A's output and decide the next step — maybe delegating to Worker B, maybe answering directly with <FINAL_ANSWER>.",
      "Every Staff not currently involved stays idle the whole time — they simply aren't nodes the topology has activated yet.",
    ],

    roleH2: "Role has no fixed vocabulary",
    roleP: "role and system_prompt are plain strings, not a dropdown of job titles. That's deliberate: a Staff member for a software company (\"Backend Engineer\", \"QA Automation\") looks nothing like one for a research lab (\"Literature Review Analyst\", \"Statistical Reviewer\"), and the schema doesn't try to anticipate every company type you might build. When you describe a company to the AI Office Designer in chat, it proposes roles and prompts that fit — you can accept them as-is or open the Staff Builder afterward and rewrite anything by hand.",

    subagentsH2: "Subagents: when one Staff needs to fan out",
    subagentsP: "Most Staff work turn by turn — think, act, hand off. Setting subagent_enabled changes that: this Staff member can, mid-turn, spawn several bounded parallel subagents to chase independent pieces of a task concurrently instead of working through them one at a time. This is useful when a single turn genuinely decomposes into unrelated subtasks (e.g. \"research these five competitors\") that don't need to see each other's intermediate output.",
    subagentsCalloutP1: "Concurrency and turn counts aren't unlimited — they're capped globally by",
    subagentsCalloutP2: "in config.yml, and every command a subagent issues still runs through the sandbox, which is the actual security boundary (see",
    subagentsCalloutP3: "for local vs. Kubernetes sandbox modes).",
    sandboxLink: "Deployment",

    createH2: "Two ways to create a Staff member",
    createP1: "Describe the company you want in chat and let the AI Office Designer propose the whole roster — names, roles, prompts, and which Skills each one needs — as part of a full company plan. This is the fastest path and the one most companies start from.",
    createP2: "Or build one by hand in the Staff Builder: pick a name and avatar, write the role and system prompt yourself, attach Skills one at a time, and decide whether it needs subagents enabled. Useful when you know exactly what you want, or when you're editing a Staff the AI Office Designer already generated.",

    restH2: "REST API",
    restP: "POST doubles as create-or-update: include an existing id in the body to update that Staff instead of creating a new one. There's no separate PATCH endpoint.",

    nextH2: "Next",
    nextDepartments: "See how a group of Staff is wired into one of six topologies.",
    nextSkills: "Attach tools — web search, Google Sheets, custom JS — to a Staff member.",
    nextGuide: "A hands-on walkthrough of creating your first Staff member.",
  },
  vi: {
    lead1: "Một Staff là đơn vị công việc nhỏ nhất trong AI Collective: một nhân sự AI với vai trò (role), system prompt, một mô hình (model), và một tập Skills được gắn vào. Mọi thứ khác trong nền tảng — Department, topology, Task — tồn tại để cho Staff có việc để làm và một cấu trúc để làm việc đó.",
    lead2: "Một Staff không bao giờ tự chạy một mình. Tạo ra nó thì nó chỉ nằm đó, ở trạng thái idle, cho đến khi được đặt vào bên trong một Department. Từ thời điểm đó, nó trở thành một node trong đồ thị topology của Department đó, và chính topology — không phải bản thân Staff — quyết định khi nào nó lên tiếng, nó thấy gì, và chuyển giao cho ai tiếp theo. Hiểu một Staff đơn lẻ chỉ cho bạn một nửa bức tranh; nửa còn lại nằm ở ",
    leadDepartmentsLink: "Departments",
    lead3: ", trang nói về sáu cách một nhóm Staff có thể cộng tác với nhau.",

    schemaH2: "Staff thực sự là gì",
    schemaP: "Mỗi Staff là một bản ghi có cấu trúc như sau (server/domain/models.py). Không có gì bị ẩn khỏi API — những gì bạn thấy trên UI Staff Builder chỉ là một form mỏng phủ lên đúng các trường này.",
    fieldsH2: "Từng trường một",
    fields: [
      { f: "role / description", d: "Văn bản tự do. Không có enum chức danh cố định — xem phần \"Role không có từ vựng cố định\" bên dưới." },
      { f: "system_prompt", d: "Chỉ dẫn mà Staff này dựa vào để suy luận ở mỗi lượt. Đây là trường có đòn bẩy cao nhất để thay đổi cách một Staff hành xử." },
      { f: "skill_ids", d: "Các Skill (công cụ) mà Staff này được phép gọi — từ tìm kiếm web đến tích hợp Google Sheets hay một hàm custom-JS." },
      { f: "status", d: "Một trong ba giá trị trực tiếp — xem phần \"Status: một phiên chạy trông như thế nào từ bên ngoài\" bên dưới." },
      { f: "subagent_enabled", d: "Staff này có được phép sinh ra các subagent song song giữa lượt thay vì làm tuần tự từng bước hay không." },
      { f: "owner_id", d: "\"default\" cho catalog dùng chung do admin quản lý mà mọi công ty có thể clone (xem Recruiting); ngược lại là id của công ty/người dùng sở hữu Staff này." },
    ],

    statusH2: "Status: một phiên chạy trông như thế nào từ bên ngoài",
    statusP: "Trong khi một Department đang chạy, mỗi Staff bên trong nó mang một trong ba trạng thái, và UI cập nhật trực tiếp khi phiên chạy được stream qua Server-Sent Events:",
    statuses: [
      { s: "idle", d: "Không tham gia lượt đang hoạt động. Phần lớn Staff trong một department ở trạng thái này hầu hết thời gian — chỉ có topology quyết định ai là người tiếp theo." },
      { s: "thinking", d: "Lệnh gọi LLM cho lượt của Staff này đang được xử lý. Bạn sẽ thấy trạng thái này ngay khi orchestrator trao quyền cho Staff này, trước khi bất kỳ văn bản nào được stream về." },
      { s: "active", d: "Staff này vừa tạo ra output và đang (hoặc vừa) là người phát biểu hiện tại trong phiên chạy." },
    ],
    statusWalkthroughH2: "Một ví dụ cụ thể",
    statusWalkthroughP: "Giả sử một Department chạy ở chế độ supervisor với một lead và hai worker. Một Task được đưa vào:",
    statusSteps: [
      "Staff lead chuyển sang thinking, rồi active khi nó quyết định cách chia nhỏ yêu cầu và phát ra <DELEGATE_TO>Worker A</DELEGATE_TO>.",
      "Worker A chuyển sang thinking trong khi lệnh gọi LLM của nó chạy, rồi active khi nó stream kết quả trở lại.",
      "Lead chuyển sang thinking lần nữa để đọc output của Worker A và quyết định bước tiếp theo — có thể ủy thác cho Worker B, có thể trả lời trực tiếp bằng <FINAL_ANSWER>.",
      "Mọi Staff không tham gia tại thời điểm đó vẫn ở idle suốt — đơn giản là chúng chưa phải là node mà topology kích hoạt.",
    ],

    roleH2: "Role không có từ vựng cố định",
    roleP: "role và system_prompt là các chuỗi văn bản thuần, không phải một danh sách sổ xuống các chức danh. Đây là chủ ý: một Staff cho một công ty phần mềm (\"Backend Engineer\", \"QA Automation\") trông hoàn toàn khác một Staff cho một phòng nghiên cứu (\"Literature Review Analyst\", \"Statistical Reviewer\"), và schema không cố đoán trước mọi loại công ty bạn có thể xây dựng. Khi bạn mô tả một công ty cho AI Office Designer trong khung chat, nó sẽ đề xuất role và prompt phù hợp — bạn có thể chấp nhận nguyên trạng hoặc mở Staff Builder sau đó để viết lại tay bất cứ điều gì.",

    subagentsH2: "Subagent: khi một Staff cần phân tán công việc",
    subagentsP: "Phần lớn Staff làm việc theo từng lượt: suy nghĩ, hành động, chuyển giao. Bật subagent_enabled sẽ thay đổi điều đó: Staff này có thể, ngay giữa một lượt, sinh ra nhiều subagent song song có giới hạn để xử lý các phần độc lập của một nhiệm vụ đồng thời thay vì làm từng cái một. Điều này hữu ích khi một lượt thực sự có thể tách thành các nhiệm vụ con không liên quan (ví dụ \"nghiên cứu năm đối thủ cạnh tranh này\") mà không cần thấy output trung gian của nhau.",
    subagentsCalloutP1: "Số lượng song song và số lượt không phải là vô hạn — chúng bị giới hạn toàn cục bởi",
    subagentsCalloutP2: "trong config.yml, và mọi lệnh mà một subagent thực thi vẫn chạy qua sandbox, chính là ranh giới bảo mật thật sự (xem",
    subagentsCalloutP3: "để biết về chế độ sandbox local so với Kubernetes).",
    sandboxLink: "Deployment",

    createH2: "Hai cách để tạo một Staff",
    createP1: "Mô tả công ty bạn muốn trong khung chat và để AI Office Designer đề xuất toàn bộ đội ngũ — tên, role, prompt, và Skill mà mỗi người cần — như một phần của kế hoạch công ty đầy đủ. Đây là đường nhanh nhất và cũng là cách hầu hết công ty bắt đầu.",
    createP2: "Hoặc tự tay xây dựng trong Staff Builder: chọn tên và avatar, tự viết role và system prompt, gắn từng Skill một, và quyết định có bật subagent hay không. Hữu ích khi bạn biết chính xác mình muốn gì, hoặc khi đang chỉnh sửa một Staff mà AI Office Designer đã tạo sẵn.",

    restH2: "REST API",
    restP: "POST vừa dùng để tạo vừa để cập nhật: đưa một id đã tồn tại vào body để cập nhật Staff đó thay vì tạo mới. Không có endpoint PATCH riêng.",

    nextH2: "Tiếp theo",
    nextDepartments: "Xem cách một nhóm Staff được ghép nối vào một trong sáu topology.",
    nextSkills: "Gắn công cụ — tìm kiếm web, Google Sheets, custom JS — vào một Staff.",
    nextGuide: "Hướng dẫn thực hành tạo Staff đầu tiên của bạn.",
  },
  zh: {
    lead1: "Staff（员工）是 AI Collective 中最小的工作单元：一个拥有角色（role）、系统提示词、模型和一组绑定 Skills 的 AI 工作者。平台中的其他一切——Department、拓扑、Task——存在的目的都是为了给 Staff 提供事情做，以及做事的结构。",
    lead2: "Staff 从不单独运行。创建它之后它只会处于 idle 状态待命，直到被放进某个 Department。从那一刻起，它就成为该 Department 拓扑图中的一个节点，而决定它何时发言、能看到什么、下一步交给谁的，是拓扑本身，而不是 Staff 自己。孤立地理解一个 Staff 只能看到一半的图景；另一半在",
    leadDepartmentsLink: "Departments",
    lead3: "页面中，那里讲解了一组 Staff 协作的六种方式。",

    schemaH2: "Staff 究竟是什么",
    schemaP: "每个 Staff 都是如下结构的一条记录（server/domain/models.py）。这里的一切对 API 都不是隐藏的——您在 Staff Builder 界面上看到的，只是覆盖在这些字段之上的一层薄薄的表单。",
    fieldsH2: "逐字段说明",
    fields: [
      { f: "role / description", d: "自由文本。没有固定的职位枚举——见下方\"role 没有固定词汇表\"。" },
      { f: "system_prompt", d: "该员工每个回合据以推理的指令。这是改变员工行为杠杆最大的一个字段。" },
      { f: "skill_ids", d: "该员工被允许调用的 Skills（工具）——从网页搜索到 Google 表格集成，再到自定义 JS 函数。" },
      { f: "status", d: "三个实时取值之一——见下方\"status：从外部看一次运行是什么样子\"。" },
      { f: "subagent_enabled", d: "该员工是否被允许在回合中途生成并行子智能体，而不是严格地一步一步工作。" },
      { f: "owner_id", d: "\"default\" 表示每家公司都可以克隆的、由管理员维护的共享目录（见 Recruiting）；否则为拥有该员工的公司/用户 id。" },
    ],

    statusH2: "status：从外部看一次运行是什么样子",
    statusP: "当一个 Department 正在运行时，其中每个 Staff 都带有三种状态之一，界面会随着运行通过 Server-Sent Events 流式传输而实时更新：",
    statuses: [
      { s: "idle", d: "未参与当前活跃回合。一个部门中大多数员工大部分时间都处于这个状态——只有拓扑决定接下来轮到谁。" },
      { s: "thinking", d: "该员工本回合的 LLM 调用正在进行中。当编排器刚把控制权交给该员工、任何文本流回之前，您就会看到这个状态。" },
      { s: "active", d: "该员工刚生成输出，并且是（或刚刚是）运行中的当前发言者。" },
    ],
    statusWalkthroughH2: "一个具体的例子",
    statusWalkthroughP: "假设一个 Department 以 supervisor 模式运行，有一个 lead 和两个 worker。一个 Task 进来了：",
    statusSteps: [
      "lead 员工先变为 thinking，随后变为 active，决定如何拆解请求并发出 <DELEGATE_TO>Worker A</DELEGATE_TO>。",
      "Worker A 在其 LLM 调用运行期间变为 thinking，随后在流回结果时变为 active。",
      "lead 再次变为 thinking 以读取 Worker A 的输出并决定下一步——可能委派给 Worker B，也可能直接用 <FINAL_ANSWER> 作答。",
      "所有当前未参与的员工全程保持 idle——它们只是尚未被拓扑激活的节点而已。",
    ],

    roleH2: "role 没有固定词汇表",
    roleP: "role 和 system_prompt 都是纯字符串，不是职位下拉列表。这是刻意设计：软件公司的员工（\"后端工程师\"\"QA 自动化\"）和研究实验室的员工（\"文献综述分析师\"\"统计审核员\"）完全不同，schema 并不试图预判您可能构建的每一种公司类型。当您在聊天中向 AI Office Designer 描述一家公司时，它会提出与之匹配的角色和提示词——您可以直接接受，也可以之后打开 Staff Builder 手动重写任何内容。",

    subagentsH2: "子智能体：当一个员工需要并发展开工作时",
    subagentsP: "大多数员工按回合工作：思考、行动、交接。开启 subagent_enabled 会改变这一点：该员工可以在回合中途生成若干有限数量的并行子智能体，并发处理任务中彼此独立的部分，而不是逐一处理。当一个回合确实可以拆分为互不相关、不需要看到彼此中间输出的子任务时（例如\"研究这五个竞争对手\"），这个能力就很有用。",
    subagentsCalloutP1: "并发数量和轮次并非无限——它们由 config.yml 中的",
    subagentsCalloutP2: "全局限制，并且子智能体执行的每一条命令仍然要经过沙箱，这才是真正的安全边界（关于本地与 Kubernetes 沙箱模式的区别见",
    subagentsCalloutP3: "）。",
    sandboxLink: "Deployment",

    createH2: "两种创建 Staff 的方式",
    createP1: "在聊天中描述您想要的公司，让 AI Office Designer 作为完整公司方案的一部分，提出整个团队——姓名、角色、提示词，以及每个人需要哪些 Skills。这是最快的路径，也是大多数公司的起点。",
    createP2: "或者在 Staff Builder 中手动构建：选择姓名和头像，自己编写角色和系统提示词，逐个绑定 Skills，并决定是否需要开启子智能体。当您确切知道自己想要什么，或者正在编辑 AI Office Designer 已生成的员工时很有用。",

    restH2: "REST API",
    restP: "POST 同时承担创建和更新——在请求体中带上已存在的 id 即可更新该员工，而不是创建新员工。没有单独的 PATCH 接口。",

    nextH2: "下一步",
    nextDepartments: "了解一组员工如何被组织进六种拓扑之一。",
    nextSkills: "为员工绑定工具——网页搜索、Google 表格、自定义 JS。",
    nextGuide: "创建您第一个员工的实操指南。",
  },
  ja: {
    lead1: "Staff は AI Collective における最小の作業単位です。役割（role）、システムプロンプト、モデル、そして紐づけられた Skills を持つ 1 人の AI ワーカーです。Department、トポロジー、Task といったプラットフォームの他のすべての要素は、Staff に仕事とその仕事をこなすための構造を与えるために存在します。",
    lead2: "Staff は単独では決して動きません。作成しただけでは idle のまま待機し、Department に配置されて初めて動き出します。その時点から、それは Department のトポロジーグラフ内の 1 ノードとなり、いつ発言するか、何を見るか、次に誰へ渡すかを決めるのは Staff 自身ではなくトポロジーです。単独の Staff を理解しただけでは全体像の半分しか見えません。残り半分は",
    leadDepartmentsLink: "Departments",
    lead3: " のページにあり、そこでは Staff のグループが協調する 6 つの方法を扱います。",

    schemaH2: "Staff の正体",
    schemaP: "すべての Staff は次の形のレコードです（server/domain/models.py）。API から隠されているものは何もありません。Staff Builder の UI で見えているのは、これらのフィールドそのものに薄く被さったフォームにすぎません。",
    fieldsH2: "フィールドごとの解説",
    fields: [
      { f: "role / description", d: "自由記述。固定の職種一覧はありません——詳細は下記「role に固定語彙はない」を参照。" },
      { f: "system_prompt", d: "このスタッフが毎ターン推論の拠り所とする指示。スタッフの振る舞いを変える上で最も影響力の大きいフィールドです。" },
      { f: "skill_ids", d: "このスタッフが呼び出せる Skills（ツール）——ウェブ検索から Google スプレッドシート連携、カスタム JS 関数まで。" },
      { f: "status", d: "リアルタイムに変化する 3 つの値のいずれか——詳細は下記「status：外から見た実行の様子」を参照。" },
      { f: "subagent_enabled", d: "このスタッフが厳密に一手ずつ進める代わりに、ターンの途中で並列サブエージェントを生成できるかどうか。" },
      { f: "owner_id", d: "\"default\" は、どの会社もクローンできる管理者管理の共有カタログを示します（Recruiting を参照）。それ以外はこの Staff を所有する会社/ユーザーの id です。" },
    ],

    statusH2: "status：外から見た実行の様子",
    statusP: "Department が実行中の間、その中の各 Staff は 3 つの状態のいずれかを持ち、実行が Server-Sent Events でストリーミングされるにつれて UI はリアルタイムに更新されます。",
    statuses: [
      { s: "idle", d: "現在アクティブなターンに参加していない。部門内のほとんどのスタッフはほとんどの時間この状態にあります——次に誰の番かはトポロジーだけが決めます。" },
      { s: "thinking", d: "このスタッフのターンの LLM 呼び出しが進行中。オーケストレーターがこのスタッフに制御を渡した瞬間、テキストがストリームバックされる前にこの状態になります。" },
      { s: "active", d: "このスタッフが出力を生成した直後、あるいは実行中の現在の（または直前の）発言者である状態。" },
    ],
    statusWalkthroughH2: "具体的な例",
    statusWalkthroughP: "Department が supervisor モードで、lead 1 人と worker 2 人で実行されているとします。Task が入ってきます。",
    statusSteps: [
      "lead スタッフが thinking に切り替わり、次に active になってリクエストの分解方法を決め、<DELEGATE_TO>Worker A</DELEGATE_TO> を発行する。",
      "Worker A は LLM 呼び出しが実行されている間 thinking になり、結果をストリームバックする際に active になる。",
      "lead は Worker A の出力を読んで次のステップ（Worker B への委任か、<FINAL_ANSWER> による直接回答か）を決めるため再び thinking になる。",
      "その時点で関与していないすべてのスタッフはずっと idle のまま——単にトポロジーがまだ有効化していないノードというだけです。",
    ],

    roleH2: "role に固定語彙はない",
    roleP: "role と system_prompt は単なる文字列であり、職種のドロップダウンではありません。これは意図的な設計です。ソフトウェア会社のスタッフ（「バックエンドエンジニア」「QA 自動化」）と研究ラボのスタッフ（「文献レビューアナリスト」「統計レビュアー」）はまったく異なり、スキーマはあなたが構築しうるすべての会社タイプを先回りして想定しようとはしません。チャットで AI Office Designer に会社を説明すると、それに合った役割とプロンプトを提案します——そのまま採用しても構いませんし、後で Staff Builder を開いて手動で書き換えることもできます。",

    subagentsH2: "サブエージェント：スタッフが処理を分散させたいとき",
    subagentsP: "ほとんどのスタッフはターンごとに動作します：考え、行動し、引き渡す。subagent_enabled を有効にすると、このスタッフはターンの途中で、独立したサブタスクを逐次ではなく並行して処理するために、有限個の並列サブエージェントを生成できるようになります。1 ターンが本当に無関係なサブタスク（例:「この 5 社の競合を調査して」）に分解でき、互いの中間出力を見る必要がない場合に有用です。",
    subagentsCalloutP1: "並行数とターン数は無制限ではありません——config.yml の",
    subagentsCalloutP2: "によってグローバルに制限され、サブエージェントが発行するすべてのコマンドはサンドボックスを経由します。これが実際のセキュリティ境界です（ローカルと Kubernetes のサンドボックスモードの違いは",
    subagentsCalloutP3: "を参照）。",
    sandboxLink: "Deployment",

    createH2: "Staff を作成する 2 つの方法",
    createP1: "チャットで構築したい会社を説明し、AI Office Designer に会社全体のプランの一部として、名前・役割・プロンプト・各員に必要な Skills を含むチーム全体を提案してもらう。これが最速のルートであり、ほとんどの会社がここから始めます。",
    createP2: "あるいは Staff Builder で手動構築する：名前とアバターを選び、役割とシステムプロンプトを自分で書き、Skills を 1 つずつ紐づけ、サブエージェントを有効にするか決める。何が欲しいか正確にわかっている場合や、AI Office Designer が生成済みのスタッフを編集する場合に有用です。",

    restH2: "REST API",
    restP: "POST は作成と更新の両方を兼ねます。既存の id を body に含めると、新規作成ではなくそのスタッフを更新します。専用の PATCH エンドポイントはありません。",

    nextH2: "次に読む",
    nextDepartments: "スタッフのグループが 6 つのトポロジーのどれに組み込まれるかを見る。",
    nextSkills: "ウェブ検索、Google スプレッドシート、カスタム JS などのツールをスタッフに紐づける。",
    nextGuide: "最初のスタッフを作成する実践ガイド。",
  },
} as const;

export default function StaffDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Staff</H1>
      <P>{t.lead1}</P>
      <P>
        {t.lead2}
        <DocLink id="departments" onNavigate={onNavigate}>{t.leadDepartmentsLink}</DocLink>
        {t.lead3}
      </P>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Staff:\n    id: str\n    name: str\n    role: str\n    description: str\n    skill_ids: list[str]\n    status: StaffStatus          # "active" | "idle" | "thinking"\n    avatar: str\n    avatar_icon: str = ""\n    avatar_color: str = ""\n    avatar_url: str = ""\n    system_prompt: str = ""\n    subagent_enabled: bool = False\n    owner_id: str = "default"`} />

      <H2>{t.fieldsH2}</H2>
      <UL>
        {t.fields.map(({ f, d }) => (
          <LI key={f}><InlineCode>{f}</InlineCode> — {d}</LI>
        ))}
      </UL>

      <H2>{t.statusH2}</H2>
      <P>{t.statusP}</P>
      <UL>
        {t.statuses.map(({ s, d }) => (
          <LI key={s}><InlineCode>{s}</InlineCode> — {d}</LI>
        ))}
      </UL>

      <H2>{t.statusWalkthroughH2}</H2>
      <P>{t.statusWalkthroughP}</P>
      <OL>
        {t.statusSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>

      <H2>{t.roleH2}</H2>
      <P>{t.roleP}</P>

      <H2>{t.subagentsH2}</H2>
      <P>{t.subagentsP}</P>
      <Callout type="info">
        {t.subagentsCalloutP1} <InlineCode>staff.subagent_max_concurrent</InlineCode> / <InlineCode>staff.subagent_max_turns</InlineCode> {t.subagentsCalloutP2} <DocLink id="deploy-docker" onNavigate={onNavigate}>{t.sandboxLink}</DocLink> {t.subagentsCalloutP3}
      </Callout>

      <H2>{t.createH2}</H2>
      <P>{t.createP1}</P>
      <P>{t.createP2}</P>

      <H2>{t.restH2}</H2>
      <P>{t.restP}</P>
      <CodeBlock lang="bash" title="Create or update a staff member" code={`curl -X POST http://localhost:8000/api/v1/staff \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Alice",\n    "role": "Research Staff",\n    "description": "Gathers and summarizes web research.",\n    "skill_ids": [],\n    "status": "idle",\n    "avatar": "A",\n    "subagent_enabled": false\n  }'`} />
      <CodeBlock lang="bash" title="List / delete" code={`curl http://localhost:8000/api/v1/staff\ncurl -X DELETE http://localhost:8000/api/v1/staff/{staff_id}`} />

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={t.nextDepartments} />
        <NextStepCard id="skills" onNavigate={onNavigate} title="Skills" desc={t.nextSkills} />
        <NextStepCard id="guide-first-staff" onNavigate={onNavigate} title={lang === "vi" ? "Hướng dẫn" : lang === "zh" ? "指南" : lang === "ja" ? "ガイド" : "Guide"} desc={t.nextGuide} />
      </NextSteps>
    </div>
  );
}
