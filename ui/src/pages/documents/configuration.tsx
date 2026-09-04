import { H1, H2, P, Callout, CodeBlock, InlineCode, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "config.yml (lives at .config/config.yml, override the path with CONFIG_FILE=/path) is the single, complete source for every backend setting — including secrets. No part of the backend reads a bare OS or .env variable to configure itself. If a setting exists, it exists as a key somewhere in this one file.",

    precedenceH2: "The precedence model",
    precedenceP1: "There are exactly two layers, in order: code defaults, then config.yml. Nothing else participates — no per-environment override files, no settings scattered across multiple configs that get merged in some order you have to remember.",
    precedenceP2: "Where it gets interesting is that any value inside config.yml can itself be an ${VAR} (or ${VAR:-default}) reference, expanded from .env or the OS environment at load time by config_loader.load_config(). That's the only path an environment variable has into a setting — the backend never calls os.environ.get() directly for application config. Concretely:",
    precedenceExampleP: "Given this line in config.yml:",
    precedenceExample2P: "and this line in .env:",
    precedenceExample3P: "the loaded setting ends up as settings.auth.jwt_secret_key == \"a-long-random-string\". Delete or rename the .env entry and the reference simply resolves to an empty string (or the ${VAR:-default} fallback if one's specified) — there's no silent fallback to some other source.",

    whyH2: "Why config.yml instead of environment variables",
    whyP: "This is a deliberate choice, not an accident of how the project grew. A single YAML file is something you can open, read top to bottom, and diff between two deployments — a scattered pile of env vars across docker-compose files, CI secrets, and shell profiles is not. It also removes an entire class of \"works on my machine\" bugs where one environment has a var set and another doesn't, silently falling back to a code default nobody remembers exists. config.yml is checked into git (secrets are ${VAR} references, not literal values, so this is safe), which means a config change is a reviewable diff like any other code change.",

    sectionsH2: "Sections map 1:1 to Settings",
    sectionsP: "Settings are nested by top-level config.yml key and exposed the same way in code — settings.staff.context_token_limit reads the staff: section, settings.security.allow_private_http reads security:, and so on. A handful of frequently-used values also have flat @property delegates on the root Settings object for older call sites, but the section-nested form is the source of truth.",
    sectionsTableH: ["Section", "Governs"],
    sectionsTable: [
      ["app", "app name, environment, API prefix (default /api/v1)"],
      ["models", "the LLM provider list — see below"],
      ["staff", "context/output token budgets, subagent concurrency and turn limits"],
      ["storage", "json or mongo persistence backend"],
      ["task_queue", "memory or rabbitmq task execution backend"],
      ["lock", "threading or redis distributed lock backend"],
      ["sandbox", "local or k8s code-execution backend"],
      ["graph", "static (spaCy) or llm knowledge-graph build mode"],
      ["auth", "JWT secret/expiry, Google OAuth client credentials"],
      ["mcp", "MCP server auto-seeding on boot"],
      ["security", "SSRF guard (allow_private_http), CORS, other hardening knobs"],
      ["long_term_memory / embedding / vector_store", "cross-conversation memory, embeddings provider, FAISS/Qdrant backend"],
    ],
    sectionsMoreP: "The full section list also includes logging, middleware, router, mongo, minio, working_memory, retrieval, admin, seed, browser, and tools — each maps to exactly one config.yml top-level key.",

    modelsH2: "The models: list and failover",
    modelsP1: "models: is a LIST, not a single flat provider/model pair — this is the detail that trips people up coming from single-provider setups. Each entry is independently enabled, independently keyed, and carries its own failover policy:",
    modelsP2: "Setting enabled: false on one entry and true on another is a full model swap with zero code changes — the running app picks up the change on its next config reload. failover.strategy has two options: rotate cycles across multiple keys for the same provider when one hits a rate limit (useful for free-tier Gemini keys, which impose per-key RPM/TPM caps), while 9router routes through an external multi-provider proxy that handles fallback across entirely different providers (Claude, OpenAI, Gemini, and 40+ others) with its own subscription → cheap → free tiering.",

    backendsH2: "Storage, queue, and lock backends",
    backendsP: "These three swap independently via a backend: value each — no other code changes needed, and every combination is valid (you could run json storage with a rabbitmq queue, for instance, though mongo+rabbitmq+redis is the typical \"real deployment\" combination):",

    sandboxH2: "Sandbox execution",
    sandboxP: "Sandbox execution has exactly two modes — local (a subprocess on the backend host, fine for development and trusted single-tenant deployments) or k8s (a separate provisioner service spawns per-request Pods with their own lifecycle, for stronger isolation in multi-tenant or untrusted-code scenarios). There is no docker mode, despite that being a common assumption from the docker-compose sandbox profile's name — that profile runs a standalone container for manual debugging, it isn't a third sandbox.mode value.",

    perToolH2: "What's deliberately NOT in config.yml",
    perToolP: "Per-tool credentials — a Slack bot token, a specific user's Google OAuth-connected account, an API key for one company's CRM integration — are not global config. They live inside each Skill's own config dict, stored in the database and edited from the Skills page in the UI, not in this file. The distinction is ownership: config.yml holds settings the operator of the deployment controls; a Skill's config holds settings the end user configuring that integration controls. Mixing the two would mean every tenant's credentials living in one file that also needs to be reviewed and diffed as code.",

    moreCallout: "See docs/configuration.md in the backend repo for the exhaustive key-by-key reference, and .env.template for every secret the shipped config.yml references.",

    nextH2: "Next",
    nextInstall: "What each dependency in this stack actually needs before you touch config.yml.",
    nextDeployEnv: "The full list of .env secrets config.yml can reference.",
    nextConnections: "Per-connection credentials that live outside config.yml entirely.",
  },
  vi: {
    intro: "config.yml (nằm tại .config/config.yml, có thể đổi đường dẫn bằng CONFIG_FILE=/path) là nguồn duy nhất, đầy đủ cho mọi thiết lập backend — kể cả secret. Không phần nào của backend đọc trực tiếp một biến OS hay .env trần để tự cấu hình. Nếu một thiết lập tồn tại, nó tồn tại như một key ở đâu đó trong đúng một file này.",

    precedenceH2: "Mô hình thứ tự ưu tiên",
    precedenceP1: "Chỉ có đúng hai lớp, theo thứ tự: giá trị mặc định trong code, sau đó là config.yml. Không có gì khác tham gia — không có file override theo từng môi trường, không có setting rải rác qua nhiều config rồi merge theo một thứ tự bạn phải nhớ.",
    precedenceP2: "Điều thú vị là bất kỳ giá trị nào trong config.yml cũng có thể tự nó là một tham chiếu ${VAR} (hoặc ${VAR:-default}), được giãn ra từ .env hoặc biến môi trường OS khi tải bởi config_loader.load_config(). Đó là con đường duy nhất một biến môi trường có thể đi vào một thiết lập — backend không bao giờ gọi trực tiếp os.environ.get() để cấu hình ứng dụng. Cụ thể:",
    precedenceExampleP: "Với dòng này trong config.yml:",
    precedenceExample2P: "và dòng này trong .env:",
    precedenceExample3P: "thiết lập được tải cuối cùng sẽ là settings.auth.jwt_secret_key == \"a-long-random-string\". Xóa hoặc đổi tên entry trong .env thì tham chiếu đơn giản sẽ giãn ra thành chuỗi rỗng (hoặc giá trị fallback ${VAR:-default} nếu có chỉ định) — không có fallback ngầm sang nguồn nào khác.",

    whyH2: "Vì sao dùng config.yml thay vì biến môi trường",
    whyP: "Đây là một lựa chọn có chủ đích, không phải một sự tình cờ trong quá trình dự án lớn lên. Một file YAML duy nhất là thứ bạn có thể mở ra, đọc từ đầu đến cuối, và diff giữa hai deployment — một đống biến môi trường rải rác qua các file docker-compose, secret CI, và shell profile thì không. Nó cũng loại bỏ hẳn một nhóm lỗi kiểu \"chạy được trên máy tôi\" khi môi trường này có set biến còn môi trường kia thì không, âm thầm rơi về một giá trị mặc định trong code mà không ai còn nhớ là có tồn tại. config.yml được commit vào git (secret là tham chiếu ${VAR}, không phải giá trị trần, nên việc này an toàn), nghĩa là một thay đổi config cũng là một diff có thể review như bất kỳ thay đổi code nào khác.",

    sectionsH2: "Các section ánh xạ 1:1 với Settings",
    sectionsP: "Settings được lồng theo key cấp cao nhất của config.yml và được truy cập tương tự trong code — settings.staff.context_token_limit đọc section staff:, settings.security.allow_private_http đọc security:, v.v. Một số giá trị hay dùng cũng có @property phẳng trên object Settings gốc để tương thích các call site cũ, nhưng dạng lồng theo section mới là nguồn sự thật.",
    sectionsTableH: ["Section", "Chi phối"],
    sectionsTable: [
      ["app", "tên app, môi trường, API prefix (mặc định /api/v1)"],
      ["models", "danh sách nhà cung cấp LLM — xem bên dưới"],
      ["staff", "ngân sách token context/output, giới hạn số subagent song song và số lượt"],
      ["storage", "backend lưu trữ json hoặc mongo"],
      ["task_queue", "backend thực thi task memory hoặc rabbitmq"],
      ["lock", "backend khóa phân tán threading hoặc redis"],
      ["sandbox", "backend thực thi code local hoặc k8s"],
      ["graph", "chế độ build knowledge-graph static (spaCy) hoặc llm"],
      ["auth", "secret/thời hạn JWT, credential OAuth Google"],
      ["mcp", "tự động seed MCP server khi boot"],
      ["security", "SSRF guard (allow_private_http), CORS, các nút hardening khác"],
      ["long_term_memory / embedding / vector_store", "bộ nhớ xuyên cuộc trò chuyện, provider embedding, backend FAISS/Qdrant"],
    ],
    sectionsMoreP: "Danh sách section đầy đủ còn có logging, middleware, router, mongo, minio, working_memory, retrieval, admin, seed, browser, và tools — mỗi cái ánh xạ chính xác tới một key cấp cao nhất của config.yml.",

    modelsH2: "Danh sách models: và failover",
    modelsP1: "models: là một DANH SÁCH, không phải một cặp provider/model phẳng đơn lẻ — đây là chi tiết hay gây nhầm cho những ai quen với thiết lập một-nhà-cung-cấp. Mỗi entry được bật/tắt độc lập, có key riêng, và mang chính sách failover riêng:",
    modelsP2: "Đặt enabled: false cho một entry và true cho entry khác là một lần đổi model hoàn chỉnh mà không cần sửa code — app đang chạy sẽ nhận thay đổi ở lần reload config tiếp theo. failover.strategy có hai lựa chọn: rotate xoay vòng qua nhiều khóa cho cùng một nhà cung cấp khi một khóa chạm rate limit (hữu ích cho khóa Gemini tier miễn phí, vốn áp giới hạn RPM/TPM theo từng khóa), còn 9router định tuyến qua một proxy đa nhà cung cấp bên ngoài, tự xử lý fallback qua các nhà cung cấp hoàn toàn khác nhau (Claude, OpenAI, Gemini, và 40+ cái khác) với phân tầng subscription → cheap → free riêng.",

    backendsH2: "Backend storage, queue, và lock",
    backendsP: "Ba thứ này đổi độc lập qua một giá trị backend: riêng mỗi cái — không cần sửa code nào khác, và mọi tổ hợp đều hợp lệ (bạn có thể chạy storage json với queue rabbitmq chẳng hạn, dù mongo+rabbitmq+redis là tổ hợp \"deployment thật\" điển hình):",

    sandboxH2: "Thực thi Sandbox",
    sandboxP: "Thực thi sandbox chỉ có đúng hai chế độ — local (một subprocess trên máy chủ backend, ổn cho development và các deployment single-tenant đáng tin cậy) hoặc k8s (một provisioner service riêng tạo Pod theo từng request với vòng đời riêng, để cô lập mạnh hơn trong kịch bản multi-tenant hoặc code không đáng tin). Không có chế độ docker, dù đây là một giả định phổ biến do tên của profile sandbox trong docker-compose — profile đó chạy một container độc lập để debug thủ công, nó không phải là giá trị sandbox.mode thứ ba.",

    perToolH2: "Những gì cố ý KHÔNG nằm trong config.yml",
    perToolP: "Credential riêng của từng tool — token bot Slack, tài khoản Google OAuth đã kết nối của một user cụ thể, API key cho tích hợp CRM của một công ty — không phải config toàn cục. Chúng nằm trong dict config riêng của từng Skill, lưu trong database và chỉnh sửa từ trang Skills trên UI, không nằm trong file này. Sự khác biệt nằm ở quyền sở hữu: config.yml chứa các thiết lập do người vận hành deployment kiểm soát; config của một Skill chứa các thiết lập do người dùng cuối cấu hình tích hợp đó kiểm soát. Trộn lẫn hai thứ này nghĩa là credential của mọi tenant sẽ nằm chung trong một file cũng cần được review và diff như code.",

    moreCallout: "Xem docs/configuration.md trong repo backend để có tham chiếu đầy đủ từng key, và .env.template để biết mọi secret mà config.yml mặc định tham chiếu tới.",

    nextH2: "Tiếp theo",
    nextInstall: "Những gì mỗi dependency trong stack này thực sự cần trước khi bạn đụng tới config.yml.",
    nextDeployEnv: "Danh sách đầy đủ secret .env mà config.yml có thể tham chiếu.",
    nextConnections: "Credential theo từng connection nằm hoàn toàn ngoài config.yml.",
  },
  zh: {
    intro: "config.yml（位于 .config/config.yml，可通过 CONFIG_FILE=/path 覆盖路径）是后端每一项设置——包括密钥——唯一、完整的来源。后端没有任何部分会读取裸的操作系统或 .env 变量来配置自身。如果某项设置存在，它就一定作为某个键存在于这一份文件中的某处。",

    precedenceH2: "优先级模型",
    precedenceP1: "只有两层，按顺序：代码默认值，然后是 config.yml。没有其他任何东西参与其中——没有按环境区分的覆盖文件，没有分散在多个配置中、需要按某种您必须记住的顺序合并的设置。",
    precedenceP2: "有趣的地方在于，config.yml 内部的任何值本身都可以是一个 ${VAR}（或 ${VAR:-default}）引用，在加载时由 config_loader.load_config() 从 .env 或操作系统环境变量展开。这是环境变量进入某项设置的唯一途径——后端从不直接调用 os.environ.get() 来配置应用。具体来说：",
    precedenceExampleP: "假设 config.yml 中有这一行：",
    precedenceExample2P: "而 .env 中有这一行：",
    precedenceExample3P: "加载后的设置最终会是 settings.auth.jwt_secret_key == \"a-long-random-string\"。删除或重命名 .env 中的条目，该引用会直接展开为空字符串（如果指定了 ${VAR:-default} 则使用该回退值）——不存在悄悄回退到其他来源的情况。",

    whyH2: "为什么用 config.yml 而不是环境变量",
    whyP: "这是刻意的选择，不是项目发展中的偶然结果。一份 YAML 文件是您可以打开、从头读到尾、并在两个部署之间进行 diff 的东西——而散落在 docker-compose 文件、CI 密钥和 shell profile 中的一堆环境变量做不到这一点。它也消除了一整类\"在我机器上能跑\"的 bug：某个环境设置了某个变量而另一个没有，于是悄悄回退到某个没人记得存在的代码默认值。config.yml 被提交到 git 中（密钥是 ${VAR} 引用而非字面值，所以这样做是安全的），这意味着一次配置变更也是一个可以像其他代码变更一样被审查的 diff。",

    sectionsH2: "各部分与 Settings 一一对应",
    sectionsP: "设置按 config.yml 顶层键嵌套，并在代码中以相同方式暴露——settings.staff.context_token_limit 读取 staff: 部分，settings.security.allow_private_http 读取 security:，以此类推。少数常用值在根 Settings 对象上也有扁平的 @property 代理，供旧的调用点使用，但按 section 嵌套的形式才是权威来源。",
    sectionsTableH: ["部分", "管辖内容"],
    sectionsTable: [
      ["app", "应用名称、环境、API 前缀（默认 /api/v1）"],
      ["models", "LLM 提供商列表——见下文"],
      ["staff", "上下文/输出 token 预算，子智能体并发数与轮次上限"],
      ["storage", "json 或 mongo 持久化后端"],
      ["task_queue", "memory 或 rabbitmq 任务执行后端"],
      ["lock", "threading 或 redis 分布式锁后端"],
      ["sandbox", "local 或 k8s 代码执行后端"],
      ["graph", "static（spaCy）或 llm 知识图谱构建模式"],
      ["auth", "JWT 密钥/有效期，Google OAuth 客户端凭据"],
      ["mcp", "启动时的 MCP 服务器自动播种"],
      ["security", "SSRF 防护（allow_private_http）、CORS 及其他加固开关"],
      ["long_term_memory / embedding / vector_store", "跨会话记忆、embedding 提供商、FAISS/Qdrant 后端"],
    ],
    sectionsMoreP: "完整的部分列表还包括 logging、middleware、router、mongo、minio、working_memory、retrieval、admin、seed、browser 和 tools——每一个都精确对应 config.yml 的一个顶层键。",

    modelsH2: "models: 列表与故障转移",
    modelsP1: "models: 是一个列表，而不是单一的扁平 provider/model 组合——这是从单提供商配置迁移过来的人最容易踩坑的细节。每个条目都独立启用、独立配置密钥，并携带各自的故障转移策略：",
    modelsP2: "将一个条目设为 enabled: false、另一个设为 true，就是一次完整的模型切换，无需任何代码改动——运行中的应用会在下一次配置重载时应用这个变化。failover.strategy 有两个选项：rotate 在同一提供商的多个密钥之间轮换，当某个密钥触发速率限制时切换（对有按密钥 RPM/TPM 限制的免费档 Gemini 密钥很有用）；9router 则通过一个外部的多提供商代理路由，在完全不同的提供商（Claude、OpenAI、Gemini 及其他 40 多个）之间处理故障转移，并有自己的 订阅 → 廉价 → 免费 分级策略。",

    backendsH2: "存储、队列与锁后端",
    backendsP: "这三者各自通过一个 backend: 值独立切换——无需其他代码改动，且任意组合都是合法的（例如您完全可以让 json 存储配合 rabbitmq 队列运行，不过 mongo+rabbitmq+redis 是典型的\"真实部署\"组合）：",

    sandboxH2: "沙箱执行",
    sandboxP: "沙箱执行只有两种模式——local（在后端主机上的子进程，适合开发和受信任的单租户部署）或 k8s（由独立的 provisioner 服务按请求创建拥有各自生命周期的 Pod，为多租户或不可信代码场景提供更强隔离）。不存在 docker 模式，尽管 docker-compose 中沙箱 profile 的名字容易让人这么以为——那个 profile 运行的是一个用于手动调试的独立容器，并不是第三种 sandbox.mode 取值。",

    perToolH2: "刻意不放进 config.yml 的内容",
    perToolP: "每个工具各自的凭据——一个 Slack 机器人令牌、某个特定用户已连接的 Google OAuth 账号、某家公司 CRM 集成的 API 密钥——都不是全局配置。它们存放在各个 Skill 自己的 config 字典中，保存在数据库里，通过 UI 的 Skills 页面编辑，而不是这个文件。这里的区别在于所有权：config.yml 保存的是部署运营者控制的设置；某个 Skill 的 config 保存的是配置该集成的最终用户控制的设置。把两者混在一起，就意味着每个租户的凭据都会存在于同一份、还需要像代码一样被审查和 diff 的文件中。",

    moreCallout: "完整的逐项参考请见后端仓库中的 docs/configuration.md；随附 config.yml 引用的每个密钥请见 .env.template。",

    nextH2: "下一步",
    nextInstall: "在您接触 config.yml 之前，这套技术栈中每个依赖实际需要什么。",
    nextDeployEnv: "config.yml 可以引用的完整 .env 密钥列表。",
    nextConnections: "完全存在于 config.yml 之外的、按连接划分的凭据。",
  },
  ja: {
    intro: "config.yml（.config/config.yml に配置、CONFIG_FILE=/path でパスを上書き可能）は、シークレットを含むバックエンドのすべての設定の唯一かつ完全なソースです。バックエンドのどの部分も、裸の OS 変数や .env 変数を読んで自身を設定することはありません。ある設定が存在するなら、それはこの 1 つのファイルのどこかにキーとして存在します。",

    precedenceH2: "優先順位モデル",
    precedenceP1: "レイヤーは正確に 2 つ、順番も決まっています：コードのデフォルト値、そして config.yml。それ以外は一切関与しません — 環境ごとのオーバーライドファイルも、複数の設定に分散していて覚えておかねばならない順序でマージされる設定もありません。",
    precedenceP2: "興味深いのは、config.yml 内のどの値も、それ自体が ${VAR}（または ${VAR:-default}）参照になり得るという点です。これは読み込み時に config_loader.load_config() によって .env または OS 環境変数から展開されます。環境変数が設定に到達する経路はこれだけです — バックエンドがアプリケーション設定のために os.environ.get() を直接呼ぶことはありません。具体的には：",
    precedenceExampleP: "config.yml に次の行があるとします：",
    precedenceExample2P: "そして .env に次の行があるとします：",
    precedenceExample3P: "読み込まれた設定は最終的に settings.auth.jwt_secret_key == \"a-long-random-string\" になります。.env のエントリを削除またはリネームすると、その参照は単に空文字列に解決されます（${VAR:-default} が指定されていればそのフォールバック値になります）— 他のソースへの暗黙のフォールバックはありません。",

    whyH2: "なぜ環境変数ではなく config.yml なのか",
    whyP: "これはプロジェクトが成長する過程での偶然ではなく、意図的な選択です。1 つの YAML ファイルは開いて最初から最後まで読め、2 つのデプロイ間で diff できるものです — docker-compose ファイル、CI シークレット、シェルプロファイルに散らばった環境変数の山ではそれができません。また、ある環境では変数が設定されていて別の環境では設定されておらず、誰も存在を覚えていないコードのデフォルト値に黙ってフォールバックしてしまう、という「自分のマシンでは動く」系のバグの一群をまるごと排除します。config.yml は git にコミットされます（シークレットはリテラル値ではなく ${VAR} 参照なので安全です）。つまり設定変更も他のコード変更と同様にレビュー可能な diff になります。",

    sectionsH2: "セクションは Settings と 1:1 対応",
    sectionsP: "設定は config.yml のトップレベルキーごとにネストされ、コード側でも同じ形で公開されます — settings.staff.context_token_limit は staff: セクションを読み、settings.security.allow_private_http は security: を読みます。頻繁に使われる一部の値は、古い呼び出し箇所のためにルートの Settings オブジェクト上にフラットな @property 委譲も持ちますが、セクションでネストされた形が正のソースです。",
    sectionsTableH: ["セクション", "対象"],
    sectionsTable: [
      ["app", "アプリ名、環境、API プレフィックス（デフォルト /api/v1）"],
      ["models", "LLM プロバイダーのリスト — 下記参照"],
      ["staff", "コンテキスト/出力トークン予算、サブエージェントの並行数とターン数上限"],
      ["storage", "json または mongo の永続化バックエンド"],
      ["task_queue", "memory または rabbitmq のタスク実行バックエンド"],
      ["lock", "threading または redis の分散ロックバックエンド"],
      ["sandbox", "local または k8s のコード実行バックエンド"],
      ["graph", "static（spaCy）または llm のナレッジグラフ構築モード"],
      ["auth", "JWT シークレット/有効期限、Google OAuth クライアント認証情報"],
      ["mcp", "起動時の MCP サーバー自動シード"],
      ["security", "SSRF ガード（allow_private_http）、CORS、その他の強化設定"],
      ["long_term_memory / embedding / vector_store", "会話をまたぐメモリ、embedding プロバイダー、FAISS/Qdrant バックエンド"],
    ],
    sectionsMoreP: "完全なセクション一覧には logging、middleware、router、mongo、minio、working_memory、retrieval、admin、seed、browser、tools も含まれます — それぞれが config.yml のトップレベルキー 1 つに正確に対応します。",

    modelsH2: "models: リストとフェイルオーバー",
    modelsP1: "models: は単一のフラットな provider/model ペアではなく、リストです — これは単一プロバイダー構成に慣れている人がつまずきやすい点です。各エントリは独立して有効化され、独立したキーを持ち、それぞれ独自のフェイルオーバーポリシーを持ちます。",
    modelsP2: "あるエントリを enabled: false にし、別のエントリを true にするだけで、コード変更なしに完全なモデル切り替えができます — 実行中のアプリは次の設定リロード時にその変更を反映します。failover.strategy には 2 つの選択肢があります：rotate は同じプロバイダーの複数キー間をローテーションし、1 つがレートリミットに達したときに切り替えます（キーごとに RPM/TPM 上限がある無料枠の Gemini キーで有用）。9router は外部のマルチプロバイダープロキシを経由してルーティングし、まったく異なるプロバイダー（Claude、OpenAI、Gemini、その他 40 以上）間のフェイルオーバーを、独自の サブスクリプション → 安価 → 無料 の階層で処理します。",

    backendsH2: "ストレージ、キュー、ロックのバックエンド",
    backendsP: "この 3 つはそれぞれ独立した backend: の値で切り替えられます — 他のコード変更は不要で、どの組み合わせも有効です（例えば json ストレージと rabbitmq キューを組み合わせることもできますが、mongo+rabbitmq+redis が典型的な「本番デプロイ」の組み合わせです）。",

    sandboxH2: "サンドボックス実行",
    sandboxP: "サンドボックス実行には正確に 2 つのモードしかありません — local（バックエンドホスト上のサブプロセス。開発や信頼できるシングルテナントデプロイに適する）または k8s（別の provisioner サービスがリクエストごとに独自のライフサイクルを持つ Pod を起動し、マルチテナントや信頼できないコードのシナリオでより強い分離を提供）。docker-compose のサンドボックスプロファイルの名前からよくある誤解ですが、docker モードは存在しません — あのプロファイルは手動デバッグ用のスタンドアロンコンテナを実行するものであり、3 つ目の sandbox.mode の値ではありません。",

    perToolH2: "意図的に config.yml に含まれないもの",
    perToolP: "各ツール固有の認証情報 — Slack ボットトークン、特定ユーザーが接続した Google OAuth アカウント、ある会社の CRM 連携用 API キーなど — はグローバル設定ではありません。それぞれの Skill 自身の config 辞書内にあり、データベースに保存され、このファイルではなく UI の Skills ページから編集されます。この違いは所有権の違いです。config.yml はデプロイの運用者が管理する設定を保持し、Skill の config はその連携を設定するエンドユーザーが管理する設定を保持します。両者を混ぜてしまうと、すべてのテナントの認証情報が、コードのようにレビューされ diff される必要がある 1 つのファイルに存在することになってしまいます。",

    moreCallout: "全項目の詳細なリファレンスはバックエンドリポジトリの docs/configuration.md を、config.yml が参照するすべてのシークレットは .env.template を参照してください。",

    nextH2: "次に読む",
    nextInstall: "config.yml に触れる前に、このスタックの各依存関係が実際に必要とするもの。",
    nextDeployEnv: "config.yml が参照できる .env シークレットの完全な一覧。",
    nextConnections: "config.yml の外に完全に存在する、接続ごとの認証情報。",
  },
} as const;

