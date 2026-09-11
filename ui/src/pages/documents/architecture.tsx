import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, InlineCode, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "The backend follows a ports-and-adapters (hexagonal) architecture with strict layer separation and fully asynchronous execution. Dependencies point inward: the domain layer knows nothing about the web framework, storage, or any concrete adapter.",

    whyH2: "Why the layers exist",
    whyP1: "The rule that makes this architecture worth the ceremony is simple: server/domain/ never imports from server/app/, server/api/, or server/infra/. Business logic — what a Task's status transitions look like, what fields a Company has, what counts as a valid Skill — is expressed once, in plain Python dataclasses, with zero knowledge of FastAPI, Motor, or any specific LLM SDK.",
    whyP2: "That constraint is what lets storage and task-queue backends be swapped in config.yml with no code changes (see \"Scales from a laptop to a cluster\" below) — the domain layer has no idea whether it's being called from a JSON-file repository or a MongoDB one, because it never sees the repository at all. It only sees the Protocol that server/app/ports/ defines, and server/api/deps.py — the composition root — is the one place that decides which concrete adapter satisfies that Protocol at runtime.",

    layersH2: "Layers",
    layers: [
      { path: "server/api/", d: "FastAPI app, routers, Pydantic request/response schemas, auth, and deps.py — the composition root that wires concrete adapters into services." },
      { path: "server/app/", d: "Use-case services. Depends only on server/app/ports/* Protocols (repositories, llm, agent_graph) — never on a concrete adapter directly." },
      { path: "server/domain/", d: "Framework-free business logic plus models.py (frozen dataclasses: Skill, Staff, Department, Task, Project, Epic, Sprint, Company, Connection, ...). Imports nothing from app, api, or infra." },
      { path: "server/infra/", d: "Adapters that implement app.ports — repositories (JSON/Mongo), LLM providers, task queues, distributed locks, sandbox execution." },
      { path: "server/log/", d: "Logging setup." },
    ],
    errorsCallout: "Domain errors (NotFoundError, ValidationError) don't know about HTTP at all — they're translated to 404 / 422 responses by exception handlers registered once in server/api/main.py, which is the only layer that's allowed to know what an HTTP status code even is.",

    lifecycleH2: "A request, end to end",
    lifecycleP: "Take the most common path through the system: a user clicks Run on a Task inside a Department. Here's what actually happens, layer by layer:",
    lifecycleSteps: [
      "server/api/routers/llm.py receives the request and calls into the Staff Graph Service, resolved via api/deps.get_staff_graph_service(mode=...) — the composition root picks the concrete LangGraph orchestrator matching the Department's mode.",
      "The matching orchestrator (server/domain/staff/langgraph_*.py) compiles and runs its LangGraph state machine. Each staff turn resolves that Staff's bound Skills, builds a prompt, and calls the configured LLM provider through a shared safe_chat wrapper (timeout + retry).",
      "As each step completes, an SSE event is written to the stream immediately — the frontend doesn't wait for the whole run, it renders turn_complete, llm_response_complete, and the rest of the EventType enum as they happen.",
      "In parallel, the knowledge graph extractor ingests the new turn (spaCy static parsing or an LLM semantic pass, per graph.build_mode) and analytics/activity-feed records are updated — none of this blocks the SSE stream.",
      "If something in the domain layer raises NotFoundError or ValidationError at any point, the registered exception handlers in server/api/main.py turn it into a 404 or 422 before it reaches the client — the orchestrator and domain code never construct an HTTP response themselves.",
    ],

    scaleH2: "Scales from a laptop to a cluster",
    scaleP1: "On day one, none of this needs external infrastructure. A single developer runs the backend as one process, with JSON files on disk, a thread pool for concurrency, and an in-process lock — and every architectural boundary described above is already in place, doing nothing more exotic than reading files.",
    scaleP2: "As a team grows past what one process can handle, the same code runs distributed: swap the storage, task-queue, and lock backends independently, each via a single line in config.yml, with zero application-code changes. Every infrastructure concern is swappable this way:",
    scaleRows: [
      { k: "Storage", v: "storage.backend: json (files under storage.dir, default) or mongo" },
      { k: "Task queue", v: "task_queue.backend: memory (in-process ThreadPoolExecutor, default) or rabbitmq" },
      { k: "Distributed lock", v: "lock.backend: threading (default) or redis" },
      { k: "Sandbox", v: "sandbox.mode: local (subprocess, default) or k8s (per-request Pods via a provisioner service)" },
    ],

    nextConfig: "The full config.yml reference — every setting that drives this scaling story.",
    nextDeploy: "Docker Compose stacks for both the laptop and distributed setups.",
    nextDepartments: "The six LangGraph topologies referenced in the request lifecycle above.",
  },
  vi: {
    intro: "Backend tuân theo kiến trúc ports-and-adapters (hexagonal) với sự phân tách tầng nghiêm ngặt và thực thi hoàn toàn bất đồng bộ (async). Các phụ thuộc luôn hướng vào trong: tầng domain không biết gì về web framework, lưu trữ, hay bất kỳ adapter cụ thể nào.",

    whyH2: "Tại sao lại phân tầng như vậy",
    whyP1: "Quy tắc khiến kiến trúc này đáng công sức rất đơn giản: server/domain/ không bao giờ import từ server/app/, server/api/, hay server/infra/. Logic nghiệp vụ — các trạng thái chuyển đổi của một Task trông ra sao, một Company có những trường nào, thế nào là một Skill hợp lệ — chỉ được diễn đạt một lần, bằng các dataclass Python thuần, không biết gì về FastAPI, Motor, hay bất kỳ SDK LLM cụ thể nào.",
    whyP2: "Chính ràng buộc đó cho phép hoán đổi backend lưu trữ và hàng đợi tác vụ trong config.yml mà không cần sửa code (xem \"Mở rộng từ laptop tới cluster\" bên dưới) — tầng domain không hề biết nó đang được gọi từ một repository JSON-file hay một repository MongoDB, vì nó không bao giờ thấy repository đó. Nó chỉ thấy Protocol mà server/app/ports/ định nghĩa, và server/api/deps.py — composition root — là nơi duy nhất quyết định adapter cụ thể nào sẽ đáp ứng Protocol đó tại runtime.",

    layersH2: "Các tầng",
    layers: [
      { path: "server/api/", d: "Ứng dụng FastAPI, routers, schema Pydantic cho request/response, auth, và deps.py — composition root nối các adapter cụ thể vào các service." },
      { path: "server/app/", d: "Các service theo use-case. Chỉ phụ thuộc vào các Protocol trong server/app/ports/* (repositories, llm, agent_graph) — không bao giờ phụ thuộc trực tiếp vào adapter cụ thể." },
      { path: "server/domain/", d: "Logic nghiệp vụ không phụ thuộc framework, cùng models.py (các dataclass frozen: Skill, Staff, Department, Task, Project, Epic, Sprint, Company, Connection, ...). Không import gì từ app, api, hay infra." },
      { path: "server/infra/", d: "Các adapter hiện thực app.ports — repository (JSON/Mongo), nhà cung cấp LLM, hàng đợi tác vụ, khóa phân tán, thực thi sandbox." },
      { path: "server/log/", d: "Cấu hình logging." },
    ],
    errorsCallout: "Lỗi domain (NotFoundError, ValidationError) hoàn toàn không biết gì về HTTP — chúng được chuyển thành phản hồi 404 / 422 bởi các exception handler đăng ký một lần trong server/api/main.py, tầng duy nhất được phép biết mã trạng thái HTTP là gì.",

    lifecycleH2: "Một request, từ đầu đến cuối",
    lifecycleP: "Hãy xem đường đi phổ biến nhất qua hệ thống: người dùng bấm Run trên một Task bên trong một Department. Đây là những gì thực sự xảy ra, từng tầng một:",
    lifecycleSteps: [
      "server/api/routers/llm.py nhận request và gọi vào Staff Graph Service, được resolve qua api/deps.get_staff_graph_service(mode=...) — composition root chọn đúng orchestrator LangGraph khớp với mode của Department.",
      "Orchestrator tương ứng (server/domain/staff/langgraph_*.py) biên dịch và chạy cỗ máy trạng thái LangGraph của nó. Mỗi lượt staff phân giải các Skill được gắn, dựng prompt, và gọi nhà cung cấp LLM đã cấu hình qua một wrapper safe_chat dùng chung (timeout + retry).",
      "Khi mỗi bước hoàn tất, một sự kiện SSE được ghi ngay vào stream — frontend không đợi cả phiên chạy xong, nó render turn_complete, llm_response_complete, và các event khác trong EventType enum ngay khi chúng xảy ra.",
      "Song song đó, bộ trích xuất knowledge graph nạp lượt mới (phân tích tĩnh bằng spaCy hoặc một lượt ngữ nghĩa bằng LLM, tùy graph.build_mode) và các bản ghi analytics/activity-feed được cập nhật — không cái nào trong số này chặn luồng SSE.",
      "Nếu tầng domain raise NotFoundError hay ValidationError ở bất kỳ đâu, các exception handler đã đăng ký trong server/api/main.py sẽ biến nó thành 404 hoặc 422 trước khi tới client — orchestrator và domain code không bao giờ tự dựng response HTTP.",
    ],

    scaleH2: "Mở rộng từ laptop tới cluster",
    scaleP1: "Ở ngày đầu tiên, không thứ nào trong số này cần hạ tầng ngoài. Một lập trình viên chạy backend như một tiến trình duy nhất, với file JSON trên đĩa, một thread pool cho concurrency, và một lock trong tiến trình — và mọi ranh giới kiến trúc mô tả ở trên đã sẵn sàng, không làm gì kỳ lạ hơn việc đọc file.",
    scaleP2: "Khi một đội nhóm vượt quá khả năng của một tiến trình, cùng một đoạn mã đó chạy phân tán: hoán đổi backend lưu trữ, hàng đợi tác vụ, và lock một cách độc lập, mỗi cái chỉ qua một dòng trong config.yml, không sửa code ứng dụng. Mọi thành phần hạ tầng đều hoán đổi được theo cách này:",
    scaleRows: [
      { k: "Lưu trữ", v: "storage.backend: json (file trong storage.dir, mặc định) hoặc mongo" },
      { k: "Hàng đợi tác vụ", v: "task_queue.backend: memory (ThreadPoolExecutor trong tiến trình, mặc định) hoặc rabbitmq" },
      { k: "Khóa phân tán", v: "lock.backend: threading (mặc định) hoặc redis" },
      { k: "Sandbox", v: "sandbox.mode: local (subprocess, mặc định) hoặc k8s (Pod theo từng request qua provisioner service)" },
    ],

    nextConfig: "Tài liệu tham chiếu đầy đủ về config.yml — mọi setting dẫn dắt câu chuyện mở rộng quy mô này.",
    nextDeploy: "Các stack Docker Compose cho cả thiết lập laptop lẫn phân tán.",
    nextDepartments: "Sáu topology LangGraph được nhắc tới trong vòng đời request ở trên.",
  },
  zh: {
    intro: "后端遵循端口与适配器（ports-and-adapters，六边形）架构，具有严格的分层与完全异步的执行方式。依赖始终指向内部：领域层（domain）对 Web 框架、存储或任何具体适配器一无所知。",

    whyH2: "为什么要这样分层",
    whyP1: "让这套架构值得投入的那条规则很简单：server/domain/ 永远不会从 server/app/、server/api/ 或 server/infra/ 导入任何东西。业务逻辑——一个 Task 的状态如何流转、一个 Company 有哪些字段、什么样的 Skill 才算合法——只用纯 Python 数据类表达一次，对 FastAPI、Motor 或任何具体的 LLM SDK 一无所知。",
    whyP2: "正是这个约束，使得存储和任务队列后端可以在 config.yml 中切换而无需改动代码（见下文\"从笔记本电脑扩展到集群\"）——领域层根本不知道自己是被一个 JSON 文件仓储还是一个 MongoDB 仓储调用的，因为它压根看不到仓储本身。它只能看到 server/app/ports/ 定义的 Protocol，而 server/api/deps.py——组合根（composition root）——是唯一在运行时决定由哪个具体适配器满足该 Protocol 的地方。",

    layersH2: "分层",
    layers: [
      { path: "server/api/", d: "FastAPI 应用、路由、请求/响应的 Pydantic 模式、认证，以及 deps.py——将具体适配器接入各个服务的组合根（composition root）。" },
      { path: "server/app/", d: "用例服务层。仅依赖 server/app/ports/* 中的 Protocol（repositories、llm、agent_graph）——绝不直接依赖具体适配器。" },
      { path: "server/domain/", d: "不依赖框架的业务逻辑，以及 models.py（不可变数据类：Skill、Staff、Department、Task、Project、Epic、Sprint、Company、Connection 等）。不从 app、api 或 infra 导入任何内容。" },
      { path: "server/infra/", d: "实现 app.ports 的适配器——仓储（JSON/Mongo）、LLM 提供方、任务队列、分布式锁、沙箱执行。" },
      { path: "server/log/", d: "日志配置。" },
    ],
    errorsCallout: "领域错误（NotFoundError、ValidationError）完全不知道 HTTP 是什么——它们由 server/api/main.py 中一次性注册的异常处理器转换为 404 / 422 响应，而这是唯一被允许知道 HTTP 状态码这回事的层。",

    lifecycleH2: "一次请求的完整链路",
    lifecycleP: "以系统中最常见的路径为例：用户在某个 Department 内点击某个 Task 的 Run。以下是逐层实际发生的事情：",
    lifecycleSteps: [
      "server/api/routers/llm.py 接收请求，并调用通过 api/deps.get_staff_graph_service(mode=...) 解析得到的 Staff Graph Service——组合根会选出与该 Department 的 mode 匹配的具体 LangGraph 编排器。",
      "匹配的编排器（server/domain/staff/langgraph_*.py）编译并运行其 LangGraph 状态机。每个员工回合解析该员工绑定的 Skills，构建提示词，并通过共享的 safe_chat 包装器（超时 + 重试）调用配置好的 LLM 提供方。",
      "每完成一步，SSE 事件会立即写入流——前端不会等待整个运行结束，而是在 turn_complete、llm_response_complete 等 EventType 枚举事件发生时立即渲染它们。",
      "与此同时，知识图谱提取器会摄取新的回合（根据 graph.build_mode，采用 spaCy 静态解析或 LLM 语义分析），analytics/activity-feed 记录也会更新——这些都不会阻塞 SSE 流。",
      "如果领域层在任何时刻抛出 NotFoundError 或 ValidationError，server/api/main.py 中注册的异常处理器会在响应到达客户端之前将其转换为 404 或 422——编排器和领域代码本身从不构造 HTTP 响应。",
    ],

    scaleH2: "从笔记本电脑扩展到集群",
    scaleP1: "第一天，这一切都不需要任何外部基础设施。一名开发者把后端当作单一进程运行，磁盘上是 JSON 文件，用线程池处理并发，用进程内锁——上面描述的每一条架构边界已经就位，做的事情不过是读写文件而已。",
    scaleP2: "当团队规模超出单一进程所能承载时，同一份代码就能分布式运行：分别通过 config.yml 中的一行配置切换存储、任务队列和锁后端，应用代码零改动。每一个基础设施组件都能以这种方式切换：",
    scaleRows: [
      { k: "存储", v: "storage.backend: json（默认，文件存于 storage.dir）或 mongo" },
      { k: "任务队列", v: "task_queue.backend: memory（默认，进程内 ThreadPoolExecutor）或 rabbitmq" },
      { k: "分布式锁", v: "lock.backend: threading（默认）或 redis" },
      { k: "沙箱", v: "sandbox.mode: local（默认，子进程）或 k8s（通过 provisioner 服务按请求创建 Pod）" },
    ],

    nextConfig: "完整的 config.yml 参考——驱动这整套扩容故事的每一个设置项。",
    nextDeploy: "覆盖笔记本电脑与分布式两种部署形态的 Docker Compose 部署栈。",
    nextDepartments: "上文请求链路中提到的六种 LangGraph 拓扑。",
  },
  ja: {
    intro: "バックエンドはポート＆アダプター（ヘキサゴナル）アーキテクチャに従い、厳密なレイヤー分離と完全非同期実行を採用しています。依存は常に内側へ向かいます。ドメイン層は Web フレームワーク、ストレージ、具体的なアダプターについて一切知りません。",

    whyH2: "なぜこのようにレイヤー分けするのか",
    whyP1: "このアーキテクチャに手間をかける価値を生んでいるルールはシンプルです。server/domain/ は決して server/app/、server/api/、server/infra/ からインポートしません。ビジネスロジック——Task のステータス遷移がどう見えるか、Company にどんなフィールドがあるか、何が有効な Skill とみなされるか——は、FastAPI、Motor、特定の LLM SDK について一切知らない、素の Python データクラスとして一度だけ表現されます。",
    whyP2: "この制約こそが、config.yml でストレージやタスクキューのバックエンドをコード変更なしに切り替えられる理由です（下記「ノート PC からクラスタまでスケール」参照）。ドメイン層は、自分が JSON ファイルのリポジトリから呼ばれているのか MongoDB のリポジトリから呼ばれているのか一切知りません。リポジトリそのものを見ることが決してないからです。見えるのは server/app/ports/ が定義する Protocol だけであり、server/api/deps.py（構成ルート）が、実行時にどの具体的なアダプターがその Protocol を満たすかを決める唯一の場所です。",

    layersH2: "レイヤー",
    layers: [
      { path: "server/api/", d: "FastAPI アプリ、ルーター、リクエスト/レスポンスの Pydantic スキーマ、認証、そして具体的なアダプターをサービスに配線する構成ルートである deps.py。" },
      { path: "server/app/", d: "ユースケースサービス。server/app/ports/* の Protocol（repositories、llm、agent_graph）にのみ依存し、具体的なアダプターに直接依存することはありません。" },
      { path: "server/domain/", d: "フレームワーク非依存のビジネスロジックと models.py（不変データクラス：Skill、Staff、Department、Task、Project、Epic、Sprint、Company、Connection など）。app、api、infra からは何もインポートしません。" },
      { path: "server/infra/", d: "app.ports を実装するアダプター — リポジトリ（JSON/Mongo）、LLM プロバイダー、タスクキュー、分散ロック、サンドボックス実行。" },
      { path: "server/log/", d: "ロギング設定。" },
    ],
    errorsCallout: "ドメインエラー（NotFoundError、ValidationError）は HTTP について一切知りません。server/api/main.py に一度だけ登録された例外ハンドラーによって 404 / 422 レスポンスに変換されます。HTTP ステータスコードが何であるかを知ることを許されているのはこのレイヤーだけです。",

    lifecycleH2: "リクエストのエンドツーエンド",
    lifecycleP: "システム内で最も一般的な経路を見てみましょう。ユーザーが Department 内の Task の Run をクリックします。レイヤーごとに実際に起きることは次のとおりです。",
    lifecycleSteps: [
      "server/api/routers/llm.py がリクエストを受け取り、api/deps.get_staff_graph_service(mode=...) 経由で解決される Staff Graph Service を呼び出します——構成ルートが Department の mode に一致する具体的な LangGraph オーケストレーターを選びます。",
      "一致するオーケストレーター（server/domain/staff/langgraph_*.py）がその LangGraph ステートマシンをコンパイルして実行します。各スタッフのターンは、そのスタッフに紐づく Skills を解決し、プロンプトを構築し、共有の safe_chat ラッパー（タイムアウト + リトライ）経由で設定済みの LLM プロバイダーを呼び出します。",
      "各ステップが完了するたびに SSE イベントが即座にストリームへ書き込まれます——フロントエンドは実行全体の完了を待たず、turn_complete や llm_response_complete などの EventType enum のイベントが発生した瞬間にレンダリングします。",
      "並行して、ナレッジグラフ抽出器が新しいターンを取り込み（graph.build_mode に応じて spaCy による静的解析、または LLM による意味解析）、analytics / activity-feed の記録が更新されます——これらはいずれも SSE ストリームをブロックしません。",
      "ドメイン層のどこかで NotFoundError や ValidationError が発生した場合、server/api/main.py に登録された例外ハンドラーがクライアントに届く前にそれを 404 または 422 に変換します。オーケストレーターとドメインコードは自分で HTTP レスポンスを組み立てることは決してありません。",
    ],

    scaleH2: "ノート PC からクラスタまでスケール",
    scaleP1: "初日には、これらのどれも外部インフラを必要としません。1 人の開発者がバックエンドを単一プロセスとして実行し、ディスク上に JSON ファイル、並行処理にはスレッドプール、ロックはプロセス内ロックを使います——上記のアーキテクチャ境界はすべてすでに存在しており、ファイルを読み書きする以上の変わったことは何もしていません。",
    scaleP2: "チームが 1 プロセスで処理しきれない規模に成長したら、同じコードが分散実行されます。ストレージ、タスクキュー、ロックの各バックエンドを、それぞれ config.yml の 1 行で独立に切り替え、アプリケーションコードの変更はゼロです。すべてのインフラ要素はこのように切り替え可能です。",
    scaleRows: [
      { k: "ストレージ", v: "storage.backend: json（デフォルト、storage.dir 配下のファイル）または mongo" },
      { k: "タスクキュー", v: "task_queue.backend: memory（デフォルト、プロセス内 ThreadPoolExecutor）または rabbitmq" },
      { k: "分散ロック", v: "lock.backend: threading（デフォルト）または redis" },
      { k: "サンドボックス", v: "sandbox.mode: local（デフォルト、サブプロセス）または k8s（provisioner サービス経由でリクエストごとに Pod を作成）" },
    ],

    nextConfig: "この拡張性を支える設定を網羅した config.yml の完全なリファレンス。",
    nextDeploy: "ノート PC 構成と分散構成の両方をカバーする Docker Compose スタック。",
    nextDepartments: "上記のリクエストライフサイクルで触れた 6 つの LangGraph トポロジー。",
  },
} as const;

