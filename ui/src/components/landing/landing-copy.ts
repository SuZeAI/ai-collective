import { type Language } from "@/locales";

export const LANDING_COPY = {
  en: {
    hero: {
      h1: "Build Your Own AI Company",
      sub: "AI Collective is where you create your own company, organize it into departments, and staff those departments with AI — coordinating work across Sequential, Ring, Mesh, Supervisor, Tree, or fully Custom topologies.",
      cta1: "Start building",
      cta2: "See developer docs"
    },
    started: {
      title: "Choose how to get started",
      buildOwn: {
        title: "Deploy on your own",
        sub: "Self-host your own company, departments, and AI staff with:",
        bullets: [
          "Sequential, Ring, Mesh, Supervisor, Tree, or fully Custom staff topologies",
          "AI Office Designer: describe a company in chat and get departments, staff, and skills in one click",
          "50+ built-in skill toolkits — Google Workspace, browser automation, and 15+ messaging platforms",
          "Automatic token budget management and context-window optimization",
          "Flexible backend: local run (JSON storage) or distributed deployment (MongoDB + RabbitMQ via Docker Compose)",
          "Interactive Human-in-the-Loop steering capabilities",
          "Advanced spaCy and LLM-based Knowledge Graph extraction"
        ],
        cta: "Start building"
      },
      support: {
        comingSoonBadge: "Full open-source release: coming soon",
        title: "Commercial Licensing",
        sub: "AI Collective is source-available and free for non-commercial, research, and educational use. Using it in a paid product, internal business tool, or SaaS requires a separate commercial license.",
        bullets: [
          "Free to self-host for study, research, and evaluation",
          "Commercial, revenue-generating, or SaaS use requires written permission from the maintainer",
          "Guidance available for custom integrations and Kubernetes sandbox deployments",
          "Reach out directly to discuss licensing terms"
        ],
        cta: "Contact us"
      }
    },
    models: {
      title: "Supported LLM Foundations",
      sub: "Configure, swap, or route foundational model engines at runtime across industry-leading providers.",
      batch: "Fully LLM-agnostic: swap providers at runtime — Google Gemini, Anthropic Claude, OpenAI, DeepSeek, Moonshot Kimi, Zhipu GLM, OpenRouter, or any OpenAI-compatible custom endpoint — no code changes required.",
      activeModelLabel: "Active Model",
      capabilitiesHeader: "Key Capabilities",
      list: [
        {
          name: "Google Gemini",
          icon: "gemini",
          desc: "Default speed engine, optimized for entity extraction and real-time knowledge graphs.",
          capabilities: [
            "Automated spaCy & LLM-based entity extraction",
            "Real-time graph building and state context loading",
            "High token efficiency for staff debate rounds"
          ]
        },
        {
          name: "Anthropic Claude",
          icon: "anthropic",
          desc: "Premier logic engine for multi-staff mesh coordinator and code generation.",
          capabilities: [
            "Advanced prompt caching to reduce token overhead",
            "Superior tool selection and staff delegation flow",
            "Structured code execution validation"
          ]
        },
        {
          name: "OpenAI GPT",
          icon: "openai",
          desc: "Highly reliable standard engine for structured JSON schemas and tool binding.",
          capabilities: [
            "Strict JSON schema enforcement for inputs/outputs",
            "Multi-staff ring debate consensus formatting",
            "Broad external API integrations"
          ]
        },
        {
          name: "DeepSeek",
          icon: "deepseek",
          desc: "Cost-efficient reasoning engine, strong at long-context analysis and structured chain-of-thought tasks.",
          capabilities: [
            "Deep chain-of-thought reasoning for complex staff planning",
            "Large context window for document-heavy meeting review",
            "Low-cost inference for high-volume department runs"
          ]
        },
        {
          name: "Kimi (Moonshot)",
          icon: "kimi",
          desc: "Long-context specialist engine tuned for extended multi-turn staff conversations.",
          capabilities: [
            "Ultra-long context window for sprawling meeting histories",
            "Strong Chinese/English bilingual reasoning",
            "Efficient tool-calling for retrieval-augmented workflows"
          ]
        },
        {
          name: "Open Weight",
          icon: "openrouter",
          desc: "High-parameter open weight engine for self-hosted or air-gapped secure staff clusters.",
          capabilities: [
            "Self-hosted orchestration with zero data leakage",
            "Fine-tuned for Python code execution inside Docker sandboxes",
            "Compatible with custom model providers and endpoints"
          ]
        }
      ]
    },
    tools: {
      title: "What Powers Your Company",
      sub: "The runtime services behind every company, department, and staff member on AI Collective.",
      cta: "See developer docs",
      list: [
        { name: "AI Office Designer", desc: "Describe your company in chat — AI proposes departments, staff, and skills, then creates the whole company in one click." },
        { name: "6 Staff Topologies", desc: "Orchestrate sequential pipelines, ring debate rounds, mesh coordinator networks, supervisor hierarchies, tree structures, or fully custom LangGraph DAGs." },
        { name: "50+ Skill Toolkits", desc: "Equip staff with Google Drive/Calendar, Playwright web scrapers, social feeds, and productivity tools." },
        { name: "Subagent Delegation", desc: "Allow main staff to spawn and run parallel subagents concurrently with strict turn limits." },
        { name: "Real-time SSE Streaming", desc: "Follow execution progress turn-by-turn with transparent event logs (agent_start, llm_request_start, subagent_complete)." },
        { name: "Secure Sandbox Execution", desc: "Safely execute Python/Bash commands inside isolated local or Kubernetes sandbox environments." },
        { name: "Knowledge Graph Memory", desc: "Extract meeting context dynamically via NLP (spaCy) or LLMs to build a queryable semantic memory." },
        { name: "Context & Token Budgeting", desc: "Automatically trim and optimize context windows when approaching token limits." },
        { name: "Human-in-the-Loop", desc: "Intervene in ongoing multi-staff discussions to steer staff or provide manual task inputs." },
        { name: "Multi-Company Isolation", desc: "Secure multi-tenant data segmentation using JWT validation, Google OAuth, and database isolation." }
      ]
    },
    console: {
      title: "Manage Your Company, Departments, and Staff from One Dashboard",
      sub: "From the AI Office Designer to task boards and live meetings — run your entire AI company through clean FastAPI endpoints and interactive dashboards.",
      devTitle: "Built for AI Engineers",
      desc: "Monitor, staff, and tune your company:",
      bullets: [
        "Describe a company in chat and let AI Office Designer generate its departments, staff, and skills",
        "Create, edit, and configure custom staff and tools in real-time",
        "Trace staff execution steps, token cost logs, and message histories",
        "Run Projects, Task Boards, and live Meetings, with Recruiting to staff new roles"
      ]
    },
    usecases: {
      title: "What You Can Build With AI Collective",
      list: [
        {
          name: "Instant AI Company",
          desc: "Describe your business idea in chat — AI Office Designer proposes departments, staff, and skills, then builds the whole company in one click."
        },
        {
          name: "Financial Debate",
          desc: "Spawn a department of analysts debating market indicators using real-time Brave search tools under a Ring topology."
        },
        {
          name: "Editorial Pipeline",
          desc: "Manage content creation from research and drafting to proofreading and formatting under a Supervisor lead."
        },
        {
          name: "Parallel Web Crawling",
          desc: "Delegate concurrent crawling tasks to subagents to parse target websites using browser automation tools."
        }
      ]
    },
    footer: {
      ctaTitle: "Start building",
      newsTitle: "Get developer updates",
      newsSub: "Product updates, code recipes, tool additions, and more. Delivered monthly to your inbox.",
      newsPlaceholder: "Enter your email",
      newsButton: "Subscribe",
      newsDisclaimer: "By subscribing, you agree to receive monthly framework updates. Unsubscribe at any time."
    },
    header: {
      meetCollective: "Meet Collective",
      platform: "Platform",
      solutions: "Solutions",
      pricing: "Pricing",
      resources: "Resources",
      exploreHere: "Explore here",
      login: "Request access",
      contactSales: "Contact sales",
      startBuilding: "Start building",
      products: "Products",
      features: "Features",
      models: "Models",
      useCases: "Use cases",
      aiStaff: "AI staff",
      dataPipelines: "Data pipelines",
      codeReview: "Code review",
      companySize: "Company size",
      startups: "Startups",
      enterprise: "Enterprise",
      departments: "Departments",
      engineering: "Engineering",
      research: "Research",
      industries: "Industries",
      fintech: "FinTech",
      legal: "Legal",
      healthcare: "Healthcare",
      github: "GitHub",
      devDocs: "Developer docs",
      changelog: "Changelog",
      overview: "Overview",
      consoleLogin: "Request dashboard access",
      star: "Star"
    },
    highlights: [
      "6 Staff Topologies",
      "AI Office Designer",
      "50+ Skill Toolkits",
      "Real-time SSE Streaming",
      "Knowledge Graph Memory",
      "LLM-Agnostic",
      "Secure Sandbox Execution",
      "JSON or MongoDB Storage",
      "Token Budget Management",
      "Source-Available"
    ],
    footerSitemap: {
      rights: "All rights reserved. Integrating staff mesh networks across public and local systems.",
      products: "Products",
      orchestrator: "Orchestrator",
      pricing: "Pricing",
      documentation: "Documentation",
      solutions: "Solutions",
      enterprise: "Enterprise",
      education: "Education",
      financial: "Financial",
      company: "Company",
      aboutUs: "About us",
      careers: "Careers",
      press: "Press"
    }
  },
  vi: {
    hero: {
      h1: "Xây dựng Công ty AI của riêng bạn",
      sub: "AI Collective là nơi bạn tự tạo ra công ty của mình, tổ chức thành các phòng ban, và biên chế các phòng ban đó bằng AI — phối hợp công việc qua các cấu trúc Sequential, Ring, Mesh, Supervisor, Tree, hoặc hoàn toàn tùy chỉnh (Custom).",
      cta1: "Bắt đầu xây dựng",
      cta2: "Xem tài liệu lập trình"
    },
    started: {
      title: "Chọn cách thức bắt đầu",
      buildOwn: {
        title: "Tự triển khai",
        sub: "Tự lưu trữ công ty, phòng ban và nhân sự AI của riêng bạn với:",
        bullets: [
          "Các cấu trúc tác nhân: Sequential, Ring, Mesh, Supervisor, Tree, hoặc hoàn toàn tùy chỉnh (Custom)",
          "AI Office Designer: mô tả công ty qua chat và nhận ngay phòng ban, nhân sự, kỹ năng chỉ với một cú nhấp",
          "Hơn 50 bộ công cụ tích hợp sẵn — Google Workspace, tự động hóa trình duyệt, và hơn 15 nền tảng nhắn tin",
          "Tự động quản lý ngân sách Token và tối ưu hóa cửa sổ ngữ cảnh",
          "Backend linh hoạt: chạy local (lưu JSON) hoặc triển khai phân tán (MongoDB + RabbitMQ qua Docker Compose)",
          "Tương tác điều hướng trực tiếp bằng cơ chế Human-in-the-loop",
          "Trích xuất Biểu đồ tri thức (Knowledge Graph) nâng cao qua spaCy hoặc LLM"
        ],
        cta: "Bắt đầu xây dựng"
      },
      support: {
        comingSoonBadge: "Bản mã nguồn mở đầy đủ: sắp ra mắt",
        title: "Cấp phép thương mại",
        sub: "AI Collective là source-available và miễn phí cho mục đích phi thương mại, nghiên cứu và giáo dục. Sử dụng cho sản phẩm trả phí, công cụ nội bộ doanh nghiệp, hoặc SaaS cần một giấy phép thương mại riêng.",
        bullets: [
          "Miễn phí tự triển khai để học tập, nghiên cứu và đánh giá",
          "Sử dụng thương mại, tạo doanh thu, hoặc SaaS cần được sự cho phép bằng văn bản từ tác giả",
          "Có hỗ trợ tư vấn tích hợp tùy chỉnh và triển khai Kubernetes sandbox",
          "Liên hệ trực tiếp để trao đổi về điều khoản cấp phép"
        ],
        cta: "Liên hệ với chúng tôi"
      }
    },
    models: {
      title: "Các động cơ mô hình được hỗ trợ",
      sub: "Cấu hình, thay đổi hoặc định tuyến các động cơ mô hình nền tảng ở thời điểm chạy mà không cần sửa mã.",
      batch: "Hoàn toàn độc lập mô hình: chuyển đổi nhà cung cấp ngay khi chạy — Google Gemini, Anthropic Claude, OpenAI, DeepSeek, Moonshot Kimi, Zhipu GLM, OpenRouter, hoặc bất kỳ endpoint tương thích OpenAI nào — không cần sửa mã.",
      activeModelLabel: "Model kích hoạt",
      capabilitiesHeader: "Khả năng chính",
      list: [
        {
          name: "Google Gemini",
          icon: "gemini",
          desc: "Động cơ tốc độ mặc định, tối ưu hóa cho việc trích xuất thực thể và đồ thị tri thức thời gian thực.",
          capabilities: [
            "Trích xuất thực thể tự động bằng spaCy & LLM",
            "Xây dựng đồ thị ngữ cảnh và tải trạng thái cực nhanh",
            "Tối ưu hóa token cho các lượt tranh luận của tác nhân"
          ]
        },
        {
          name: "Anthropic Claude",
          icon: "anthropic",
          desc: "Động cơ logic hàng đầu cho bộ điều phối mesh đa tác nhân và sinh mã nguồn.",
          capabilities: [
            "Hỗ trợ prompt caching giảm chi phí token và độ trễ",
            "Khả năng lựa chọn công cụ và ủy thác tác nhân tối ưu",
            "Xác thực và thực thi mã nguồn sandbox tin cậy"
          ]
        },
        {
          name: "OpenAI GPT",
          icon: "openai",
          desc: "Động cơ tiêu chuẩn độ tin cậy cao cho các schema JSON cấu trúc và liên kết công cụ.",
          capabilities: [
            "Ràng buộc lược đồ JSON nghiêm ngặt cho input/output",
            "Định dạng đồng thuận tranh luận đa tác nhân vòng tròn",
            "Tích hợp đa dạng API và dịch vụ bên ngoài"
          ]
        },
        {
          name: "DeepSeek",
          icon: "deepseek",
          desc: "Động cơ suy luận tiết kiệm chi phí, mạnh về phân tích ngữ cảnh dài và chuỗi suy luận có cấu trúc.",
          capabilities: [
            "Suy luận chuỗi tư duy sâu cho việc lập kế hoạch tác nhân phức tạp",
            "Cửa sổ ngữ cảnh lớn cho việc xem xét tài liệu cuộc họp",
            "Suy luận chi phí thấp cho các lượt chạy phòng ban khối lượng lớn"
          ]
        },
        {
          name: "Kimi (Moonshot)",
          icon: "kimi",
          desc: "Động cơ chuyên về ngữ cảnh siêu dài, tối ưu cho các cuộc hội thoại đa lượt kéo dài của tác nhân.",
          capabilities: [
            "Cửa sổ ngữ cảnh siêu dài cho lịch sử cuộc họp phức tạp",
            "Suy luận song ngữ Trung-Anh mạnh mẽ",
            "Gọi công cụ hiệu quả cho quy trình truy xuất tăng cường"
          ]
        },
        {
          name: "Open Weight",
          icon: "openrouter",
          desc: "Động cơ trọng số mở số lượng tham số lớn cho các cụm tác nhân bảo mật tự lưu trữ hoặc offline.",
          capabilities: [
            "Điều phối tự lưu trữ hoàn toàn không rò rỉ dữ liệu",
            "Tối ưu hóa cho thực thi mã Python trong sandbox Docker",
            "Tương thích linh hoạt các API và máy chủ tự cấu hình"
          ]
        }
      ]
    },
    tools: {
      title: "Những gì vận hành Công ty của bạn",
      sub: "Các dịch vụ runtime đứng sau mỗi công ty, phòng ban và nhân sự trên AI Collective.",
      cta: "Xem tài liệu lập trình",
      list: [
        { name: "AI Office Designer", desc: "Mô tả công ty của bạn qua chat — AI đề xuất phòng ban, nhân sự, kỹ năng, rồi tạo cả công ty chỉ với một cú nhấp." },
        { name: "6 Cấu trúc tác nhân", desc: "Điều phối luồng tuần tự (Sequential), tranh luận vòng tròn (Ring), mạng điều phối mesh, cấu trúc phân cấp Supervisor, cấu trúc cây (Tree), hoặc LangGraph DAG hoàn toàn tùy chỉnh." },
        { name: "Hơn 50 bộ công cụ", desc: "Trang bị cho tác nhân Google Drive, Sheets, công cụ tìm kiếm Brave, mạng xã hội và các tiện ích hệ thống." },
        { name: "Ủy thác Tác nhân con", desc: "Cho phép tác nhân chính tạo và chạy song song các tác nhân con đồng thời với giới hạn lượt nghiêm ngặt." },
        { name: "Luồng SSE thời gian thực", desc: "Theo dõi tiến trình thực thi từng lượt với các sự kiện chi tiết (agent_start, llm_request_start, subagent_complete)." },
        { name: "Môi trường Sandbox an toàn", desc: "Thực thi an toàn các lệnh Python/Bash trong các sandbox biệt lập trên Local hoặc Kubernetes." },
        { name: "Bộ nhớ biểu đồ tri thức", desc: "Trích xuất ngữ cảnh động qua NLP (spaCy) hoặc LLM để xây dựng bộ nhớ ngữ nghĩa có thể truy vấn." },
        { name: "Quản lý ngân sách Token", desc: "Tự động cắt tỉa và tối ưu hóa cửa sổ ngữ cảnh khi tiệm cận giới hạn token để kiểm soát chi phí." },
        { name: "Human-in-the-Loop", desc: "Can thiệp trực tiếp vào các cuộc thảo luận của tác nhân để hướng dẫn hoặc cung cấp dữ liệu đầu vào thủ công." },
        { name: "Phân vùng Company", desc: "Phân vùng dữ liệu an toàn cho nhiều company bằng JWT và cơ chế xác thực Google OAuth." }
      ]
    },
    console: {
      title: "Quản lý Công ty, Phòng ban và Nhân sự từ một Dashboard duy nhất",
      sub: "Từ AI Office Designer đến bảng công việc và cuộc họp trực tiếp — vận hành toàn bộ công ty AI của bạn qua các endpoint FastAPI sạch và bảng điều khiển trực quan.",
      devTitle: "Xây dựng cho kỹ sư AI",
      desc: "Theo dõi, biên chế và tinh chỉnh công ty của bạn:",
      bullets: [
        "Mô tả công ty qua chat và để AI Office Designer tạo ra phòng ban, nhân sự, kỹ năng",
        "Tạo, sửa đổi và cấu hình tác nhân và công cụ tùy chỉnh trong thời gian thực",
        "Theo dõi từng bước thực thi của tác nhân, nhật ký chi phí token và lịch sử tin nhắn",
        "Vận hành Projects, Task Board và Meetings trực tiếp, cùng Recruiting để tuyển thêm nhân sự"
      ]
    },
    usecases: {
      title: "Những gì bạn có thể xây dựng với AI Collective",
      list: [
        {
          name: "Công ty AI tức thì",
          desc: "Mô tả ý tưởng kinh doanh của bạn qua chat — AI Office Designer đề xuất phòng ban, nhân sự, kỹ năng, rồi xây cả công ty chỉ với một cú nhấp."
        },
        {
          name: "Tranh luận tài chính",
          desc: "Khởi tạo một nhóm tác nhân phân tích để tranh luận về các chỉ số thị trường bằng công cụ tìm kiếm Brave trong cấu trúc Ring."
        },
        {
          name: "Quy trình biên tập",
          desc: "Quản lý quy trình sáng tạo nội dung từ nghiên cứu, phác thảo đến phê bình và định dạng dưới sự dẫn dắt của Supervisor."
        },
        {
          name: "Thu thập dữ liệu song song",
          desc: "Ủy thác các tác vụ thu thập thông tin đồng thời cho các tác nhân con để phân tích các trang web mục tiêu bằng Playwright."
        }
      ]
    },
    footer: {
      ctaTitle: "Bắt đầu xây dựng",
      newsTitle: "Nhận cập nhật cho lập trình viên",
      newsSub: "Cập nhật sản phẩm, công thức mã nguồn, công cụ mới và nhiều thông tin bổ ích. Gửi hàng tháng tới hộp thư của bạn.",
      newsPlaceholder: "Nhập email của bạn",
      newsButton: "Đăng ký",
      newsDisclaimer: "Bằng cách đăng ký, bạn đồng ý nhận bản tin cập nhật định kỳ. Hủy đăng ký bất cứ lúc nào."
    },
    header: {
      meetCollective: "Khám phá Tập thể",
      platform: "Nền tảng",
      solutions: "Giải pháp",
      pricing: "Bảng giá",
      resources: "Tài nguyên",
      exploreHere: "Khám phá tại đây",
      login: "Yêu cầu truy cập",
      contactSales: "Liên hệ kinh doanh",
      startBuilding: "Bắt đầu xây dựng",
      products: "Sản phẩm",
      features: "Tính năng",
      models: "Mô hình",
      useCases: "Trường hợp sử dụng",
      aiStaff: "Tác nhân AI",
      dataPipelines: "Luồng dữ liệu",
      codeReview: "Kiểm định mã nguồn",
      companySize: "Quy mô công ty",
      startups: "Khởi nghiệp",
      enterprise: "Doanh nghiệp",
      departments: "Phòng ban",
      engineering: "Kỹ thuật",
      research: "Nghiên cứu",
      industries: "Ngành nghề",
      fintech: "FinTech",
      legal: "Pháp lý",
      healthcare: "Y tế",
      github: "GitHub",
      devDocs: "Tài liệu kỹ thuật",
      changelog: "Nhật ký thay đổi",
      overview: "Tổng quan",
      consoleLogin: "Yêu cầu truy cập Dashboard",
      star: "Đánh sao"
    },
    highlights: [
      "6 Cấu trúc Tác nhân",
      "AI Office Designer",
      "Hơn 50 Bộ Công cụ",
      "Streaming SSE Thời gian thực",
      "Bộ nhớ Biểu đồ Tri thức",
      "Không phụ thuộc LLM",
      "Sandbox Thực thi An toàn",
      "Lưu trữ JSON hoặc MongoDB",
      "Quản lý Ngân sách Token",
      "Source-Available"
    ],
    footerSitemap: {
      rights: "Bảo lưu mọi quyền. Tích hợp mạng lưới tác nhân AI trên các hệ thống công cộng và cục bộ.",
      products: "Sản phẩm",
      orchestrator: "Bộ điều phối",
      pricing: "Bảng giá",
      documentation: "Tài liệu kỹ thuật",
      solutions: "Giải pháp",
      enterprise: "Doanh nghiệp",
      education: "Giáo dục",
      financial: "Tài chính",
      company: "Công ty",
      aboutUs: "Về chúng tôi",
      careers: "Tuyển dụng",
      press: "Báo chí"
    }
  },
  zh: {
    hero: {
      h1: "打造属于你自己的 AI 公司",
      sub: "AI Collective 让你创建自己的公司，将其组织为多个部门，并为这些部门配备 AI 员工 — 通过 Sequential、Ring、Mesh、Supervisor、Tree 或完全自定义（Custom）的拓扑协调工作。",
      cta1: "开始构建",
      cta2: "查看开发者文档"
    },
    started: {
      title: "选择如何开始",
      buildOwn: {
        title: "自主部署",
        sub: "自行托管属于你自己的公司、部门与 AI 员工：",
        bullets: [
          "Sequential、Ring、Mesh、Supervisor、Tree 或完全自定义（Custom）的员工拓扑",
          "AI 办公室设计师：在聊天中描述公司，一键生成部门、员工与技能",
          "50+ 内置技能工具包 — Google Workspace、浏览器自动化，以及 15+ 消息平台",
          "自动代币预算管理和上下文窗口优化",
          "灵活的后端：本地运行 (JSON 存储) 或分布式部署 (通过 Docker Compose 的 MongoDB + RabbitMQ)",
          "交互式人机协同 (Human-in-the-Loop) 指导能力",
          "高级 spaCy 和基于 LLM 的知识图谱提取"
        ],
        cta: "开始构建"
      },
      support: {
        comingSoonBadge: "完整开源版本：即将推出",
        title: "商业授权",
        sub: "AI Collective 是源代码可见 (source-available) 的项目，免费用于非商业、研究与教育用途。若要用于付费产品、企业内部工具或 SaaS，需要单独的商业许可。",
        bullets: [
          "可免费自行托管，用于学习、研究与评估",
          "商业用途、营利用途或 SaaS 用途需获得作者的书面许可",
          "可提供定制集成与 Kubernetes 沙箱部署方面的指导",
          "直接联系以商讨授权条款"
        ],
        cta: "联系我们"
      }
    },
    models: {
      title: "支持的 LLM 基座",
      sub: "在运行时配置、交换或路由行业领先提供商的基座模型引擎。",
      batch: "完全与 LLM 无关：可在运行时切换提供商 — Google Gemini、Anthropic Claude、OpenAI、DeepSeek、Moonshot Kimi、智谱 GLM、OpenRouter,或任何兼容 OpenAI 的自定义端点 — 无需修改代码。",
      activeModelLabel: "当前活跃模型",
      capabilitiesHeader: "核心能力",
      list: [
        {
          name: "Google Gemini",
          icon: "gemini",
          desc: "默认速度引擎，针对实体提取和实时知识图谱进行了优化。",
          capabilities: [
            "自动 spaCy 和基于 LLM 的实体提取",
            "实时图谱构建和状态上下文加载",
            "智能体辩论轮次的高代币效率"
          ]
        },
        {
          name: "Anthropic Claude",
          icon: "anthropic",
          desc: "用于多智能体网状协调器和代码生成的首选逻辑引擎。",
          capabilities: [
            "先进的提示词缓存以减少代币开销",
            "卓越的工具选择和智能体委派流",
            "结构化代码 execution 验证"
          ]
        },
        {
          name: "OpenAI GPT",
          icon: "openai",
          desc: "用于结构化 JSON 模式和工具绑定的高可靠性标准引擎。",
          capabilities: [
            "针对输入/输出的严格 JSON 模式强制执行",
            "多智能体环形辩论共识格式化",
            "广泛的外部 API 集成"
          ]
        },
        {
          name: "DeepSeek",
          icon: "deepseek",
          desc: "高性价比推理引擎，擅长长上下文分析与结构化思维链任务。",
          capabilities: [
            "深度思维链推理，用于复杂的员工规划",
            "大上下文窗口，便于处理大量会议文档",
            "低成本推理，适合高吞吐量的部门运行"
          ]
        },
        {
          name: "Kimi (Moonshot)",
          icon: "kimi",
          desc: "超长上下文专用引擎，针对多轮长对话进行了优化。",
          capabilities: [
            "超长上下文窗口，适应庞大的会议历史",
            "强大的中英双语推理能力",
            "高效的工具调用，适用于检索增强工作流"
          ]
        },
        {
          name: "Open Weight",
          icon: "openrouter",
          desc: "用于自托管或物理隔离的安全智能体集群的高参数开源权重引擎。",
          capabilities: [
            "零数据泄露的自托管编排",
            "微调用于 Docker 沙箱内的 Python 代码执行",
            "兼容定制的模型提供商和端点"
          ]
        }
      ]
    },
    tools: {
      title: "支撑你公司运转的核心能力",
      sub: "AI Collective 上每一个公司、部门与员工背后的运行时服务。",
      cta: "查看开发者文档",
      list: [
        { name: "AI 办公室设计师", desc: "在聊天中描述你的公司 — AI 提出部门、员工与技能建议，一键创建整个公司。" },
        { name: "6 种员工拓扑", desc: "编排顺序流水线 (Sequential)、环形辩论 (Ring)、网状协调器网络 (Mesh)、主管层级 (Supervisor)、树状结构 (Tree)，或完全自定义的 LangGraph DAG。" },
        { name: "50+ 技能工具包", desc: "为员工装备 Google Drive/日历、Playwright 网页抓取、社交动态和生产力工具。" },
        { name: "子智能体委派", desc: "允许主员工并发生成并运行具有严格轮次限制的并行子智能体。" },
        { name: "实时 SSE 流式传输", desc: "通过透明的事件日志（agent_start、llm_request_start、subagent_complete）逐轮跟踪执行进度。" },
        { name: "安全沙箱执行", desc: "在隔离的本地或 Kubernetes 沙箱环境中安全地执行 Python/Bash 命令。" },
        { name: "知识图谱记忆", desc: "通过 NLP (spaCy) 或 LLM 动态提取对话上下文，构建可查询的语义记忆。" },
        { name: "上下文与代币预算", desc: "在接近代币限制时自动修剪和优化上下文窗口。" },
        { name: "人机协同 (Human-in-the-Loop)", desc: "干预正在进行的多员工讨论以指导员工或提供手动任务输入。" },
        { name: "多公司隔离", desc: "使用 JWT 验证、Google OAuth 和数据库隔离来确保多租户数据段的安全。" }
      ]
    },
    console: {
      title: "在一个 Dashboard 中管理你的公司、部门与员工",
      sub: "从 AI 办公室设计师到任务看板与实时会议 — 通过干净的 FastAPI 端点和交互式仪表盘运行你的整个 AI 公司。",
      devTitle: "专为 AI 工程师打造",
      desc: "监控、配置并微调你的公司：",
      bullets: [
        "在聊天中描述公司，让 AI 办公室设计师生成部门、员工与技能",
        "实时创建、编辑和配置定制员工与工具",
        "追踪员工执行步骤、代币成本日志和消息历史",
        "运行 Projects、Task Board 与实时 Meetings，并通过 Recruiting 招募新角色"
      ]
    },
    usecases: {
      title: "你可以用 AI Collective 构建什么",
      list: [
        {
          name: "即时 AI 公司",
          desc: "在聊天中描述你的商业想法 — AI 办公室设计师提出部门、员工与技能建议，一键构建整个公司。"
        },
        {
          name: "金融辩论",
          desc: "在环形拓扑下，生成分析师团队使用实时 Brave 搜索工具辩论市场指标。"
        },
        {
          name: "编辑流水线",
          desc: "在主管领导下，管理从研究和起草到校对和格式化的内容创作。"
        },
        {
          name: "并行网页爬取",
          desc: "委派并发爬取任务给子智能体，使用浏览器自动化工具解析目标网站。"
        }
      ]
    },
    footer: {
      ctaTitle: "开始构建",
      newsTitle: "获取开发者动态",
      newsSub: "产品更新、代码秘籍、工具新增等。每月发送至您的收件箱。",
      newsPlaceholder: "输入您的邮箱",
      newsButton: "订阅",
      newsDisclaimer: "订阅即表示您同意接收每月框架更新。可随时取消订阅。"
    },
    header: {
      meetCollective: "认识 Collective",
      platform: "平台",
      solutions: "解决方案",
      pricing: "价格",
      resources: "资源",
      exploreHere: "在此探索",
      login: "申请访问",
      contactSales: "联系销售",
      startBuilding: "开始构建",
      products: "产品",
      features: "功能",
      models: "模型",
      useCases: "使用场景",
      aiStaff: "AI 智能体",
      dataPipelines: "数据流水线",
      codeReview: "代码评审",
      companySize: "公司规模",
      startups: "初创公司",
      enterprise: "企业级",
      departments: "部门",
      engineering: "工程",
      research: "研究",
      industries: "行业",
      fintech: "金融科技",
      legal: "法律",
      healthcare: "医疗保健",
      github: "GitHub",
      devDocs: "开发者文档",
      changelog: "变更日志",
      overview: "概述",
      consoleLogin: "申请 Dashboard 访问权限",
      star: "Star"
    },
    highlights: [
      "6 种员工拓扑",
      "AI 办公室设计师",
      "50+ 技能工具包",
      "实时 SSE 流式传输",
      "知识图谱记忆",
      "LLM 无关",
      "安全沙箱执行",
      "JSON 或 MongoDB 存储",
      "Token 预算管理",
      "源代码可见 (Source-Available)"
    ],
    footerSitemap: {
      rights: "保留所有权利。跨公共和本地系统整合智能体网格网络。",
      products: "产品",
      orchestrator: "编排器",
      pricing: "价格",
      documentation: "文档",
      solutions: "解决方案",
      enterprise: "企业",
      education: "教育",
      financial: "金融",
      company: "公司",
      aboutUs: "关于我们",
      careers: "职业生涯",
      press: "新闻媒体"
    }
  },
  ja: {
    hero: {
      h1: "あなただけの AI カンパニーを構築",
      sub: "AI Collective は、自分自身の会社を作り、部門に組織化し、その部門に AI スタッフを配置できる場所です — Sequential、Ring、Mesh、Supervisor、Tree、または完全なカスタムトポロジーで業務を調整します。",
      cta1: "構築を始める",
      cta2: "開発者ドキュメントを見る"
    },
    started: {
      title: "開始方法を選択する",
      buildOwn: {
        title: "自身で展開する",
        sub: "以下を使用して、自分だけの会社・部門・AI スタッフをセルフホストします：",
        bullets: [
          "Sequential、Ring、Mesh、Supervisor、Tree、または完全カスタムのスタッフトポロジー",
          "AI オフィスデザイナー：チャットで会社を説明するだけで、部門・スタッフ・スキルをワンクリックで生成",
          "50以上の組み込みスキルツールキット — Google Workspace、ブラウザ自動化、15以上のメッセージングプラットフォーム",
          "自動トークン予算管理とコンテキストウィンドウの最適化",
          "柔軟なバックエンド：ローカル実行 (JSON ストレージ) 或いは分散デプロイ (Docker Compose による MongoDB + RabbitMQ)",
          "対話型ヒューマンインザループ（Human-in-the-Loop）ステアリング機能",
          "高度な spaCy および LLM ベースのナレッジグラフ抽出"
        ],
        cta: "構築を始める"
      },
      support: {
        comingSoonBadge: "完全なオープンソース版：近日公開",
        title: "商用ライセンス",
        sub: "AI Collective はソースアベイラブルなプロジェクトで、非商用・研究・教育目的での利用は無料です。有料製品、社内業務ツール、SaaS での利用には別途商用ライセンスが必要です。",
        bullets: [
          "学習・研究・評価目的のセルフホストは無料",
          "商用利用、収益目的の利用、SaaS 利用にはメンテナーからの書面による許可が必要",
          "カスタム統合や Kubernetes サンドボックス構築についてのガイダンスも提供可能",
          "ライセンス条件について直接ご相談ください"
        ],
        cta: "お問い合わせ"
      }
    },
    models: {
      title: "サポートされている LLM 基座",
      sub: "行业をリードするプロバイダー全体で、実行時に基座モデルエンジンを設定、交換、またはルーティングします。",
      batch: "完全に LLM 非依存:実行時にプロバイダを切り替え可能 — Google Gemini、Anthropic Claude、OpenAI、DeepSeek、Moonshot Kimi、Zhipu GLM、OpenRouter、または OpenAI 互換のカスタムエンドポイント — コード変更は不要です。",
      activeModelLabel: "有効なモデル",
      capabilitiesHeader: "主な機能",
      list: [
        {
          name: "Google Gemini",
          icon: "gemini",
          desc: "デフォルトの速度エンジン。エンティティ抽出とリアルタイムのナレッジグラフに最適化されています。",
          capabilities: [
            "自動化された spaCy および LLM ベースのエンティティ抽出",
            "リアルタイムのグラフ構築と状態コンテキストの読み込み",
            "エージェント討論ラウンドにおける高いトークン効率"
          ]
        },
        {
          name: "Anthropic Claude",
          icon: "anthropic",
          desc: "マルチエージェントメッシュコーディネーターおよびコード生成用のプレミアロジックエンジン。",
          capabilities: [
            "トークンオーバーヘッドを削減する高度なプロンプトキャッシュ",
            "優れたツール選択とエージェント委任フロー",
            "構造化コード実行検証"
          ]
        },
        {
          name: "OpenAI GPT",
          icon: "openai",
          desc: "構造化された JSON スキーマとツールバインディング用の信頼性の高い標準エンジン。",
          capabilities: [
            "入力/出力に対する厳密な JSON スキーマの強制",
            "マルチエージェントリング討論のコンセンサスフォーマット",
            "幅広い外部 API 統合"
          ]
        },
        {
          name: "DeepSeek",
          icon: "deepseek",
          desc: "コスト効率に優れた推論エンジン。長文コンテキスト分析と構造化された思考連鎖タスクに強みを持ちます。",
          capabilities: [
            "複雑なスタッフ計画のための深い思考連鎖推論",
            "会議資料を多く扱うための大規模コンテキストウィンドウ",
            "大量の部門実行に対応する低コスト推論"
          ]
        },
        {
          name: "Kimi (Moonshot)",
          icon: "kimi",
          desc: "超長コンテキストに特化したエンジン。長時間のマルチターン会話に最適化されています。",
          capabilities: [
            "膨大な会議履歴に対応する超長コンテキストウィンドウ",
            "強力な中英バイリンガル推論",
            "検索拡張ワークフロー向けの効率的なツール呼び出し"
          ]
        },
        {
          name: "Open Weight",
          icon: "openrouter",
          desc: "セルフホストまたはエアギャップされた安全なエージェントクラスター用の高パラメータオープンウェイトエンジン。",
          capabilities: [
            "データ漏洩ゼロのセルフホストオーケストレーション",
            "Docker サンドボックス内での Python コード実行用に微調整",
            "カスタムモデルプロバイダーおよびエンドポイントとの互换性"
          ]
        }
      ]
    },
    tools: {
      title: "あなたの会社を支える機能",
      sub: "AI Collective 上のすべての会社・部門・スタッフを支えるランタイムサービス。",
      cta: "開発者ドキュメントを見る",
      list: [
        { name: "AI オフィスデザイナー", desc: "チャットで会社を説明するだけ — AI が部門・スタッフ・スキルを提案し、ワンクリックで会社全体を作成します。" },
        { name: "6 種のスタッフトポロジー", desc: "Sequential パイプライン、Ring 討論、Mesh コーディネーターネットワーク、Supervisor 階層、Tree 構造、または完全カスタムの LangGraph DAG を編成します。" },
        { name: "50以上のスキルツールキット", desc: "スタッフに Google ドライブ/カレンダー、Playwright ウェブスクレイパー、ソーシャルフィード、生産性ツールを装備します。" },
        { name: "サブエージェント委任", desc: "メインスタッフが、厳密なターン制限を持つ並列サブエージェントを同時に生成して実行できるようにします。" },
        { name: "リアルタイム SSE ストリーミング", desc: "透明なイベントログ（agent_start、llm_request_start、subagent_complete）で実行プロセスをターンごとに追跡します。" },
        { name: "安全なサンドボックス実行", desc: "分離されたローカルまたは Kubernetes サンドボックス環境内で Python/Bash コマンドを安全に実行します。" },
        { name: "ナレッジグラフメモリ", desc: "NLP (spaCy) または LLM を介して会話コンテキストを動的に抽出し、クエリ可能なセマンティックメモリを構築します。" },
        { name: "コンテキストとトークンバジェット", desc: "トークン制限に近づいたときに、コンテキストウィンドウを自動的にトリミングおよび最適化します。" },
        { name: "ヒューマンインザループ (Human-in-the-Loop)", desc: "進行中のマルチスタッフディスカッションに介入して、スタッフを指導したり手動タスク入力を提供したりします。" },
        { name: "マルチカンパニー分離", desc: "JWT 検証、Google OAuth、およびデータベース分離を使用して、安全なマルチテナントデータセグメンテーションを実現します。" }
      ]
    },
    console: {
      title: "会社・部門・スタッフを 1 つの Dashboard で管理",
      sub: "AI オフィスデザイナーからタスクボード、ライブミーティングまで — クリーンな FastAPI エンドポイントと対話型ダッシュボードを介して、あなたの AI カンパニー全体を運用します。",
      devTitle: "AI エンジニア向けに構築",
      desc: "会社の監視、スタッフ配置、調整：",
      bullets: [
        "チャットで会社を説明し、AI オフィスデザイナーに部門・スタッフ・スキルを生成させる",
        "カスタムスタッフとツールをリアルタイムで作成、編集、設定",
        "スタッフの実行ステップ、トークンコストログ、メッセージ履歴を追跡",
        "Projects、Task Board、ライブ Meetings を運用し、Recruiting で新しい役割を採用"
      ]
    },
    usecases: {
      title: "AI Collective で作れるもの",
      list: [
        {
          name: "即席 AI カンパニー",
          desc: "チャットでビジネスアイデアを説明するだけ — AI オフィスデザイナーが部門・スタッフ・スキルを提案し、ワンクリックで会社全体を構築します。"
        },
        {
          name: "金融討論",
          desc: "リングトポロジーの下で、リアルタイムの Brave 検索ツールを使用して市場指標を議論するアナリストチームを生成します。"
        },
        {
          name: "編集パイプライン",
          desc: "スーパーバイザーの指導の下、調査や起草から校正、フォーマットまでのコンテンツ作成を管理します。"
        },
        {
          name: "並列ウェブクローリング",
          desc: "ブラウザ自動化ツールを使用してターゲットウェブサイトを解析するために、同時クローリングタスクをサブエージェントに委任します。"
        }
      ]
    },
    footer: {
      ctaTitle: "構築を始める",
      newsTitle: "開発者向けアップデートを受け取る",
      newsSub: "製品アップデート、コードレシピ、追加ツールなど。毎月受信トレイにお届けします。",
      newsPlaceholder: "メールアドレスを入力",
      newsButton: "購読",
      newsDisclaimer: "購読することにより、毎月のフレームワークアップデートの受信に同意したことになります。いつでも購読解除できます。"
    },
    header: {
      meetCollective: "Collective を知る",
      platform: "プラットフォーム",
      solutions: "ソリューション",
      pricing: "料金",
      resources: "リソース",
      exploreHere: "ここを探索",
      login: "アクセスをリクエスト",
      contactSales: "営業に連絡",
      startBuilding: "構築を始める",
      products: "製品",
      features: "機能",
      models: "モデル",
      useCases: "ユースケース",
      aiStaff: "AI エージェント",
      dataPipelines: "データパイプライン",
      codeReview: "コードレビュー",
      companySize: "会社規模",
      startups: "スタートアップ",
      enterprise: "エンタープライズ",
      departments: "部門",
      engineering: "開発",
      research: "研究",
      industries: "業界",
      fintech: "フィンテック",
      legal: "法務",
      healthcare: "ヘルスケア",
      github: "GitHub",
      devDocs: "開発者ドキュメント",
      changelog: "変更履歴",
      overview: "概要",
      consoleLogin: "ダッシュボードへのアクセスをリクエスト",
      star: "スター"
    },
    highlights: [
      "6 種のスタッフトポロジー",
      "AI オフィスデザイナー",
      "50以上のスキルツールキット",
      "リアルタイム SSE ストリーミング",
      "ナレッジグラフメモリ",
      "LLM 非依存",
      "安全なサンドボックス実行",
      "JSON または MongoDB ストレージ",
      "トークン予算管理",
      "ソースアベイラブル"
    ],
    footerSitemap: {
      rights: "All rights reserved. 公共システムとローカルシステム全体にエージェントメッシュネットワークを統合します。",
      products: "製品",
      orchestrator: "オーケレーター",
      pricing: "料金",
      documentation: "ドキュメント",
      solutions: "ソリューション",
      enterprise: "エンタープライズ",
      education: "教育",
      financial: "金融",
      company: "会社",
      aboutUs: "会社概要",
      careers: "採用情報",
      press: "プレス"
    }
  }
};

export type LandingCopy = typeof LANDING_COPY.en;

export function getLandingCopy(language: Language): LandingCopy {
  return (LANDING_COPY as Record<Language, LandingCopy>)[language] || LANDING_COPY.en;
}
