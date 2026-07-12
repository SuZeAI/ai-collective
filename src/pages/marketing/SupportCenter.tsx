import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, BookOpen, Terminal, CreditCard, ShieldCheck, 
  ArrowLeft, X, ThumbsUp, ThumbsDown, ChevronRight, 
  ExternalLink, Mail, MessageSquare, Landmark, HelpCircle 
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── TRANSLATIONS & CONTENTS ───────────────────────────────────────────────

type Category = "getting-started" | "console" | "billing" | "api" | "privacy";

interface Article {
  id: string;
  category: Category;
  title: string;
  summary: string;
  content: string;
  docPage: string;
  isPopular?: boolean;
}

const LOCALES_DATA = {
  en: {
    title: "Support Center",
    subtitle: "How can we help?",
    searchPlaceholder: "Search for articles...",
    categories: {
      "getting-started": "Getting Started",
      "console": "Console & Setup",
      "billing": "Billing & Plans",
      "api": "API & Integrations",
      "privacy": "Privacy & Security",
    },
    popularTitle: "Popular Articles",
    allArticlesTitle: "All Articles",
    noResults: "No articles found matching your query.",
    backBtn: "Back to Home",
    stillNeedHelp: "Still need help?",
    stillNeedHelpDesc: "If you couldn't find the answer in our help center, our team is always ready to assist.",
    contactUs: "Contact Sales",
    githubBtn: "Open GitHub Issue",
    wasHelpful: "Was this article helpful?",
    yes: "Yes",
    no: "No",
    readFullDocs: "Read full documentation",
    articleHelpText: "Thank you for your feedback!",
    docsLink: "Developer Docs",
    backToDocs: "Browse Developer Docs",
    viewAll: "View All",
    clearFilter: "Clear filter",
  },
  vi: {
    title: "Trung tâm Hỗ trợ",
    subtitle: "Chúng tôi có thể giúp gì cho bạn?",
    searchPlaceholder: "Tìm kiếm bài viết...",
    categories: {
      "getting-started": "Bắt đầu",
      "console": "Bảng điều khiển & Cài đặt",
      "billing": "Thanh toán & Gói dịch vụ",
      "api": "API & Tích hợp",
      "privacy": "Bảo mật & Quyền riêng tư",
    },
    popularTitle: "Bài viết nổi bật",
    allArticlesTitle: "Tất cả bài viết",
    noResults: "Không tìm thấy bài viết nào phù hợp với tìm kiếm của bạn.",
    backBtn: "Quay lại Trang chủ",
    stillNeedHelp: "Bạn vẫn cần trợ giúp?",
    stillNeedHelpDesc: "Nếu bạn không tìm thấy câu trả lời trong trung tâm trợ giúp, đội ngũ của chúng tôi luôn sẵn sàng hỗ trợ.",
    contactUs: "Liên hệ Kinh doanh",
    githubBtn: "Mở Issue trên GitHub",
    wasHelpful: "Bài viết này có hữu ích không?",
    yes: "Có",
    no: "Không",
    readFullDocs: "Xem tài liệu đầy đủ",
    articleHelpText: "Cảm ơn bạn đã phản hồi!",
    docsLink: "Tài liệu kỹ thuật",
    backToDocs: "Duyệt Tài liệu Kỹ thuật",
    viewAll: "Xem tất cả",
    clearFilter: "Xóa bộ lọc",
  },
  zh: {
    title: "支持中心",
    subtitle: "我们能帮您做些什么？",
    searchPlaceholder: "搜索文章...",
    categories: {
      "getting-started": "快速入门",
      "console": "控制台与设置",
      "billing": "计费与方案",
      "api": "API与集成",
      "privacy": "隐私与安全",
    },
    popularTitle: "热门文章",
    allArticlesTitle: "所有文章",
    noResults: "未找到符合您查询的文章。",
    backBtn: "返回首页",
    stillNeedHelp: "仍需要帮助？",
    stillNeedHelpDesc: "如果您在我们的帮助中心找不到答案，我们的团队随时为您提供服务。",
    contactUs: "联系销售",
    githubBtn: "在 GitHub 上提交问题",
    wasHelpful: "这篇文章有帮助吗？",
    yes: "是",
    no: "否",
    readFullDocs: "阅读完整文档",
    articleHelpText: "感谢您的反馈！",
    docsLink: "开发者文档",
    backToDocs: "浏览开发者文档",
    viewAll: "查看全部",
    clearFilter: "清除过滤器",
  },
  ja: {
    title: "サポートセンター",
    subtitle: "どのようなご用件でしょうか？",
    searchPlaceholder: "記事を検索...",
    categories: {
      "getting-started": "スタートガイド",
      "console": "コンソールと設定",
      "billing": "料金とプラン",
      "api": "APIと統合",
      "privacy": "プライバシーとセキュリティ",
    },
    popularTitle: "よく読まれている記事",
    allArticlesTitle: "すべての記事",
    noResults: "検索条件に一致する記事が見つかりませんでした。",
    backBtn: "ホームに戻る",
    stillNeedHelp: "まだ解決しない場合",
    stillNeedHelpDesc: "ヘルプセンターで回答が見つからない場合は、お気軽にチームまでお問い合わせください。",
    contactUs: "営業に連絡",
    githubBtn: "GitHub で Issue を開く",
    wasHelpful: "この記事は役に立ちましたか？",
    yes: "はい",
    no: "いいえ",
    readFullDocs: "ドキュメント全文を読む",
    articleHelpText: "フィードバックをありがとうございます！",
    docsLink: "開発者ドキュメント",
    backToDocs: "開発者ドキュメントを閲覧",
    viewAll: "すべて表示",
    clearFilter: "フィルターをクリア",
  }
};

