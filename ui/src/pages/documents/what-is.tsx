import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "AI Collective is a platform for creating and managing AI-powered companies — virtual organizations of any type, built entirely from AI. Describe a company in chat and the AI Office Designer proposes its Departments, Staff, and Skills; from there you can run a software startup, a marketing agency, a research lab, or a general company, and operate any number of companies side by side. It is a backend and a web app, not a single model wrapped in a chat window — everything below explains what that actually means in practice.",

    notChatbotH2: "Not a single chatbot",
    notChatbotP1: "A Company contains Departments, each staffed by Staff members with bound Skills (tools). Every Company has a type — software, marketing, research, or general — that seeds the AI-generated structure and marks the best-fit navigation options with a star, but never hides anything: you can always build whatever kind of company you actually described.",
    notChatbotP2Lead: "The difference shows up the moment you use it. Say you type one sentence — \"a small marketing agency for boutique fashion brands, with a strategist, a copywriter, and a paid-ads specialist\" — into the AI Office Designer's chat:",
    notChatbotSteps: [
      "The Designer proposes a Company (type marketing), one Department wired in supervisor mode, a strategist Staff as lead, and two worker Staff — each already carrying a role, a system prompt, and a first pass at which Skills to attach.",
      "You review the plan in the same chat and edit anything you don't like — swap a role, rewrite a prompt, drop a Skill — nothing is final yet.",
      "You click Create Company. The plan is applied through the exact same REST API you could call by hand: real Company, Department, Staff, and Skill records get written.",
      "You switch into the new company and it's immediately operable — Task Board, Meetings, and the rest of the nav are live.",
    ],
    notChatbotP3: "One sentence becomes an operating organization, not a longer answer in a chat window.",

    topoH2: "Six ways staff collaborate",
    topoP: "Inside a Department, Staff don't just take turns arbitrarily — a topology (the Department's mode) decides how work is handed off:",
    topologies: [
      { name: "sequential", d: "one staff member handles the whole request. The default — fast and predictable." },
      { name: "ring", d: "staff run in a fixed circular order, refining across rounds." },
      { name: "mesh", d: "a hub staff routes work to specialist spokes." },
      { name: "supervisor", d: "a lead delegates to workers and synthesizes their results." },
      { name: "tree", d: "staff are arranged in a parent/child hierarchy; results roll up." },
      { name: "custom", d: "a user-drawn LangGraph DAG for anything the built-in modes don't fit." },
    ],
    topoLinkP1: "Each mode is a full LangGraph state machine, not a preset prompt template — see",
    topoLinkText: "Departments",
    topoLinkP2: "for exactly how each one moves data between staff, and what control blocks like",
    topoLinkP3: "actually do under the hood.",

    skillH2: "One skill system, fifty-plus toolkits",
    skillP: "A Skill is the unit of capability you bind to a Staff member — everything from a Google Sheets integration to a raw shell command to a hand-written JavaScript function. The built-in catalog spans Google Workspace, web search, browser automation, social platforms, and roughly ten messaging platforms, and MCP (Model Context Protocol) servers plug in the same way, as just another Skill. A Staff member with no Skills can still reason and write text; every Skill you attach is a new thing it can actually do.",
    skillLinkP: "The full breakdown of toolkit categories, and the difference between an \"integration\" skill and a \"custom-js\" one, lives in",
    skillLinkText: "Skills",

    scaleH2: "From a laptop to a distributed deployment",
    scaleP1: "Nothing about the application code changes as you scale — only config.yml. On a laptop, the default storage backend is JSON files, the task queue is an in-memory thread pool, and the lock is a plain threading lock: zero external infrastructure, one process, works offline apart from the LLM calls themselves.",
    scaleP2: "Flip three settings — storage.backend: mongo, task_queue.backend: rabbitmq, lock.backend: redis — and the same code runs distributed across multiple workers against a real database and a real message bus. No route, service, or domain model is aware of which backend is active; they only ever see the Protocol each one implements.",
    scaleLinkP: "See",
    scaleLinkText: "Deployment",
    scaleLinkP2: "for the Docker Compose stacks that wire this up end to end.",

    licenseH2: "Self-hosted, source-available",
    licenseP: "AI Collective is source-available under a Non-Commercial / Academic license (see LICENSE and NOTICE) — free to run and study for education and research. Commercial use requires a separate written license.",
    featuresH2: "Key features",
    features: [
      "Six staff topologies — sequential, ring, mesh, supervisor, tree, and a fully custom LangGraph DAG.",
      "Atomic skill system — 50+ built-in toolkits (Google Workspace, web search, social media, messaging platforms, browser automation) bindable to any staff member.",
      "Subagent support — a staff member can spawn bounded, concurrent subagents to delegate independent work.",
      "Real-time SSE streaming — turn-by-turn run events, including mid-run human intervention.",
      "Knowledge graph memory — conversation context extracted via spaCy (static) or an LLM (semantic).",
      "Token budget management — automatic context trimming per turn, configurable per company.",
      "Multi-LLM support — Google Gemini, OpenAI, Anthropic Claude, and OpenRouter, swappable at runtime.",
      "Flexible storage — zero-setup JSON, or MongoDB for production.",
      "Human-in-the-loop — pause a run and inject guidance before it continues.",
      "Auth and company isolation — JWT and Google OAuth, every company's data kept separate.",
      "Activity feed and analytics — live activity log, task metrics, staff productivity, department efficiency.",
    ],
    whoForH2: "Who is it for?",
    audience: [
      { title: "Developers", desc: "Build AI-powered products without hand-rolling multi-agent orchestration, streaming, or memory. The REST API is the same one the UI calls, so anything you can click, you can automate." },
      { title: "Teams & agencies", desc: "Stand up a whole department of AI staff to run research, content, or support pipelines, and manage several client companies from the same \"All\" control center." },
      { title: "Researchers", desc: "Experiment with topology design, subagent delegation, and collaboration strategies on a real, LangGraph-backed runtime instead of a toy simulation." },
    ],

    nextArchitecture: "How the FastAPI backend, LangGraph orchestrators, and frontend fit together.",
    nextQuickstart: "Get a local instance running in five commands.",
    nextConcepts: "Company, Department, Staff, Skill, Task — the five ideas everything else builds on.",
  },
  vi: {
    intro: "AI Collective là nền tảng để tạo và quản lý các công ty được vận hành bởi AI — những tổ chức ảo thuộc bất kỳ loại hình nào, được xây dựng hoàn toàn từ AI. Mô tả một công ty trong khung chat, AI Office Designer sẽ đề xuất Departments, Staff và Skills cho công ty đó; từ đó bạn có thể vận hành một startup công nghệ, một agency marketing, một phòng nghiên cứu, hay một công ty tổng quát — và chạy song song bao nhiêu công ty tùy ý. Đây là một backend và một web app, không phải một model đơn lẻ được bọc trong khung chat — toàn bộ phần dưới đây giải thích điều đó thực sự có nghĩa là gì.",

    notChatbotH2: "Không phải một chatbot đơn lẻ",
    notChatbotP1: "Một Company chứa các Department, mỗi Department có các Staff với Skills (công cụ) được gắn kèm. Mỗi Company có một type — software, marketing, research, hoặc general — giúp gợi ý cấu trúc do AI sinh ra và đánh dấu sao cho các mục điều hướng phù hợp nhất, nhưng không bao giờ ẩn đi bất cứ thứ gì: bạn luôn có thể xây đúng loại công ty mình mô tả.",
    notChatbotP2Lead: "Sự khác biệt lộ ra ngay khi bạn dùng thử. Giả sử bạn gõ một câu — \"một agency marketing nhỏ cho các thương hiệu thời trang boutique, có một strategist, một copywriter, và một chuyên viên paid-ads\" — vào khung chat của AI Office Designer:",
    notChatbotSteps: [
      "Designer đề xuất một Company (type marketing), một Department chạy ở chế độ supervisor, một Staff strategist làm lead, và hai Staff worker — mỗi người đã có sẵn role, system prompt, và một bản nháp các Skill nên gắn.",
      "Bạn xem lại kế hoạch ngay trong khung chat và chỉnh sửa bất cứ điều gì không ưng ý — đổi role, viết lại prompt, bỏ bớt Skill — chưa có gì là cuối cùng cả.",
      "Bạn nhấn Create Company. Kế hoạch được áp dụng qua đúng REST API mà bạn có thể tự gọi bằng tay: các bản ghi Company, Department, Staff, Skill thật sự được ghi vào.",
      "Bạn chuyển vào công ty mới và nó hoạt động được ngay lập tức — Task Board, Meetings, và phần còn lại của nav đều sẵn sàng.",
    ],
    notChatbotP3: "Một câu trở thành một tổ chức đang vận hành, chứ không phải một câu trả lời dài hơn trong khung chat.",

    topoH2: "Sáu cách nhân sự cộng tác",
    topoP: "Bên trong một Department, Staff không chỉ lần lượt phát biểu ngẫu nhiên — một topology (chính là mode của Department) quyết định cách công việc được chuyển giao:",
    topologies: [
      { name: "sequential", d: "một staff duy nhất xử lý toàn bộ yêu cầu. Chế độ mặc định — nhanh và dễ đoán." },
      { name: "ring", d: "các staff chạy theo vòng tròn cố định, tinh chỉnh qua từng vòng." },
      { name: "mesh", d: "một staff trung tâm (hub) định tuyến công việc tới các staff chuyên biệt (spoke)." },
      { name: "supervisor", d: "một staff trưởng (lead) giao việc cho các worker rồi tổng hợp kết quả." },
      { name: "tree", d: "các staff xếp theo cấu trúc cha/con; kết quả dồn từ lá lên gốc." },
      { name: "custom", d: "một đồ thị LangGraph do người dùng tự vẽ, cho những trường hợp các mode có sẵn không phù hợp." },
    ],
    topoLinkP1: "Mỗi mode là một cỗ máy trạng thái LangGraph đầy đủ, không phải một mẫu prompt dựng sẵn — xem",
    topoLinkText: "Departments",
    topoLinkP2: "để biết chính xác từng mode chuyển dữ liệu giữa các staff như thế nào, và các control block như",
    topoLinkP3: "thực sự làm gì bên dưới.",

    skillH2: "Một hệ thống skill, hơn năm mươi bộ công cụ",
    skillP: "Một Skill là đơn vị năng lực bạn gắn vào một Staff — từ tích hợp Google Sheets đến lệnh shell thô đến một hàm JavaScript tự viết. Danh mục dựng sẵn trải khắp Google Workspace, tìm kiếm web, tự động hóa trình duyệt, các nền tảng mạng xã hội, và khoảng mười nền tảng nhắn tin, còn MCP (Model Context Protocol) server cũng cắm vào theo cùng cách — chỉ là một Skill khác. Một Staff không có Skill nào vẫn có thể suy luận và viết văn bản; mỗi Skill bạn gắn thêm là một việc nó thực sự làm được.",
    skillLinkP: "Toàn bộ phân loại các nhóm công cụ, và sự khác biệt giữa một skill \"integration\" và một skill \"custom-js\", nằm ở trang",
    skillLinkText: "Skills",

    scaleH2: "Từ một laptop đến một triển khai phân tán",
    scaleP1: "Không có gì trong mã ứng dụng thay đổi khi bạn mở rộng quy mô — chỉ config.yml thay đổi. Trên laptop, backend lưu trữ mặc định là file JSON, hàng đợi tác vụ là một thread pool trong bộ nhớ, và lock chỉ là một threading lock đơn giản: không cần hạ tầng ngoài, một tiến trình duy nhất, chạy offline ngoại trừ các lệnh gọi LLM.",
    scaleP2: "Đổi ba cấu hình — storage.backend: mongo, task_queue.backend: rabbitmq, lock.backend: redis — và cùng một đoạn mã đó chạy phân tán trên nhiều worker, dùng một database thật và một message bus thật. Không route, service, hay domain model nào biết backend nào đang hoạt động; chúng chỉ thấy Protocol mà từng backend triển khai.",
    scaleLinkP: "Xem",
    scaleLinkText: "Deployment",
    scaleLinkP2: "để biết các stack Docker Compose kết nối toàn bộ việc này từ đầu đến cuối.",

    licenseH2: "Tự lưu trữ, mã nguồn mở một phần",
    licenseP: "AI Collective là mã nguồn mở một phần (source-available) theo giấy phép Non-Commercial / Academic (xem LICENSE và NOTICE) — miễn phí để chạy và nghiên cứu cho mục đích giáo dục, học thuật. Sử dụng thương mại cần một giấy phép riêng bằng văn bản.",
    featuresH2: "Tính năng chính",
    features: [
      "Sáu topology cho staff — sequential, ring, mesh, supervisor, tree, và một đồ thị LangGraph tùy chỉnh hoàn toàn.",
      "Hệ thống skill nguyên tử — hơn 50 bộ công cụ dựng sẵn (Google Workspace, tìm kiếm web, mạng xã hội, nền tảng nhắn tin, tự động hóa trình duyệt) có thể gắn cho bất kỳ staff nào.",
      "Hỗ trợ subagent — một staff có thể sinh ra các subagent song song có giới hạn để ủy thác công việc độc lập.",
      "Streaming SSE thời gian thực — sự kiện theo từng lượt, kể cả can thiệp của con người giữa phiên chạy.",
      "Bộ nhớ đồ thị tri thức — ngữ cảnh hội thoại được trích xuất qua spaCy (tĩnh) hoặc LLM (ngữ nghĩa).",
      "Quản lý ngân sách token — tự động cắt bớt ngữ cảnh theo từng lượt, cấu hình được theo từng công ty.",
      "Hỗ trợ đa LLM — Google Gemini, OpenAI, Anthropic Claude, và OpenRouter, hoán đổi được khi đang chạy.",
      "Lưu trữ linh hoạt — JSON không cần cài đặt, hoặc MongoDB cho môi trường production.",
      "Con người tham gia trực tiếp (human-in-the-loop) — tạm dừng một phiên chạy để chèn hướng dẫn trước khi tiếp tục.",
      "Xác thực và cách ly công ty — JWT và Google OAuth, dữ liệu mỗi công ty được tách biệt.",
      "Activity feed và phân tích — nhật ký hoạt động trực tiếp, chỉ số nhiệm vụ, năng suất staff, hiệu quả department.",
    ],
    whoForH2: "Dành cho ai?",
    audience: [
      { title: "Nhà phát triển", desc: "Xây dựng sản phẩm AI mà không cần tự viết lại orchestration đa tác nhân, streaming, hay bộ nhớ. REST API chính là API mà UI gọi, nên bất cứ gì bạn click được, bạn cũng tự động hóa được." },
      { title: "Đội nhóm & agency", desc: "Dựng cả một department nhân sự AI để chạy các luồng nghiên cứu, nội dung, hoặc hỗ trợ khách hàng, và quản lý nhiều công ty khách hàng từ cùng một trung tâm điều khiển \"All\"." },
      { title: "Nhà nghiên cứu", desc: "Thử nghiệm thiết kế topology, ủy thác subagent, và chiến lược cộng tác trên một runtime LangGraph thật, không phải một mô phỏng đồ chơi." },
    ],

    nextArchitecture: "Cách backend FastAPI, các orchestrator LangGraph, và frontend khớp với nhau.",
    nextQuickstart: "Chạy được một instance cục bộ chỉ với năm lệnh.",
    nextConcepts: "Company, Department, Staff, Skill, Task — năm khái niệm mà mọi thứ khác đều xây trên đó.",
  },
  zh: {
    intro: "AI Collective 是一个用于创建和管理由 AI 驱动的公司的平台——完全由 AI 构建、可以是任意类型的虚拟组织。只需在聊天中描述一家公司，AI Office Designer 就会为其提出部门（Department）、员工（Staff）与技能（Skill）；此后您可以运营一家软件初创公司、一家营销代理、一间研究实验室，或一家通用公司，并可同时并行运营任意数量的公司。它是一个后端和一个 Web 应用，而不是把单一模型包在聊天窗口里——下面的内容具体说明了这在实践中到底意味着什么。",

    notChatbotH2: "不是单一的聊天机器人",
    notChatbotP1: "一家 Company 包含若干 Department，每个 Department 由若干配备了 Skills（工具）的 Staff 组成。每家 Company 都有一个 type——software、marketing、research 或 general——它会为 AI 生成的结构提供种子建议，并在导航中为最合适的选项加星标，但绝不会隐藏任何选项：您始终可以按自己描述的样子构建公司。",
    notChatbotP2Lead: "这种差异在您实际使用的那一刻就会显现。假设您在 AI Office Designer 的聊天框里输入一句话——\"为精品时装品牌打造的小型营销代理，配一名策划师、一名文案和一名付费广告专员\"：",
    notChatbotSteps: [
      "Designer 会提出一家 Company（type 为 marketing）、一个以 supervisor 模式运行的 Department、一名作为 lead 的策划师 Staff，以及两名 worker Staff——每个人都已经带有角色、系统提示词，以及一份该绑定哪些 Skills 的初步方案。",
      "您在同一个聊天框中审阅方案，并修改任何不满意的地方——换角色、重写提示词、去掉某个 Skill——此时一切都还没有定稿。",
      "您点击 Create Company。该方案会通过您也可以手动调用的同一套 REST API 被应用：真正的 Company、Department、Staff、Skill 记录被写入。",
      "您切换进新公司，它立即可用——Task Board、Meetings 以及导航中的其余部分都已就绪。",
    ],
    notChatbotP3: "一句话变成了一个正在运营的组织，而不是聊天窗口里一段更长的回答。",

    topoH2: "六种员工协作方式",
    topoP: "在一个 Department 内部，Staff 并非随意轮流发言——拓扑（即 Department 的 mode）决定了工作如何交接：",
    topologies: [
      { name: "sequential", d: "由单个员工处理整个请求。默认模式——快速且可预测。" },
      { name: "ring", d: "员工按固定的环形顺序运行，逐轮打磨结果。" },
      { name: "mesh", d: "一个中枢（hub）员工将工作路由给各个专业分支（spoke）员工。" },
      { name: "supervisor", d: "一名主管（lead）向多个执行者（worker）分派任务并汇总结果。" },
      { name: "tree", d: "员工按父子层级排列；结果从叶节点向根节点汇总。" },
      { name: "custom", d: "用户自行绘制的 LangGraph DAG，适用于内置模式无法满足的场景。" },
    ],
    topoLinkP1: "每种模式都是一个完整的 LangGraph 状态机，而不是预设的提示词模板——具体每种模式如何在员工之间传递数据，以及诸如",
    topoLinkText: "Departments",
    topoLinkP2: "这样的控制块在底层究竟做了什么，详见",
    topoLinkP3: "页面。",

    skillH2: "一套技能系统，五十多种工具包",
    skillP: "Skill 是您绑定给某个 Staff 的能力单元——从 Google 表格集成到裸的 shell 命令，再到手写的 JavaScript 函数。内置目录涵盖 Google Workspace、网页搜索、浏览器自动化、社交平台，以及约十种消息平台；MCP（Model Context Protocol）服务器也以完全相同的方式接入——只是另一种 Skill 而已。没有绑定任何 Skill 的员工依然能够推理和写文字；而您绑定的每个 Skill，都是它真正能做到的一件新事情。",
    skillLinkP: "关于工具包分类的完整拆解，以及\"integration\"型 skill 与\"custom-js\"型 skill 的区别，详见",
    skillLinkText: "Skills",

    scaleH2: "从一台笔记本到分布式部署",
    scaleP1: "扩展规模时，应用代码本身不会有任何变化——变的只有 config.yml。在笔记本电脑上，默认存储后端是 JSON 文件，任务队列是内存中的线程池，锁是普通的线程锁：不需要任何外部基础设施，单进程运行，除了 LLM 调用本身之外完全可以离线工作。",
    scaleP2: "只需切换三个配置项——storage.backend: mongo、task_queue.backend: rabbitmq、lock.backend: redis——同一份代码就能分布式运行在多个 worker 上，对接真实数据库和真实消息总线。没有任何路由、服务或领域模型知道当前用的是哪个后端；它们只依赖各自实现的 Protocol。",
    scaleLinkP: "关于将这一切端到端接好的 Docker Compose 部署栈，详见",
    scaleLinkText: "Deployment",
    scaleLinkP2: "页面。",

    licenseH2: "自托管，源码开放（source-available）",
    licenseP: "AI Collective 依据 Non-Commercial / Academic 许可证以源码开放形式发布（详见 LICENSE 与 NOTICE）——用于教育与研究目的可免费运行与学习。商业用途需另行获得书面许可。",
    featuresH2: "核心功能",
    features: [
      "六种员工拓扑——sequential、ring、mesh、supervisor、tree，以及完全自定义的 LangGraph DAG。",
      "原子化技能系统——50 多种内置工具包（Google Workspace、网页搜索、社交媒体、消息平台、浏览器自动化），可绑定给任意员工。",
      "子智能体（Subagent）支持——员工可以生成数量受限的并行子智能体，以委派独立工作。",
      "实时 SSE 流式传输——逐回合的运行事件，包括运行过程中的人工干预。",
      "知识图谱记忆——通过 spaCy（静态）或 LLM（语义）提取对话上下文。",
      "Token 预算管理——按回合自动裁剪上下文，可按公司配置。",
      "多 LLM 支持——Google Gemini、OpenAI、Anthropic Claude 与 OpenRouter，运行时可切换。",
      "灵活的存储——零配置的 JSON，或用于生产环境的 MongoDB。",
      "人工介入（human-in-the-loop）——可暂停运行并注入指导后再继续。",
      "身份认证与公司隔离——JWT 与 Google OAuth，各公司数据相互隔离。",
      "活动流与分析——实时活动日志、任务指标、员工生产力、部门效率。",
    ],
    whoForH2: "适合哪些人？",
    audience: [
      { title: "开发者", desc: "无需从零实现多智能体编排、流式传输或记忆机制，即可构建 AI 驱动的产品。REST API 与界面调用的是同一套接口，凡是您能点击的操作，都能自动化。" },
      { title: "团队与代理机构", desc: "组建一整个 AI 员工部门，运行研究、内容或客户支持流水线，并在同一个「All」控制中心管理多家客户公司。" },
      { title: "研究人员", desc: "在真实的、基于 LangGraph 的运行时上实验拓扑设计、子智能体委派与协作策略，而不是在玩具式模拟环境中。" },
    ],

    nextArchitecture: "了解 FastAPI 后端、LangGraph 编排器与前端如何拼接在一起。",
    nextQuickstart: "只需五条命令即可跑起一个本地实例。",
    nextConcepts: "Company、Department、Staff、Skill、Task——其余一切都建立在这五个概念之上。",
  },
  ja: {
    intro: "AI Collective は、AI が運営する会社を作成・管理するためのプラットフォームです——あらゆる種類の仮想組織を、完全に AI だけで構築します。チャットで会社を説明すると、AI Office Designer がその会社の部門（Department）、スタッフ（Staff）、スキル（Skill）を提案します。そこからソフトウェアスタートアップ、マーケティングエージェンシー、研究ラボ、あるいは汎用の会社を運営でき、複数の会社を同時に並行運用することもできます。これはバックエンドと Web アプリであり、単一のモデルをチャットウィンドウに包んだものではありません——以下ではそれが実際に何を意味するのかを具体的に説明します。",

    notChatbotH2: "単一のチャットボットではない",
    notChatbotP1: "Company は複数の Department を持ち、各 Department には Skills（ツール）を紐づけた Staff が所属します。すべての Company には type（software / marketing / research / general）があり、AI が生成する構成の種となり、ナビゲーション内の最適なオプションにスターを付けますが、何かを隠すことはありません。あなたが説明した通りの会社を常に構築できます。",
    notChatbotP2Lead: "その違いは実際に使った瞬間に現れます。たとえば AI Office Designer のチャットに「ブティックファッションブランド向けの小さなマーケティングエージェンシー、ストラテジスト、コピーライター、有料広告スペシャリストがいる」と一文入力したとします。",
    notChatbotSteps: [
      "Designer は Company（type: marketing）、supervisor モードで組まれた Department、lead となるストラテジスト Staff、そして 2 人の worker Staff を提案します——それぞれすでに役割、システムプロンプト、アタッチすべき Skills の初案を持っています。",
      "同じチャット内でプランを確認し、気に入らない部分を編集します——役割を入れ替える、プロンプトを書き直す、Skill を外す——まだ何も確定していません。",
      "Create Company をクリックすると、手動でも呼び出せる同じ REST API を通じてプランが適用され、実際の Company・Department・Staff・Skill レコードが書き込まれます。",
      "新しい会社に切り替えると、すぐに操作可能になります——Task Board、Meetings、その他のナビゲーションもすべて有効です。",
    ],
    notChatbotP3: "一文が、チャットウィンドウ内の長い回答ではなく、実際に稼働する組織になるのです。",

    topoH2: "スタッフが協力する 6 つの方法",
    topoP: "Department の内部では、Staff は単に順番に発言するのではなく、トポロジー（Department の mode）が作業の受け渡し方を決めます。",
    topologies: [
      { name: "sequential", d: "1 人のスタッフがリクエスト全体を処理します。デフォルトで高速かつ予測可能です。" },
      { name: "ring", d: "スタッフが固定された円環順で実行され、ラウンドを重ねて精緻化します。" },
      { name: "mesh", d: "ハブとなるスタッフが専門スタッフ（スポーク）へ作業をルーティングします。" },
      { name: "supervisor", d: "リーダーがワーカーへ委任し、結果を統合します。" },
      { name: "tree", d: "スタッフが親子階層で配置され、結果は葉から根へ集約されます。" },
      { name: "custom", d: "組み込みモードで対応できない場合のための、ユーザーが描画した LangGraph DAG です。" },
    ],
    topoLinkP1: "各モードはプリセットのプロンプトテンプレートではなく、完全な LangGraph ステートマシンです。各モードがスタッフ間でどうデータを渡すか、",
    topoLinkText: "Departments",
    topoLinkP2: "のようなコントロールブロックが内部で実際に何をしているかは",
    topoLinkP3: "を参照してください。",

    skillH2: "1 つのスキルシステム、50 以上のツールキット",
    skillP: "Skill は Staff に紐づける能力の単位です——Google スプレッドシート連携から生のシェルコマンド、手書きの JavaScript 関数まで。組み込みカタログは Google Workspace、Web 検索、ブラウザ自動化、ソーシャルプラットフォーム、約 10 のメッセージングプラットフォームにまたがり、MCP（Model Context Protocol）サーバーも同じ方法で——単なる別の Skill として——接続されます。Skill を何も持たないスタッフでも推論しテキストを書くことはできますが、Skill を 1 つ紐づけるたびに、実際にできることが 1 つ増えます。",
    skillLinkP: "ツールキットのカテゴリの完全な内訳、および「integration」スキルと「custom-js」スキルの違いは",
    skillLinkText: "Skills",

    scaleH2: "ノート PC から分散デプロイまで",
    scaleP1: "スケールしてもアプリケーションコードは何も変わりません——変わるのは config.yml だけです。ノート PC 上では、デフォルトのストレージバックエンドは JSON ファイル、タスクキューはインメモリのスレッドプール、ロックは単純なスレッドロックです。外部インフラは不要で、単一プロセスで、LLM 呼び出し自体を除けばオフラインでも動作します。",
    scaleP2: "storage.backend: mongo、task_queue.backend: rabbitmq、lock.backend: redis という 3 つの設定を切り替えるだけで、同じコードが複数ワーカーにまたがって分散実行され、実際のデータベースと実際のメッセージバスに接続されます。どのルート、サービス、ドメインモデルも、どのバックエンドが有効かを意識しません——それぞれが実装する Protocol しか見ていないからです。",
    scaleLinkP: "これをエンドツーエンドで組み上げる Docker Compose スタックについては",
    scaleLinkText: "Deployment",
    scaleLinkP2: "を参照してください。",

    licenseH2: "セルフホスト、ソースアベイラブル",
    licenseP: "AI Collective は Non-Commercial / Academic ライセンス（LICENSE と NOTICE を参照）のもとでソースアベイラブルとして公開されており、教育・研究目的では無料で実行・学習できます。商用利用には別途書面によるライセンスが必要です。",
    featuresH2: "主な機能",
    features: [
      "6 つのスタッフトポロジー — sequential、ring、mesh、supervisor、tree、そして完全カスタムの LangGraph DAG。",
      "アトミックなスキルシステム — 50 以上の組み込みツールキット（Google Workspace、Web 検索、ソーシャルメディア、メッセージングプラットフォーム、ブラウザ自動化）を任意のスタッフにバインド可能。",
      "サブエージェント対応 — スタッフは数の制限された並列サブエージェントを生成し、独立した作業を委任できます。",
      "リアルタイム SSE ストリーミング — 実行中の人間による介入を含む、ターンごとのイベント。",
      "ナレッジグラフメモリ — spaCy（静的）または LLM（意味的）による会話コンテキストの抽出。",
      "トークン予算管理 — ターンごとの自動コンテキスト調整、会社ごとに設定可能。",
      "マルチ LLM 対応 — Google Gemini、OpenAI、Anthropic Claude、OpenRouter を実行時に切り替え可能。",
      "柔軟なストレージ — セットアップ不要の JSON、または本番向けの MongoDB。",
      "human-in-the-loop — 実行を一時停止し、指示を注入してから再開できます。",
      "認証と会社の分離 — JWT と Google OAuth により、各会社のデータを分離。",
      "アクティビティフィードと分析 — リアルタイムの活動ログ、タスク指標、スタッフの生産性、部門効率。",
    ],
    whoForH2: "誰のためのものか？",
    audience: [
      { title: "開発者", desc: "マルチエージェントのオーケストレーション、ストリーミング、メモリを自作せずに AI 駆動の製品を構築。REST API は UI が呼び出しているものと同じなので、クリックできることは何でも自動化できます。" },
      { title: "チーム・代理店", desc: "リサーチ、コンテンツ、サポートのパイプラインを回す AI スタッフの部門をまるごと立ち上げ、同じ「All」コントロールセンターから複数のクライアント企業を管理。" },
      { title: "研究者", desc: "おもちゃのシミュレーションではなく、実際に LangGraph で動くランタイム上で、トポロジー設計、サブエージェント委任、協力戦略を実験。" },
    ],

    nextArchitecture: "FastAPI バックエンド、LangGraph オーケストレーター、フロントエンドがどう組み合わさっているか。",
    nextQuickstart: "5 つのコマンドでローカルインスタンスを起動。",
    nextConcepts: "Company、Department、Staff、Skill、Task——他のすべてがその上に成り立つ 5 つの概念。",
  },
} as const;