export default function ArchitectureDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Architecture</H1>
      <P>{t.intro}</P>

      <CodeBlock lang="text" title="Request lifecycle" code={`┌─────────────────────────────────────────────────┐\n│                  React Frontend                  │\n│         (Vite + TypeScript + Radix UI)           │\n└───────────────────────┬─────────────────────────┘\n                        │ REST API / SSE\n┌───────────────────────▼─────────────────────────┐\n│              FastAPI Backend (server/api)        │\n│  Staff Graph Service ── mode dispatch            │\n│    sequential · ring · mesh · supervisor         │\n│    tree · custom                                 │\n│  Staff Executor ── Skill / Tool Bindings         │\n└───────────────────────┬─────────────────────────┘\n                        │\n          ┌─────────────▼──────────────┐\n          │ Gemini · OpenAI · Claude ·  │\n          │ OpenRouter (swappable)      │\n          └─────────────┬──────────────┘\n                        │\n          ┌─────────────▼──────────────┐\n          │ SSE Stream → Frontend       │\n          │ Knowledge Graph + Analytics │\n          └─────────────────────────────┘`} />

      <H2>{t.whyH2}</H2>
      <P>{t.whyP1}</P>
      <P>{t.whyP2}</P>

      <H2>{t.layersH2}</H2>
      <UL>
        {t.layers.map(({ path, d }) => (
          <LI key={path}><InlineCode>{path}</InlineCode> — {d}</LI>
        ))}
      </UL>
      <Callout type="info">{t.errorsCallout}</Callout>

      <H2>{t.lifecycleH2}</H2>
      <P>{t.lifecycleP}</P>
      <OL>
        {t.lifecycleSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>

      <H2>{t.scaleH2}</H2>
      <P>{t.scaleP1}</P>
      <P>{t.scaleP2}</P>
      <UL>
        {t.scaleRows.map(({ k, v }) => (
          <LI key={k}><strong>{k}:</strong> {v}</LI>
        ))}
      </UL>

      <NextSteps>
        <NextStepCard id="configuration" onNavigate={onNavigate} title="Configuration" desc={t.nextConfig} />
        <NextStepCard id="deploy-docker" onNavigate={onNavigate} title="Deployment" desc={t.nextDeploy} />
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={t.nextDepartments} />
      </NextSteps>
    </div>
  );
}