const ARTICLES_DATA: Record<string, Article[]> = {
  en: [
    {
      id: "what-is-collective",
      category: "getting-started",
      title: "What is AI Collective?",
      summary: "An overview of the open-source multi-staff orchestration platform.",
      content: "AI Collective is an open-source platform designed to orchestrate departments of specialized AI staff. Unlike traditional single-agent systems, AI Collective enables multiple staff to collaborate, share memories, and utilize specialized tools to solve complex, multi-step tasks. Our platform includes an event-driven core powered by LangGraph and RabbitMQ, a secure container sandbox for running untrusted bash/python scripts, and a real-time visual UI.",
      docPage: "what-is",
      isPopular: true
    },
    {
      id: "quick-start",
      category: "getting-started",
      title: "Quick Start Guide",
      summary: "Learn how to clone, configure, and start the frontend and backend of AI Collective locally.",
      content: "To get started with AI Collective locally, you need Python 3.11+, Node.js 18+, and Docker (for RabbitMQ). First, clone the repository. Second, set up the backend virtual environment, install dependencies, and configure your `.env` file with LLM API keys (Anthropic, OpenAI, or Gemini). Third, run the Docker RabbitMQ container. Finally, run the backend FastAPI server and the Vite frontend dev server. You can then open the dashboard in your browser.",
      docPage: "quickstart",
      isPopular: true
    },
    {
      id: "installation-reqs",
      category: "getting-started",
      title: "Local Installation & Requirements",
      summary: "System requirements and setup instructions for Python and Node.js.",
      content: "AI Collective can be run on Linux, macOS, and Windows. We recommend a machine with at least 8GB of RAM and Python 3.11+. The frontend depends on Node.js 18+ and npm/yarn. For database operations and state persistence, a local PostgreSQL database or SQLite is used. For multi-staff communication, running a local RabbitMQ instance is highly recommended to support real-time streaming events.",
      docPage: "installation"
    },
    {
      id: "build-agent",
      category: "console",
      title: "Building Your First AI Staff",
      summary: "A step-by-step guide to configuring prompts, avatars, and skills for custom staff.",
      content: "In the AI Collective Console, navigate to the 'Staff' page and click 'New Staff'. Fill in the staff member's name, role (such as Developer or Researcher), and system instructions. The system instructions dictate the staff member's personality and goals. Choose an avatar icon and background color. Finally, assign specific skills (like Web Search or Google Sheets) that this staff member can invoke during task execution. Click save to register the staff member.",
      docPage: "guide-first-staff",
      isPopular: true
    },
    {
      id: "build-team",
      category: "console",
      title: "Coordinating Multi-Staff Departments",
      summary: "How to compose staff into departments and choose an execution mode (Sequential, Mesh, Ring, Supervisor, Tree, or Custom).",
      content: "Departments are groups of staff configured to collaborate. When creating a department, you must select an execution mode. 'Mesh mode' allows any staff member to message any other staff member freely, which is ideal for brainstorming and research. 'Sequential mode' enforces a strict pipeline (e.g., Writer -> Editor -> Reviewer), where each staff member passes its output to the next. 'Ring', 'Supervisor', and 'Tree' modes cover round-robin hand-off, dynamic delegation, and hierarchical delegation respectively, and 'Custom' lets you draw your own routing graph. You can customize the department composition and re-order staff at any time.",
      docPage: "guide-build-department"
    },
    {
      id: "monitor-tasks",
      category: "console",
      title: "Monitoring and Executing Tasks",
      summary: "Understanding task status lifecycles, and how to read the real-time execution graph.",
      content: "Once a department is created, you can assign them a 'Task'. When a task is started, the execution graphs are rendered as interactive SVGs. You will see nodes (staff) glowing when they are active, and animated arrows (messages) flowing between them. You can pause, resume, or force-stop tasks at any time, or click on individual messages in the 'Meetings' tab to inspect raw prompts, tool calls, and LLM completions.",
      docPage: "guide-run-task"
    },
    {
      id: "pricing-overview",
      category: "billing",
      title: "Pricing and Plans Overview",
      summary: "Details about the self-hosted Open Source, managed Pro, and Custom Enterprise plans.",
      content: "AI Collective offers three main plans: 1. Open Source (Free): Self-host the full platform on your own infrastructure with zero license costs. 2. Pro ($49/month): Managed cloud deployment with instant setup, distributed worker nodes, and priority email support. 3. Enterprise (Custom): Dedicated infrastructure, custom integrations, SLAs, and air-gapped security configurations. Note that LLM API costs are passed through directly at provider rates.",
      docPage: "pricing"
    },
    {
      id: "hipaa-baa",
      category: "billing",
      title: "How to Request BAA Agreements",
      summary: "Requesting HIPAA compliance and enterprise contract signing.",
      content: "For healthcare and pharmaceutical deployments requiring HIPAA compliance, AI Collective offers Business Associate Agreements (BAAs) for customers on our Enterprise plans. To request a BAA, please navigate to the Contact Sales page, select 'Business Associate Agreement' as your inquiry type, and fill in your organization details. Our compliance team will review and send over the agreement for signature.",
      docPage: "pricing"
    },
    {
      id: "custom-skills",
      category: "api",
      title: "Connecting Custom Skills & APIs",
      summary: "Adding external tools, Google Sheets, Slack, and custom JavaScript scripts.",
      content: "Skills represent actions your staff can take. You can add pre-built skills like Web Search or create custom HTTP tools. A custom HTTP skill lets a staff member call any REST API. You specify the URL, request method, headers, and parameter schema. The staff member will read the schema and construct payloads dynamically. You can also write custom JavaScript code snippets that execute in our sandboxed runtime for quick data transformation.",
      docPage: "guide-skills"
    },
    {
      id: "rate-limits",
      category: "api",
      title: "Requesting Rate Limit Increases",
      summary: "How to increase LLM request limits and tokens per minute.",
      content: "If your workflow requires high-frequency processing or processes millions of tokens, you might hit the default model provider rate limits. You can request limits increases by navigating to 'Contact Sales' -> select 'Increase rate limits' option, specify the target engine (e.g. GPT-4o, Claude Sonnet, Gemini) and the requested limit (e.g., 50 requests per minute or 200k tokens per minute), along with your business justification.",
      docPage: "configuration",
      isPopular: true
    },
    {
      id: "zdr-privacy",
      category: "privacy",
      title: "Zero Data Retention (ZDR) Options",
      summary: "Configuring privacy standards for regulated enterprise workloads.",
      content: "Zero Data Retention (ZDR) is available for enterprise clients in regulated sectors like finance and legal. Under ZDR, prompts and generated outputs are never logged or stored in the database, and LLM API requests are routed through dedicated endpoints that do not retain data for training or logs. For self-hosted instances, you have complete physical control over where logs are stored and can configure retention policies manually.",
      docPage: "configuration"
    },
    {
      id: "sandbox-security",
      category: "privacy",
      title: "Secure Execution Container Sandbox",
      summary: "How local, Docker, and Kubernetes sandbox environments execute untrusted scripts.",
      content: "AI Collective features a secure execution engine called Sandbox. When a staff member invokes a skill that requires running bash scripts or Python code, the execution is routed into a sandboxed environment. This prevents malicious code from accessing your host machine. Depending on your configuration, this sandbox can run inside local isolates, dedicated Docker containers, or dynamic Kubernetes pods managed by our provisioner service.",
      docPage: "architecture",
      isPopular: true
    }
  ],
  vi: [
    {
      id: "what-is-collective",
      category: "getting-started",
      title: "AI Collective là gì?",
      summary: "Tổng quan về nền tảng điều phối đa nhân sự mã nguồn mở.",
      content: "AI Collective là nền tảng mã nguồn mở được thiết kế để điều phối các phòng ban nhân sự AI chuyên biệt. Không giống như hệ thống đơn tác nhân truyền thống, AI Collective cho phép nhiều nhân sự cộng tác, chia sẻ bộ nhớ và sử dụng các công cụ chuyên biệt để giải quyết các tác vụ phức tạp, gồm nhiều bước. Nền tảng của chúng tôi bao gồm phần cốt lõi hướng sự kiện dựa trên LangGraph và RabbitMQ, một thùng cát container bảo mật để chạy mã bash/python không tin cậy và một giao diện trực quan thời gian thực.",
      docPage: "what-is",
      isPopular: true
    },
    {
      id: "quick-start",
      category: "getting-started",
      title: "Hướng dẫn Khởi động nhanh",
      summary: "Tìm hiểu cách nhân bản, cấu hình và chạy frontend lẫn backend của AI Collective cục bộ.",
      content: "Để bắt đầu với AI Collective cục bộ, bạn cần Python 3.11+, Node.js 18+, và Docker (cho RabbitMQ). Trước tiên, sao chép repository. Thứ hai, thiết lập môi trường ảo của backend, cài đặt các thư viện phụ thuộc và cấu hình tệp `.env` của bạn với khóa API của nhà cung cấp LLM (Anthropic, OpenAI hoặc Gemini). Thứ ba, chạy container Docker chứa RabbitMQ. Cuối cùng, chạy FastAPI server của backend và dev server Vite của frontend. Sau đó bạn có thể mở bảng điều khiển trong trình duyệt.",
      docPage: "quickstart",
      isPopular: true
    },
    {
      id: "installation-reqs",
      category: "getting-started",
      title: "Cài đặt Cục bộ & Yêu cầu",
      summary: "Yêu cầu hệ thống và hướng dẫn cài đặt Python và Node.js.",
      content: "AI Collective có thể chạy trên Linux, macOS và Windows. Chúng tôi khuyên bạn nên sử dụng máy có RAM ít nhất 8GB và Python 3.11+. Giao diện frontend phụ thuộc vào Node.js 18+ và npm/yarn. Đối với hoạt động cơ sở dữ liệu và lưu trữ trạng thái, hệ thống sử dụng PostgreSQL hoặc SQLite. Đối với giao tiếp đa nhân sự, việc chạy một thực thể RabbitMQ cục bộ được khuyến khích mạnh mẽ để hỗ trợ các sự kiện phát trực tuyến thời gian thực.",
      docPage: "installation"
    },
    {
      id: "build-agent",
      category: "console",
      title: "Tạo Nhân sự AI đầu tiên",
      summary: "Hướng dẫn từng bước cấu hình gợi ý (prompt), ảnh đại diện và kỹ năng cho nhân sự.",
      content: "Trong bảng điều khiển AI Collective, hãy điều hướng đến trang 'Nhân sự' và nhấp vào 'Nhân sự mới'. Điền tên nhân sự, vai trò (chẳng hạn như Developer hoặc Researcher) và các hướng dẫn hệ thống. Hướng dẫn hệ thống xác định tính cách và mục tiêu của nhân sự. Chọn một biểu tượng ảnh đại diện và màu nền. Cuối cùng, gán các kỹ năng cụ thể (như Tìm kiếm web hoặc Google Sheets) mà nhân sự này có thể gọi trong khi thực hiện nhiệm vụ. Nhấp vào lưu để đăng ký nhân sự.",
      docPage: "guide-first-staff",
      isPopular: true
    },
    {
      id: "build-team",
      category: "console",
      title: "Điều phối Phòng ban Đa nhân sự",
      summary: "Cách kết hợp nhân sự thành phòng ban và chọn chế độ thực thi (Sequential, Mesh, Ring, Supervisor, Tree hoặc Custom).",
      content: "Phòng ban là tập hợp nhân sự được cấu hình để cộng tác với nhau. Khi tạo phòng ban, bạn phải chọn chế độ thực thi. 'Chế độ Mesh' cho phép bất kỳ nhân sự nào gửi tin nhắn cho nhân sự khác một cách tự do, rất lý tưởng cho việc động não và nghiên cứu. 'Chế độ Sequential' bắt buộc một quy trình nghiêm ngặt (ví dụ: Writer -> Editor -> Reviewer), nơi mỗi nhân sự chuyển kết quả của mình cho người tiếp theo. Các chế độ 'Ring', 'Supervisor' và 'Tree' lần lượt là chuyển tiếp vòng tròn, ủy quyền linh hoạt và phân cấp; 'Custom' cho phép bạn tự vẽ luồng định tuyến riêng. Bạn có thể tùy chỉnh thành phần phòng ban bất cứ lúc nào.",
      docPage: "guide-build-department"
    },
    {
      id: "monitor-tasks",
      category: "console",
      title: "Theo dõi và Thực thi Nhiệm vụ",
      summary: "Tìm hiểu vòng đời trạng thái nhiệm vụ và cách xem biểu đồ thực thi thời gian thực.",
      content: "Sau khi tạo phòng ban, bạn có thể giao cho họ một 'Nhiệm vụ'. Khi một nhiệm vụ bắt đầu, biểu đồ thực thi được hiển thị dưới dạng SVG tương tác. Bạn sẽ thấy các nút (nhân sự) sáng lên khi hoạt động, và các mũi tên động (tin nhắn) chuyển động giữa chúng. Bạn có thể tạm dừng, tiếp tục hoặc bắt buộc dừng nhiệm vụ bất kỳ lúc nào, hoặc nhấp vào tin nhắn riêng lẻ trong tab 'Cuộc họp' để kiểm tra kỹ lưỡng.",
      docPage: "guide-run-task"
    },
    {
      id: "pricing-overview",
      category: "billing",
      title: "Tổng quan về Giá cả và Các gói",
      summary: "Thông tin chi tiết về các gói Mã nguồn mở tự lưu trữ, gói Pro và gói Doanh nghiệp tùy chỉnh.",
      content: "AI Collective cung cấp ba gói chính: 1. Mã nguồn mở (Miễn phí): Tự lưu trữ toàn bộ nền tảng trên cơ sở hạ tầng riêng không tốn phí bản quyền. 2. Pro ($49/tháng): Triển khai đám mây được quản lý giúp thiết lập tức thì, có các nút worker phân tán và hỗ trợ email ưu tiên. 3. Doanh nghiệp (Tùy chỉnh): Hạ tầng chuyên dụng, tích hợp tùy chỉnh, SLA và cấu hình bảo mật biệt lập. Chi phí token LLM được tính trực tiếp theo giá nhà cung cấp.",
      docPage: "pricing"
    },
    {
      id: "hipaa-baa",
      category: "billing",
      title: "Cách Yêu cầu Thỏa thuận BAA",
      summary: "Yêu cầu tuân thủ HIPAA và ký hợp đồng cấp doanh nghiệp.",
      content: "Đối với việc triển khai trong y tế và dược phẩm yêu cầu tuân thủ HIPAA, AI Collective cung cấp Thỏa thuận liên kết kinh doanh (BAA) cho khách hàng sử dụng gói Doanh nghiệp. Để yêu cầu ký BAA, vui lòng truy cập trang Liên hệ Kinh doanh, chọn 'Thỏa thuận liên kết kinh doanh' làm loại yêu cầu của bạn, và điền thông tin chi tiết về tổ chức. Đội ngũ tuân thủ của chúng tôi sẽ xem xét và gửi thỏa thuận.",
      docPage: "pricing"
    },
    {
      id: "custom-skills",
      category: "api",
      title: "Kết nối Kỹ năng & API Tùy chỉnh",
      summary: "Thêm công cụ bên ngoài, Google Sheets, Slack, và các tập lệnh JavaScript tùy chỉnh.",
      content: "Kỹ năng thể hiện các hành động mà nhân sự của bạn có thể thực hiện. Bạn có thể thêm các kỹ năng tích hợp sẵn như Tìm kiếm Web hoặc tạo các công cụ HTTP tùy chỉnh. Một kỹ năng HTTP tùy chỉnh cho phép nhân sự gọi bất kỳ REST API nào. Bạn xác định URL, phương thức yêu cầu, tiêu đề và schema tham số. Nhân sự sẽ tự động xây dựng payload dựa trên schema đó. Bạn cũng có thể viết JavaScript chạy trong môi trường thùng cát an toàn.",
      docPage: "guide-skills"
    },
    {
      id: "rate-limits",
      category: "api",
      title: "Yêu cầu Tăng giới hạn Tỷ lệ (Rate Limits)",
      summary: "Cách yêu cầu nâng giới hạn yêu cầu LLM và token mỗi phút.",
      content: "Nếu quy trình làm việc của bạn đòi hỏi tần suất xử lý cao hoặc xử lý hàng triệu token, bạn có thể chạm giới hạn mặc định của nhà cung cấp mô hình. Bạn có thể yêu cầu tăng giới hạn bằng cách truy cập 'Liên hệ Kinh doanh' -> chọn 'Tăng giới hạn tỷ lệ', chỉ định engine mô hình đích (ví dụ: GPT-4o, Claude Sonnet, Gemini) và giới hạn mong muốn (ví dụ: 50 requests/phút hoặc 200k tokens/phút), cùng lý do sử dụng.",
      docPage: "configuration",
      isPopular: true
    },
    {
      id: "zdr-privacy",
      category: "privacy",
      title: "Tùy chọn Không lưu giữ dữ liệu (ZDR)",
      summary: "Cấu hình tiêu chuẩn riêng tư cho các tác vụ doanh nghiệp được kiểm soát chặt chẽ.",
      content: "Không lưu giữ dữ liệu (ZDR) có sẵn cho các khách hàng doanh nghiệp trong các lĩnh vực đặc thù như tài chính và pháp lý. Dưới chế độ ZDR, các gợi ý và kết quả tạo ra không bao giờ được ghi nhật ký hoặc lưu giữ trong cơ sở dữ liệu, và các yêu cầu API LLM được định tuyến qua các endpoint chuyên dụng không lưu trữ dữ liệu để huấn luyện. Đối với các phiên bản tự lưu trữ, bạn có quyền kiểm soát vật lý tuyệt đối.",
      docPage: "configuration"
    },
    {
      id: "sandbox-security",
      category: "privacy",
      title: "Thùng cát Container chạy mã an toàn",
      summary: "Cách môi trường thùng cát cục bộ, Docker, và Kubernetes chạy các mã lệnh không tin cậy.",
      content: "AI Collective có một công cụ thực thi an toàn gọi là Sandbox (Thùng cát). Khi một nhân sự gọi kỹ năng yêu cầu chạy các kịch bản lệnh bash hoặc mã Python, việc thực thi được định tuyến vào một môi trường thùng cát biệt lập. Điều này ngăn mã độc truy cập vào máy chủ của bạn. Tùy thuộc vào cấu hình của bạn, thùng cát này có thể chạy bên trong các phân vùng cục bộ, container Docker chuyên dụng, hoặc các pod Kubernetes động.",
      docPage: "architecture",
      isPopular: true
    }
  ]
};