export default function ConfigurationDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Configuration</H1>
      <P>{t.intro}</P>

      <H2>{t.precedenceH2}</H2>
      <P>{t.precedenceP1}</P>
      <P>{t.precedenceP2}</P>
      <P>{t.precedenceExampleP}</P>
      <CodeBlock lang="yaml" title="config.yml" code={`auth:\n  jwt_secret_key: \${JWT_SECRET_KEY}          # resolved from .env / OS env\n  jwt_access_token_expire_minutes: 10080`} />
      <P>{t.precedenceExample2P}</P>
      <CodeBlock lang="bash" title=".env" code={`JWT_SECRET_KEY=a-long-random-string`} />
      <P>{t.precedenceExample3P}</P>

      <H2>{t.whyH2}</H2>
      <P>{t.whyP}</P>

      <H2>{t.sectionsH2}</H2>
      <P>{t.sectionsP}</P>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {t.sectionsTableH.map((h) => <th key={h} className="text-left py-2 pr-6 font-semibold text-foreground/80">{h}</th>)}
            </tr>
          </thead>
          <tbody className="text-muted-foreground divide-y divide-border/40">
            {t.sectionsTable.map(([s, d]) => (
              <tr key={s}>
                <td className="py-2 pr-6 font-mono text-foreground/70 whitespace-nowrap"><InlineCode>{s}</InlineCode></td>
                <td className="py-2 text-[13px]">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>{t.sectionsMoreP}</P>

      <H2>{t.modelsH2}</H2>
      <P>{t.modelsP1}</P>
      <CodeBlock lang="yaml" title="config.yml — models:" code={`models:\n  - name: gemini\n    provider_name: Google\n    model: gemini-3-flash-preview\n    api_key: $GOOGLE_API_KEY\n    enabled: true\n    failover:\n      strategy: rotate      # rotate (multi-key) | 9router (external gateway)\n  - name: claude\n    provider_name: Anthropic\n    model: claude-sonnet-5\n    api_key: $ANTHROPIC_API_KEY\n    enabled: false`} />
      <P>{t.modelsP2}</P>

      <H2>{t.backendsH2}</H2>
      <P>{t.backendsP}</P>
      <CodeBlock lang="yaml" title="config.yml — backends" code={`storage:\n  backend: json          # json (default) | mongo\n\ntask_queue:\n  backend: memory        # memory (default) | rabbitmq\n\nlock:\n  backend: threading     # threading (default) | redis\n\nstaff:\n  subagent_max_concurrent: 3\n  subagent_max_turns: 6\n  context_token_limit: 12000\n  output_token_reserve: 2000\n\ngraph:\n  build_mode: static     # static (spaCy) | llm`} />

      <H2>{t.sandboxH2}</H2>
      <P>{t.sandboxP}</P>
      <CodeBlock lang="yaml" title="config.yml — sandbox" code={`sandbox:\n  mode: local             # local (default) | k8s — no "docker" mode\n  timeout: 120`} />

      <H2>{t.perToolH2}</H2>
      <P>{t.perToolP}</P>

      <Callout type="tip">{t.moreCallout}</Callout>

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="installation" onNavigate={onNavigate} title="Installation" desc={t.nextInstall} />
        <NextStepCard id="deploy-env" onNavigate={onNavigate} title="Environment Variables" desc={t.nextDeployEnv} />
        <NextStepCard id="connections" onNavigate={onNavigate} title="Connections & Webhooks" desc={t.nextConnections} />
      </NextSteps>
    </div>
  );
}