export default function WhatIsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>What is AI Collective?</H1>
      <P>{t.intro}</P>

      <H2>{t.notChatbotH2}</H2>
      <P>{t.notChatbotP1}</P>
      <P>{t.notChatbotP2Lead}</P>
      <OL>
        {t.notChatbotSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>
      <P><strong>{t.notChatbotP3}</strong></P>

      <H2>{t.topoH2}</H2>
      <P>{t.topoP}</P>
      <UL>
        {t.topologies.map(({ name, d }) => (
          <LI key={name}><InlineCode>{name}</InlineCode> — {d}</LI>
        ))}
      </UL>
      <P>
        {t.topoLinkP1} <DocLink id="departments" onNavigate={onNavigate}>{t.topoLinkText}</DocLink> {t.topoLinkP2} <InlineCode>{"<DELEGATE_TO>"}</InlineCode> {t.topoLinkP3}
      </P>

      <H2>{t.skillH2}</H2>
      <P>{t.skillP}</P>
      <P>{t.skillLinkP} <DocLink id="skills" onNavigate={onNavigate}>{t.skillLinkText}</DocLink>.</P>

      <H2>{t.scaleH2}</H2>
      <P>{t.scaleP1}</P>
      <P>{t.scaleP2}</P>
      <P>{t.scaleLinkP} <DocLink id="deploy-docker" onNavigate={onNavigate}>{t.scaleLinkText}</DocLink> {t.scaleLinkP2}</P>

      <H2>{t.licenseH2}</H2>
      <P>{t.licenseP}</P>
      <Callout type="info">LICENSE · NOTICE</Callout>

      <H2>{t.featuresH2}</H2>
      <UL>{t.features.map((f, i) => <LI key={i}>{f}</LI>)}</UL>

      <H2>{t.whoForH2}</H2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
        {t.audience.map((a) => (
          <div key={a.title} className="p-4 rounded-xl border border-border/70 bg-muted/30">
            <div className="font-bold text-sm mb-1">{a.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{a.desc}</div>
          </div>
        ))}
      </div>

      <CodeBlock lang="text" title="System Overview" code={`┌──────────────────────────────────────────────┐\n│                 React Frontend                │\n│        (Vite + TypeScript + Radix UI)         │\n└───────────────────────┬──────────────────────┘\n                        │ REST API / SSE\n┌───────────────────────▼──────────────────────┐\n│               FastAPI Backend                 │\n│  Company ─ Department (topology) ─ Staff      │\n│  Skill Registry        Task / Project / Epic   │\n│  Tool Executor          Sandbox / Queue         │\n└───────────────────────┬──────────────────────┘\n                        │\n         ┌──────────────▼───────────────┐\n         │ Gemini · OpenAI · Claude · …  │\n         └───────────────────────────────┘`} />

      <NextSteps>
        <NextStepCard id="architecture" onNavigate={onNavigate} title="Architecture" desc={t.nextArchitecture} />
        <NextStepCard id="quickstart" onNavigate={onNavigate} title="Quickstart" desc={t.nextQuickstart} />
        <NextStepCard id="key-concepts" onNavigate={onNavigate} title="Key Concepts" desc={t.nextConcepts} />
      </NextSteps>
    </div>
  );
}