// Map other languages to fallback
ARTICLES_DATA.zh = ARTICLES_DATA.en;
ARTICLES_DATA.ja = ARTICLES_DATA.en;

// Icon mapper for categories
const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  "getting-started": BookOpen,
  "console": Landmark,
  "billing": CreditCard,
  "api": Terminal,
  "privacy": ShieldCheck,
};

export default function SupportCenter() {
  const { language } = useLanguage();
  
  // Resolve localized text strings
  const langKey = (language === "en" || language === "vi" || language === "zh" || language === "ja") ? language : "en";
  const localizedText = LOCALES_DATA[langKey];
  const articlesList = ARTICLES_DATA[langKey] || ARTICLES_DATA.en;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Feedback state for active article
  const [feedbackGiven, setFeedbackGiven] = useState<boolean>(false);

  // Filter articles based on category and search query
  const filteredArticles = useMemo(() => {
    return articlesList.filter((art) => {
      const matchesCategory = selectedCategory === "all" || art.category === selectedCategory;
      const matchesSearch = 
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        art.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [articlesList, selectedCategory, searchQuery]);

  // Extract popular articles
  const popularArticles = useMemo(() => {
    return articlesList.filter((art) => art.isPopular);
  }, [articlesList]);

  const handleArticleClick = (art: Article) => {
    setSelectedArticle(art);
    setFeedbackGiven(false);
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-foreground font-sans transition-colors duration-300">
      
      {/* ─── NAVBAR ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border/60 bg-background/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/spider.png" alt="AI Collective" className="h-6 w-6 object-contain" />
            <span className="font-serif text-lg font-medium">AI Collective</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link to="/contact-sales" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {localizedText.contactUs}
            </Link>
            <Link to="/dashboard" className="inline-flex h-9 px-4 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity">
              {language === "vi" ? "Mở Console" : "Open Console"}
            </Link>
          </div>
        </div>
      </div>

      {/* ─── HERO & SEARCH ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-accent/5 to-transparent pt-16 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent/25 bg-accent/5 text-xs text-accent font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            {localizedText.title}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
            {localizedText.subtitle}
          </h1>
          
          {/* Search bar with dynamic animation */}
          <div className="max-w-2xl mx-auto relative mt-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={localizedText.searchPlaceholder}
              className="w-full h-13 pl-12 pr-4 text-base rounded-xl border border-border/80 bg-card shadow-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─── CATEGORY FILTERS ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {(Object.keys(localizedText.categories) as Category[]).map((catKey) => {
            const Icon = CATEGORY_ICONS[catKey];
            const isSelected = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(isSelected ? "all" : catKey)}
                className={`flex flex-col items-center justify-center p-5 rounded-xl border transition-all text-center gap-3 group relative cursor-pointer ${
                  isSelected 
                    ? "border-accent bg-accent/5 shadow-sm" 
                    : "border-border/60 bg-card hover:border-accent/40 hover:shadow-sm"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isSelected ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent"
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold select-none">
                  {localizedText.categories[catKey]}
                </span>
                {isSelected && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── CONTENT GRID ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          
          {/* Main Articles List */}
          <div className="md:col-span-8 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-xl font-serif font-medium">
                {selectedCategory === "all" ? localizedText.allArticlesTitle : localizedText.categories[selectedCategory as Category]} 
                {` (${filteredArticles.length})`}
              </h2>
              {selectedCategory !== "all" && (
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  {localizedText.clearFilter}
                </button>
              )}
            </div>

            {filteredArticles.length > 0 ? (
              <div className="space-y-4">
                {filteredArticles.map((art, idx) => {
                  const CatIcon = CATEGORY_ICONS[art.category];
                  return (
                    <motion.div
                      key={art.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.03 }}
                      onClick={() => handleArticleClick(art)}
                      className="p-6 rounded-xl border border-border/60 bg-card hover:border-accent/40 hover:shadow-md cursor-pointer transition-all flex items-start gap-4 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-accent/15 group-hover:text-accent shrink-0 transition-colors">
                        <CatIcon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-base group-hover:text-accent transition-colors truncate">
                            {art.title}
                          </h3>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {art.summary}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-border/80 rounded-2xl bg-muted/10 space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {localizedText.noResults}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar: Popular & Links */}
          <div className="md:col-span-4 space-y-6">
            
            {/* Popular Articles */}
            <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="font-serif font-medium text-lg border-b border-border/40 pb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                {localizedText.popularTitle}
              </h3>
              <div className="space-y-3 text-sm">
                {popularArticles.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => handleArticleClick(art)}
                    className="w-full text-left font-medium hover:text-accent hover:underline flex items-start gap-1.5 py-1 transition-all group"
                  >
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/45 group-hover:text-accent" />
                    <span className="flex-1 line-clamp-2">{art.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-accent">
                {localizedText.docsLink}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {language === "vi" 
                  ? "Tru cập kho tài liệu lập trình viên đầy đủ bao gồm API reference và các mô hình điều phối." 
                  : "Access full developer documentation, guides, API parameters, and orchestration models."}
              </p>
              <a
                href="/docs"
                className="inline-flex h-9 items-center justify-center px-4 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity w-full gap-1.5"
              >
                {localizedText.backToDocs}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ─── CONTACT SECTION ────────────────────────────────────────────── */}
      <section className="bg-muted/30 border-t border-border/60 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-serif font-medium">
            {localizedText.stillNeedHelp}
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            {localizedText.stillNeedHelpDesc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              to="/contact-sales"
              className="inline-flex h-11 px-6 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity gap-2"
            >
              <Mail className="w-4 h-4" />
              {localizedText.contactUs}
            </Link>
            <a
              href="https://github.com/SuZeAI/ai-collective/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 px-6 items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted/40 transition-colors gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {localizedText.githubBtn}
            </a>
          </div>
        </div>
      </section>

      {/* ─── DRAWER DETAIL OVERLAY ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedArticle && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 cursor-pointer"
            />

            {/* Slide-out Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-card border-l border-border/80 shadow-2xl flex flex-col h-full"
            >
              
              {/* Drawer Header */}
              <div className="h-16 border-b border-border/60 flex items-center justify-between px-6 bg-background/60 backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    {localizedText.categories[selectedArticle.category]}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-thin">
                <div className="space-y-4">
                  <h2 className="text-2xl md:text-3xl font-serif font-medium tracking-tight leading-snug">
                    {selectedArticle.title}
                  </h2>
                  <p className="text-muted-foreground text-base leading-relaxed border-l-2 border-accent/40 pl-4 py-1 italic">
                    {selectedArticle.summary}
                  </p>
                </div>

                <div className="text-sm text-foreground/90 leading-relaxed space-y-4">
                  {selectedArticle.content.split("\n\n").map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>

                {/* Docs Link */}
                <div className="pt-4">
                  <Link
                    to={`/docs?page=${selectedArticle.docPage}`}
                    target="_blank"
                    className="inline-flex h-10 px-5 items-center justify-center rounded-lg bg-accent text-accent-foreground font-semibold text-xs hover:opacity-90 transition-opacity gap-1.5"
                  >
                    {localizedText.readFullDocs}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Drawer Footer: Feedback */}
              <div className="border-t border-border/60 bg-muted/20 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {localizedText.wasHelpful}
                </span>
                
                <AnimatePresence mode="wait">
                  {!feedbackGiven ? (
                    <motion.div 
                      key="feedback-actions"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <button
                        onClick={() => setFeedbackGiven(true)}
                        className="inline-flex h-9 px-4 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold hover:border-accent hover:text-accent hover:bg-accent/5 transition-all gap-1.5 cursor-pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {localizedText.yes}
                      </button>
                      <button
                        onClick={() => setFeedbackGiven(true)}
                        className="inline-flex h-9 px-4 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold hover:border-accent hover:text-accent hover:bg-accent/5 transition-all gap-1.5 cursor-pointer"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        {localizedText.no}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="feedback-success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs text-accent font-semibold"
                    >
                      {localizedText.articleHelpText}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
