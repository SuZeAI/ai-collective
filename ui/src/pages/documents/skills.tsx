import { H1, H2, P, UL, LI, OL, OLI, Pill, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TOOLKIT_GROUPS: { en: string; vi: string; zh: string; ja: string; items: string }[] = [
  { en: "Google Workspace", vi: "Google Workspace", zh: "Google Workspace", ja: "Google Workspace", items: "Drive, Docs, Sheets, Calendar" },
  { en: "Web & search", vi: "Web & tìm kiếm", zh: "网页与搜索", ja: "ウェブ＆検索", items: "DuckDuckGo, Brave, HackerNews, Reddit, OpenRouter" },
  { en: "Browser automation", vi: "Tự động hoá trình duyệt", zh: "浏览器自动化", ja: "ブラウザ自動化", items: "Playwright-based scraping and interaction" },
  { en: "Social media", vi: "Mạng xã hội", zh: "社交媒体", ja: "ソーシャルメディア", items: "X/Twitter, Bluesky, Instagram, TikTok, YouTube, Reddit, Xiaohongshu" },
  { en: "Messaging", vi: "Nhắn tin", zh: "即时通讯", ja: "メッセージング", items: "Discord, Slack, Telegram, WhatsApp Business, Signal, Teams, WeChat, Zalo, Line, Viber" },
  { en: "Productivity", vi: "Năng suất", zh: "生产力", ja: "生産性", items: "HTTP client, Bash command execution, LLM task delegation" },
  { en: "Specialized", vi: "Chuyên biệt", zh: "专项工具", ja: "専門ツール", items: "Polymarket predictions, image processing (rembg), YouTube (yt-dlp)" },
];

const TXT = {
  en: {
    lead1: "A Skill is a bound tool or integration that a Staff member can call while it runs — a web search, a Google Sheets write, a Slack message, a sandboxed script. Staff don't come with any capability baked in. Every action a Staff can take beyond generating text has to be attached explicitly as a Skill, and only the Skills a given Staff has are exposed to that Staff's LLM as callable tools — a Staff with no Skills can only talk.",
    lead2: "This is a deliberate boundary. It means the surface area of what a Staff can affect — which APIs it can call, which files it can touch, which external systems it can reach — is always visible as an explicit, auditable list on that Staff's profile, not an implicit capability of the model itself.",

    schemaH2: "Schema",
    schemaP: "Every Skill is a row of this shape (server/domain/models.py). kind is the field that determines everything else about how the Skill behaves.",

    kindsH2: "Two kinds of Skill, two very different execution paths",
    kindsP: "The kind field splits into two genuinely different mechanisms, not just a label:",
    kindIntegrationTitle: "integration",
    kindIntegration: "tool_name points at a built-in toolkit the platform already implements (\"web_search\", \"browser_use\", \"bash\", \"sheet\", and so on), and config holds whatever that toolkit needs to run — an API key, a spreadsheet ID, a webhook URL. The instruction field is a short, user-facing note on how to obtain or enable it (where to get the API key, what scope to grant), shown in the Skills UI so a non-technical teammate can set one up without reading source code.",
    kindCustomTitle: "custom-js",
    kindCustom: "There's no built-in toolkit that fits, so code holds arbitrary JavaScript that executes inside the sandbox instead. The function receives whatever the calling Staff passed as input and returns a string result — useful for one-off data transforms, filters, or format conversions that don't warrant a first-class integration.",
    kindExampleH2: "A concrete example of each",
    kindExampleIntegration: "Attaching Web Search to a Staff: create a Skill with kind: \"integration\", tool_name: \"web_search\", third_party: \"DuckDuckGo\". No config needed for a keyless provider. The moment this Skill's id lands in a Staff's skill_ids, that Staff's LLM sees a web_search tool it can call on any turn.",
    kindExampleCustom: "A one-off custom-js Skill that filters a JSON array down to high-confidence items and returns names, one per line — no built-in toolkit does this, so code carries the whole implementation and the sandbox executes it when a Staff calls it.",

    mcpH2: "MCP servers are just another Skill",
    mcpP1: "The Model Context Protocol (MCP) is an open standard for exposing a set of tools from an external server to an AI client. AI Collective doesn't treat MCP as a separate subsystem with its own configuration UI — an MCP server is configured exactly like any other Skill: set tool_name = \"mcp\", point config at the server, and at run time the platform connects to it and exposes every tool that server offers to the Staff holding that Skill.",
    mcpP2: "That's a deliberate simplification. It means \"what can this Staff do\" is always answerable by looking at one list — its Skills — whether the capability comes from a built-in toolkit, a hand-written custom-js function, or an entire external MCP server's tool catalog.",

    callFlowH2: "What happens when a Staff calls a Skill",
    callFlowP: "Concretely, mid-turn, when a Staff's LLM decides to use one of its attached tools:",
    callFlowSteps: [
      "The LLM emits a tool call naming one of the tool names visible to it — derived from the Staff's skill_ids.",
      "The platform resolves that name to an implementation: a built-in toolkit function for kind: \"integration\", the sandboxed code for kind: \"custom-js\", or a proxied call to the MCP server for tool_name: \"mcp\".",
      "The implementation runs (network call, sandboxed script, MCP round-trip) and returns a result.",
      "That result is fed back into the Staff's context as a tool result, and the LLM continues reasoning with it — deciding whether it has enough to answer, or needs to call another tool.",
    ],

    toolkitsH2: "The built-in toolkit ecosystem (50+ tools)",
    toolkitsP: "Grouped by category below — attach any of these to a Staff via its Skills. This list only covers what ships built-in; nothing stops you from filling a gap with a custom-js Skill or an MCP server in the meantime.",

    restH2: "REST API",
    restP: "POST doubles as create-or-update: include an existing id in the body to update that Skill instead of creating a new one.",

    nextDeptTitle: "Staff", nextDept: "See how a Skill's tool_name shows up as something the Staff's LLM can actually call.",
    nextGuideTitle: "Guide", nextGuide: "A hands-on walkthrough of attaching both an integration and a custom-js Skill.",
  },
  vi: {
    lead1: "Một Skill là một công cụ hoặc tích hợp được gắn vào mà một Staff có thể gọi trong khi chạy — tìm kiếm web, ghi vào Google Sheets, gửi tin nhắn Slack, chạy một đoạn script trong sandbox. Staff không có sẵn bất kỳ năng lực nào. Mọi hành động mà một Staff có thể thực hiện ngoài việc sinh văn bản đều phải được gắn tường minh dưới dạng một Skill, và chỉ những Skill mà Staff đó thực sự có mới được lộ ra cho LLM của Staff đó như các công cụ có thể gọi — một Staff không có Skill nào thì chỉ có thể nói chuyện.",
    lead2: "Đây là một ranh giới có chủ đích. Nó có nghĩa là phạm vi ảnh hưởng của một Staff — API nào nó có thể gọi, file nào nó có thể chạm vào, hệ thống bên ngoài nào nó có thể tiếp cận — luôn hiển thị dưới dạng một danh sách tường minh, có thể kiểm toán trên hồ sơ của Staff đó, chứ không phải một năng lực ngầm định của bản thân mô hình.",

    schemaH2: "Schema",
    schemaP: "Mỗi Skill là một bản ghi có cấu trúc như sau (server/domain/models.py). kind là trường quyết định mọi thứ khác về cách Skill hoạt động.",

    kindsH2: "Hai loại Skill, hai cơ chế thực thi rất khác nhau",
    kindsP: "Trường kind tách thành hai cơ chế thực sự khác nhau, không chỉ là một nhãn:",
    kindIntegrationTitle: "integration",
    kindIntegration: "tool_name trỏ tới một toolkit có sẵn mà nền tảng đã cài đặt (\"web_search\", \"browser_use\", \"bash\", \"sheet\", v.v.), và config chứa những gì toolkit đó cần để chạy — một API key, một spreadsheet ID, một webhook URL. Trường instruction là ghi chú ngắn hướng dẫn người dùng cách lấy hoặc kích hoạt nó (lấy API key ở đâu, cấp quyền gì), hiển thị trên UI Skills để một đồng nghiệp không rành kỹ thuật cũng có thể tự thiết lập mà không cần đọc mã nguồn.",
    kindCustomTitle: "custom-js",
    kindCustom: "Không có toolkit có sẵn nào phù hợp, nên code chứa JavaScript tuỳ ý chạy bên trong sandbox thay vào đó. Hàm nhận bất cứ gì mà Staff gọi truyền vào làm input và trả về một chuỗi kết quả — hữu ích cho các phép biến đổi dữ liệu, lọc, hoặc chuyển định dạng một lần mà không đáng để xây một tích hợp chính thức.",
    kindExampleH2: "Một ví dụ cụ thể cho mỗi loại",
    kindExampleIntegration: "Gắn Web Search vào một Staff: tạo một Skill với kind: \"integration\", tool_name: \"web_search\", third_party: \"DuckDuckGo\". Không cần config nếu là nhà cung cấp không cần key. Ngay khi id của Skill này xuất hiện trong skill_ids của một Staff, LLM của Staff đó sẽ thấy một công cụ web_search mà nó có thể gọi ở bất kỳ lượt nào.",
    kindExampleCustom: "Một Skill custom-js dùng một lần để lọc một mảng JSON xuống còn các mục có độ tin cậy cao và trả về tên, mỗi tên một dòng — không có toolkit có sẵn nào làm việc này, nên code mang toàn bộ phần cài đặt và sandbox thực thi nó khi một Staff gọi.",

    mcpH2: "Máy chủ MCP cũng chỉ là một Skill khác",
    mcpP1: "Model Context Protocol (MCP) là một chuẩn mở để lộ ra một tập công cụ từ một máy chủ bên ngoài cho một AI client. AI Collective không coi MCP là một hệ thống con riêng biệt với UI cấu hình riêng — một máy chủ MCP được cấu hình giống hệt như bất kỳ Skill nào khác: đặt tool_name = \"mcp\", trỏ config tới máy chủ, và khi chạy nền tảng sẽ kết nối tới nó và lộ ra mọi công cụ mà máy chủ đó cung cấp cho Staff đang giữ Skill này.",
    mcpP2: "Đây là một sự đơn giản hoá có chủ đích. Nó có nghĩa là câu hỏi \"Staff này làm được gì\" luôn có thể trả lời bằng cách nhìn vào một danh sách duy nhất — các Skill của nó — bất kể năng lực đó đến từ một toolkit có sẵn, một hàm custom-js tự viết, hay toàn bộ danh mục công cụ của một máy chủ MCP bên ngoài.",

    callFlowH2: "Điều gì xảy ra khi một Staff gọi một Skill",
    callFlowP: "Cụ thể, giữa một lượt, khi LLM của Staff quyết định dùng một trong các công cụ đã gắn:",
    callFlowSteps: [
      "LLM phát ra một lệnh gọi công cụ nêu tên một trong các tool name mà nó thấy được — được suy ra từ skill_ids của Staff.",
      "Nền tảng phân giải tên đó thành một cài đặt cụ thể: một hàm toolkit có sẵn cho kind: \"integration\", code trong sandbox cho kind: \"custom-js\", hoặc một lệnh gọi được proxy tới máy chủ MCP cho tool_name: \"mcp\".",
      "Cài đặt đó chạy (gọi mạng, chạy script trong sandbox, round-trip tới MCP) và trả về kết quả.",
      "Kết quả đó được đưa trở lại vào context của Staff dưới dạng kết quả công cụ, và LLM tiếp tục suy luận dựa trên đó — quyết định xem đã đủ để trả lời hay cần gọi thêm công cụ khác.",
    ],

    toolkitsH2: "Hệ sinh thái toolkit có sẵn (50+ công cụ)",
    toolkitsP: "Được nhóm theo danh mục bên dưới — gắn bất kỳ công cụ nào trong số này vào một Staff thông qua Skills của staff đó. Danh sách này chỉ liệt kê những gì có sẵn; không có gì ngăn bạn lấp khoảng trống bằng một Skill custom-js hoặc một máy chủ MCP.",

    restH2: "REST API",
    restP: "POST vừa dùng để tạo vừa để cập nhật: đưa một id đã tồn tại vào body để cập nhật skill đó thay vì tạo mới.",

    nextDeptTitle: "Staff", nextDept: "Xem cách tool_name của một Skill trở thành thứ mà LLM của Staff thực sự có thể gọi.",
    nextGuideTitle: "Hướng dẫn", nextGuide: "Hướng dẫn thực hành gắn cả một Skill integration lẫn một Skill custom-js.",
  },
  zh: {
    lead1: "Skill（技能）是绑定给某个 Staff、在其运行期间可调用的工具或集成——网页搜索、写入 Google 表格、发送 Slack 消息、在沙箱中运行脚本。Staff 本身不内置任何能力。除了生成文本之外，Staff 能采取的每一个行动都必须显式地作为 Skill 绑定，且只有该 Staff 实际拥有的 Skill 才会作为可调用工具暴露给该 Staff 的 LLM——一个没有任何 Skill 的 Staff 只能对话。",
    lead2: "这是一个刻意设计的边界。它意味着一个 Staff 能影响的范围——能调用哪些 API、能触碰哪些文件、能触达哪些外部系统——始终以显式、可审计的清单形式出现在该 Staff 的档案上，而不是模型本身隐含的能力。",

    schemaH2: "数据结构",
    schemaP: "每个 Skill 都是如下结构的一条记录（server/domain/models.py）。kind 字段决定了 Skill 行为方式的一切其他细节。",

    kindsH2: "两种 Skill，两条截然不同的执行路径",
    kindsP: "kind 字段区分的是两种真正不同的机制，而不仅仅是一个标签：",
    kindIntegrationTitle: "integration",
    kindIntegration: "tool_name 指向平台已经实现的内置工具包（\"web_search\"\"browser_use\"\"bash\"\"sheet\" 等），config 保存该工具包运行所需的一切——API 密钥、表格 ID、webhook URL。instruction 字段是给用户看的简短说明，介绍如何获取或启用它（去哪里拿 API 密钥、要授予什么权限范围），会显示在 Skills 界面上，即使不懂技术的同事也能照着设置，无需阅读源码。",
    kindCustomTitle: "custom-js",
    kindCustom: "没有合适的内置工具包时，code 字段保存在沙箱内执行的任意 JavaScript 代码。该函数接收调用它的 Staff 传入的任何输入，并返回一个字符串结果——适合那些不值得做成正式集成的一次性数据转换、过滤或格式转换。",
    kindExampleH2: "两种类型各一个具体例子",
    kindExampleIntegration: "为 Staff 绑定 Web Search：创建一个 kind: \"integration\"、tool_name: \"web_search\"、third_party: \"DuckDuckGo\" 的 Skill。对于无需密钥的提供方，不需要 config。一旦这个 Skill 的 id 出现在某个 Staff 的 skill_ids 中，该 Staff 的 LLM 就会看到一个可以随时调用的 web_search 工具。",
    kindExampleCustom: "一个一次性的 custom-js Skill，将一个 JSON 数组过滤为高置信度条目，并逐行返回名称——没有内置工具包能做这件事，所以 code 承载了完整实现，沙箱会在 Staff 调用时执行它。",

    mcpH2: "MCP 服务器只是另一种 Skill",
    mcpP1: "Model Context Protocol（MCP）是一个开放标准，用于将外部服务器上的一组工具暴露给 AI 客户端。AI Collective 并不把 MCP 当作一个拥有独立配置界面的子系统——一个 MCP 服务器的配置方式与任何其他 Skill 完全相同：设置 tool_name = \"mcp\"，让 config 指向该服务器，运行时平台会连接它，并把该服务器提供的所有工具暴露给持有此 Skill 的 Staff。",
    mcpP2: "这是一种刻意的简化。它意味着\"这个 Staff 能做什么\"这个问题，永远可以通过查看同一份清单——它的 Skills——来回答，无论这项能力来自某个内置工具包、一段手写的 custom-js 函数，还是整个外部 MCP 服务器的工具目录。",

    callFlowH2: "Staff 调用 Skill 时发生了什么",
    callFlowP: "具体来说，在回合进行中，当 Staff 的 LLM 决定使用它绑定的某个工具时：",
    callFlowSteps: [
      "LLM 发出一个工具调用，指定它可见的某个工具名——该名称来自该 Staff 的 skill_ids。",
      "平台将该名称解析为具体实现：对于 kind: \"integration\" 是内置工具包函数，对于 kind: \"custom-js\" 是沙箱中的代码，对于 tool_name: \"mcp\" 则是转发到 MCP 服务器的调用。",
      "该实现执行（网络调用、沙箱脚本运行、MCP 往返）并返回结果。",
      "该结果作为工具结果被送回该 Staff 的上下文，LLM 基于此继续推理——判断是否已有足够信息作答，还是需要再调用其他工具。",
    ],

    toolkitsH2: "内置工具生态（50+ 种工具）",
    toolkitsP: "按类别分组如下——通过 Skills 将以下任意工具绑定到某个 Staff。这份列表只覆盖内置能力；如果有缺口，随时可以用 custom-js Skill 或 MCP 服务器来补齐。",

    restH2: "REST API",
    restP: "POST 同时承担创建和更新的作用：在请求体中带上已存在的 id 即可更新该技能，而不是创建新技能。",

    nextDeptTitle: "Staff", nextDept: "了解 Skill 的 tool_name 如何变成 Staff 的 LLM 真正可以调用的东西。",
    nextGuideTitle: "指南", nextGuide: "绑定一个 integration Skill 和一个 custom-js Skill 的实操演练。",
  },
  ja: {
    lead1: "Skill は、Staff が実行中に呼び出せる、紐づけられたツールや連携です — ウェブ検索、Google スプレッドシートへの書き込み、Slack メッセージ送信、サンドボックス内でのスクリプト実行など。Staff には最初から何の能力も組み込まれていません。テキスト生成を超えて Staff が取れる行動はすべて、Skill として明示的に紐づける必要があり、その Staff が実際に持つ Skill だけが、その Staff の LLM が呼び出せるツールとして公開されます — Skill を 1 つも持たない Staff は会話しかできません。",
    lead2: "これは意図的な境界線です。つまり、ある Staff が影響を及ぼせる範囲——どの API を呼べるか、どのファイルに触れられるか、どの外部システムに到達できるか——は常に、そのモデル自体の暗黙の能力としてではなく、その Staff のプロフィール上に明示的で監査可能なリストとして見える、ということです。",

    schemaH2: "スキーマ",
    schemaP: "すべての Skill は次の形のレコードです（server/domain/models.py）。kind フィールドが、Skill の動作に関するその他すべてを決定します。",

    kindsH2: "2 種類の Skill、まったく異なる 2 つの実行経路",
    kindsP: "kind フィールドは単なるラベルではなく、本当に異なる 2 つの仕組みに分かれます。",
    kindIntegrationTitle: "integration",
    kindIntegration: "tool_name は、プラットフォームがすでに実装済みの組み込みツールキット（\"web_search\"、\"browser_use\"、\"bash\"、\"sheet\" など）を指し、config にはそのツールキットが実行に必要とするもの（API キー、スプレッドシート ID、Webhook URL）が入ります。instruction フィールドは、取得・有効化方法（API キーの入手先、付与すべきスコープ）に関するユーザー向けの短い説明で、Skills の UI に表示されるため、技術に詳しくないメンバーでもソースコードを読まずに設定できます。",
    kindCustomTitle: "custom-js",
    kindCustom: "適した組み込みツールキットがない場合、代わりに code にサンドボックス内で実行される任意の JavaScript が入ります。この関数は呼び出し元の Staff が渡した入力を受け取り、文字列の結果を返します——正式な連携を作るほどでもない、一度きりのデータ変換やフィルタリング、フォーマット変換に便利です。",
    kindExampleH2: "それぞれの具体例",
    kindExampleIntegration: "Staff に Web Search を紐づける: kind: \"integration\"、tool_name: \"web_search\"、third_party: \"DuckDuckGo\" の Skill を作成します。キー不要のプロバイダーなら config は不要です。この Skill の id がある Staff の skill_ids に入った瞬間、その Staff の LLM はどのターンでも呼び出せる web_search ツールを目にします。",
    kindExampleCustom: "JSON 配列を高信頼度の項目だけに絞り込み、名前を 1 行ずつ返す使い捨ての custom-js Skill——これを行う組み込みツールキットは存在しないため、code が実装全体を担い、Staff が呼び出したときにサンドボックスがそれを実行します。",

    mcpH2: "MCP サーバーも単なる別の Skill",
    mcpP1: "Model Context Protocol（MCP）は、外部サーバーが持つ一連のツールを AI クライアントに公開するためのオープン標準です。AI Collective は MCP を独自の設定 UI を持つ別サブシステムとして扱いません。MCP サーバーは他の Skill とまったく同じ方法で設定します：tool_name = \"mcp\" を設定し、config でそのサーバーを指すようにすると、実行時にプラットフォームがそこへ接続し、そのサーバーが提供するすべてのツールを、この Skill を持つ Staff に公開します。",
    mcpP2: "これは意図的な単純化です。つまり「この Staff は何ができるか」という問いは、その能力が組み込みツールキット由来であれ、手書きの custom-js 関数であれ、外部 MCP サーバーのツールカタログ全体であれ、常に 1 つのリスト——その Skills——を見るだけで答えられるということです。",

    callFlowH2: "Staff が Skill を呼び出すと何が起きるか",
    callFlowP: "具体的には、ターンの途中で Staff の LLM が紐づけられたツールの 1 つを使うと決めたとき：",
    callFlowSteps: [
      "LLM が、その Staff の skill_ids から導かれる、見えているツール名の 1 つを指定してツール呼び出しを発行する。",
      "プラットフォームがその名前を実装に解決する：kind: \"integration\" なら組み込みツールキット関数、kind: \"custom-js\" ならサンドボックス内のコード、tool_name: \"mcp\" なら MCP サーバーへのプロキシ呼び出し。",
      "その実装が実行され（ネットワーク呼び出し、サンドボックススクリプト、MCP との往復）、結果を返す。",
      "その結果はツール結果として Staff のコンテキストに戻され、LLM はそれをもとに推論を続けます——十分な情報が揃ったか、別のツールを呼ぶ必要があるかを判断します。",
    ],

    toolkitsH2: "組み込みツールキットのエコシステム（50 種類以上）",
    toolkitsP: "以下はカテゴリ別のグループです — これらのいずれかを Skills 経由で Staff に紐づけられます。このリストは組み込みで提供されるものだけを扱っています。不足があれば custom-js Skill や MCP サーバーで埋めれば構いません。",

    restH2: "REST API",
    restP: "POST は作成と更新の両方を兼ねます。既存の id を body に含めると新規作成ではなくそのスキルを更新します。",

    nextDeptTitle: "Staff", nextDept: "Skill の tool_name が、Staff の LLM が実際に呼び出せるものとしてどう現れるかを見る。",
    nextGuideTitle: "ガイド", nextGuide: "integration Skill と custom-js Skill の両方を紐づける実践ガイド。",
  },
} as const;

export default function SkillsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Skills</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Skill:\n    id: str\n    name: str\n    description: str\n    third_party: str\n    kind: str                     # "integration" | "custom-js"\n    config: dict[str, Any]\n    avatar: str = ""\n    avatar_icon: str = ""\n    avatar_color: str = ""\n    avatar_url: str = ""\n    tool_name: str | None = None  # linked built-in tool, e.g. "web_search"\n    code: str | None = None\n    owner_id: str = "default"\n    instruction: str = ""         # user-facing setup guide`} />

      <H2>{t.kindsH2}</H2>
      <P>{t.kindsP}</P>
      <UL>
        <LI><Pill color="green">integration</Pill> {t.kindIntegration}</LI>
        <LI><Pill color="orange">custom-js</Pill> {t.kindCustom}</LI>
      </UL>

      <H2>{t.kindExampleH2}</H2>
      <P>{t.kindExampleIntegration}</P>
      <CodeBlock lang="json" title="A built-in integration" code={`{\n  "name": "Web Search",\n  "kind": "integration",\n  "tool_name": "web_search",\n  "third_party": "DuckDuckGo",\n  "config": {}\n}`} />
      <P>{t.kindExampleCustom}</P>
      <CodeBlock lang="javascript" title="A custom-js skill" code={`function run(input) {\n  const items = JSON.parse(input);\n  return items\n    .filter(item => item.confidence > 0.8)\n    .map(item => item.name)\n    .join("\\n");\n}`} />

      <H2>{t.mcpH2}</H2>
      <P>{t.mcpP1}</P>
      <Callout type="tip">{t.mcpP2}</Callout>

      <H2>{t.callFlowH2}</H2>
      <P>{t.callFlowP}</P>
      <OL>
        {t.callFlowSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>

      <H2>{t.toolkitsH2}</H2>
      <P>{t.toolkitsP}</P>
      <div className="space-y-2 my-4">
        {TOOLKIT_GROUPS.map((g) => (
          <div key={g.en} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/20">
            <span className="text-sm font-bold text-foreground/80 sm:w-44 flex-shrink-0">{g[lang]}</span>
            <span className="text-sm text-muted-foreground font-mono text-[13px]">{g.items}</span>
          </div>
        ))}
      </div>

      <H2>{t.restH2}</H2>
      <P>{t.restP}</P>
      <CodeBlock lang="bash" title="Create or update a skill" code={`curl -X POST http://localhost:8000/api/v1/skills \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Web Search",\n    "description": "Search the web via DuckDuckGo",\n    "third_party": "DuckDuckGo",\n    "kind": "integration",\n    "tool_name": "web_search",\n    "config": {}\n  }'`} />
      <CodeBlock lang="bash" title="List / discover / delete" code={`curl http://localhost:8000/api/v1/skills\ncurl http://localhost:8000/api/v1/skills/tools           # built-in tool_names\ncurl http://localhost:8000/api/v1/skills/tool-presets     # ready-made presets\ncurl -X DELETE http://localhost:8000/api/v1/skills/{skill_id}`} />

      <NextSteps>
        <NextStepCard id="staff" onNavigate={onNavigate} title={t.nextDeptTitle} desc={t.nextDept} />
        <NextStepCard id="guide-skills" onNavigate={onNavigate} title={t.nextGuideTitle} desc={t.nextGuide} />
      </NextSteps>
    </div>
  );
}
