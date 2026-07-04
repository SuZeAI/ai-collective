import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ArrowRight, Star, Bot, Check,
  Menu, X, ChevronDown, Play, Sparkles,
  ExternalLink, Mail, ArrowUpRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Language } from "@/locales";

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";
const GITHUB_REPO = "SuZeAI/ai-collective";

function useGitHubStats() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then((r) => r.json())
      .then((d) => { setStars(d.stargazers_count ?? null); })
      .catch(() => {});
  }, []);
  return { stars };
}

function fmt(n: number | null) {
  if (n === null) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const LOCAL_COPY = {
  en: {
    hero: {
      h1: "Build on the AI Collective Platform",
      sub: "A high-performance multi-agent orchestration platform for programmable AI workforces. Deploy sequential, ring, mesh, or supervisor agent topologies with atomic tool integration.",
      cta1: "Start building",
      cta2: "See developer docs"
    },
    started: {
      title: "Choose how to get started",
      buildOwn: {
        title: "Deploy on your own",
        sub: "Launch your own custom multi-agent workforce with:",
        bullets: [
          "Sequential, Ring, Mesh, or Supervisor agent topologies",
          "50+ atomic skill toolkits (Google Workspace, browser automation, social media)",
          "Automatic token budget management and context-window optimization",
          "Flexible backend: local run (JSON) or distributed scaling (Docker/RabbitMQ)",
          "Interactive Human-in-the-Loop steering capabilities",
          "Advanced spaCy and LLM-based Knowledge Graph extraction"
        ],
        cta: "Start building"
      },
      support: {
        title: "Enterprise Deployments",
        sub: "Need custom tool integrations, Kubernetes sandboxes, or hosted orchestration?",
        bullets: [
          "Enterprise onboarding and custom agent topology design",
          "Custom API and database integrations with SLA guarantees",
          "Managed high-throughput RabbitMQ and Redis clustering",
          "Advanced secure code execution sandbox configuration (Docker/K8s)",
          "Dedicated 24/7 engineering and deployment support"
        ],
        cta: "Contact sales"
      }
    },
    models: {
      title: "Supported LLM Foundations",
      sub: "Configure, swap, or route foundational model engines at runtime across industry-leading providers.",
      batch: "Fully LLM-agnostic: Route via Google Gemini, Anthropic, OpenAI, or OpenRouter gateway.",
      activeModelLabel: "Active Model",
      capabilitiesHeader: "Key Capabilities",
      list: [
        {
          name: "Google Gemini",
          desc: "Default speed engine, optimized for entity extraction and real-time knowledge graphs.",
          modelKey: "gemini-2.0-flash",
          capabilities: [
            "Automated spaCy & LLM-based entity extraction",
            "Real-time graph building and state context loading",
            "High token efficiency for agent debate rounds"
          ]
        },
        {
          name: "Anthropic Claude",
          desc: "Premier logic engine for multi-agent mesh coordinator and code generation.",
          modelKey: "claude-3-5-sonnet",
          capabilities: [
            "Advanced prompt caching to reduce token overhead",
            "Superior tool selection and agent delegation flow",
            "Structured code execution validation"
          ]
        },
        {
          name: "OpenAI GPT",
          desc: "Highly reliable standard engine for structured JSON schemas and tool binding.",
          modelKey: "gpt-4o",
          capabilities: [
            "Strict JSON schema enforcement for inputs/outputs",
            "Multi-agent ring debate consensus formatting",
            "Broad external API integrations"
          ]
        },
        {
          name: "Open Weight (Qwen)",
          desc: "High-parameter open weight engine for self-hosted or air-gapped secure agent clusters.",
          modelKey: "qwen3.5-397B-A17B",
          capabilities: [
            "Self-hosted orchestration with zero data leakage",
            "Fine-tuned for Python code execution inside Docker sandboxes",
            "Compatible with custom model providers and endpoints"
          ]
        }
      ]
    },
    tools: {
      title: "Capabilities of the Agent Mesh",
      sub: "Explore the advanced runtime services powering the AI Collective platform.",
      cta: "See developer docs",
      list: [
        { name: "Multi-Agent Topologies", desc: "Orchestrate sequential pipelines, ring debate patterns, mesh coordinator networks, or supervisor structures." },
        { name: "50+ Skill Toolkits", desc: "Equip agents with Google Drive/Calendar, Playwright web scrapers, social feeds, and productivity tools." },
        { name: "Subagent Delegation", desc: "Allow main agents to spawn and run parallel subagents concurrently with strict turn limits." },
        { name: "Real-time SSE Streaming", desc: "Follow execution progress turn-by-turn with transparent event logs (agent_start, llm_request, subagent_complete)." },
        { name: "Secure Sandbox Execution", desc: "Safely execute Python/Bash commands inside isolated local, Docker, or Kubernetes sandbox environments." },
        { name: "Knowledge Graph Memory", desc: "Extract conversation context dynamically via NLP (spaCy) or LLMs to build a queryable semantic memory." },
        { name: "Context & Token Budgeting", desc: "Automatically trim and optimize context windows when approaching token limits." },
        { name: "Human-in-the-Loop", desc: "Intervene in ongoing multi-agent discussions to steer agents or provide manual task inputs." },
        { name: "Multi-Workspace Isolation", desc: "Secure multi-tenant data segmentation using JWT validation, Google OAuth, and database isolation." }
      ]
    },
    console: {
      title: "Manage Teams inside the AI Collective Console",
      sub: "Integrate powerful multi-agent teams into your existing application stack via clean FastAPI endpoints and interactive dashboards.",
      devTitle: "Built for AI Engineers",
      desc: "Monitor, test, and tune your workforce:",
      bullets: [
        "Create, edit, and configure custom agents and tools in real-time",
        "Trace agent execution steps, token cost logs, and message histories",
        "Interact directly with teams during multi-round runs"
      ]
    },
    usecases: {
      title: "Real-world Multi-Agent Use Cases",
      list: [
        {
          name: "Financial Debate",
          desc: "Spawn a team of analysts debating market indicators using real-time Brave search tools under a Ring topology."
        },
        {
          name: "Editorial Pipeline",
          desc: "Manage content creation from research and drafting to proofreading and formatting under a Supervisor lead."
        },
        {
          name: "Software Auditing",
          desc: "Run automated vulnerability scanner agents that execute and test code within secure, isolated sandboxes."
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
      login: "Login",
      contactSales: "Contact sales",
      startBuilding: "Start building",
      products: "Products",
      features: "Features",
      models: "Models",
      useCases: "Use cases",
      aiAgents: "AI agents",
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
      consoleLogin: "Console login",
      star: "Star"
    },
    testimonials: [
      {
        logo: "CODEMESH",
        text: "“On AgentBench, the AI Collective multi-agent mesh architecture gave us immediate latency improvements and clean orchestration.”",
        author: "Marcus Vance, CEO"
      },
      {
        logo: "EVENTPASS",
        text: "“Deploying multi-agent workflows was simple. The reliability and flexibility of the LangGraph topology options made the transition seamless.”",
        author: "Taylor Addison, Engineering Chief of Staff"
      },
      {
        logo: "SPARKAGENT",
        text: "“The ability to run secure code execution sandbox alongside specialized toolkits has elevated our agent performance by a wide margin.”",
        author: "SparkAgent Core Team"
      },
      {
        logo: "SHOPMESH",
        text: "“AI Collective handles ticket triage, multi-step workflows, and complex conversational queries with robust human-in-the-loop support.”",
        author: "ShopMesh Dev Team"
      }
    ],
    footerSitemap: {
      rights: "All rights reserved. Integrating agent mesh networks across public and local systems.",
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
      h1: "Xây dựng trên Nền tảng AI Collective",
      sub: "Nền tảng điều phối đa tác nhân (multi-agent) hiệu năng cao cho lực lượng lao động AI lập trình được. Triển khai các cấu trúc Sequential, Ring, Mesh hoặc Supervisor với tích hợp công cụ nguyên tử.",
      cta1: "Bắt đầu xây dựng",
      cta2: "Xem tài liệu lập trình"
    },
    started: {
      title: "Chọn cách thức bắt đầu",
      buildOwn: {
        title: "Tự triển khai",
        sub: "Khởi chạy lực lượng lao động đa tác nhân tùy chỉnh của bạn với:",
        bullets: [
          "Các cấu trúc tác nhân: Sequential, Ring, Mesh hoặc Supervisor",
          "Hơn 50 bộ công cụ nguyên tử (Google Workspace, tự động hóa trình duyệt, mạng xã hội)",
          "Tự động quản lý ngân sách Token và tối ưu hóa cửa sổ ngữ cảnh",
          "Backend linh hoạt: chạy local (JSON) hoặc mở rộng phân tán (Docker/RabbitMQ)",
          "Tương tác điều hướng trực tiếp bằng cơ chế Human-in-the-loop",
          "Trích xuất Biểu đồ tri thức (Knowledge Graph) nâng cao qua spaCy hoặc LLM"
        ],
        cta: "Bắt đầu xây dựng"
      },
      support: {
        title: "Triển khai doanh nghiệp",
        sub: "Cần tích hợp công cụ tùy chỉnh, Kubernetes sandbox hoặc hệ thống điều phối lưu trữ?",
        bullets: [
          "Hỗ trợ tích hợp và thiết kế cấu trúc tác nhân doanh nghiệp",
          "Tích hợp API và cơ sở dữ liệu tùy chỉnh kèm cam kết SLA",
          "Quản lý cụm RabbitMQ và Redis hiệu năng cao được lưu trữ",
          "Cấu hình môi trường sandbox thực thi mã an toàn (Docker/Kubernetes)",
          "Hỗ trợ kỹ thuật và vận hành triển khai chuyên dụng 24/7"
        ],
        cta: "Liên hệ kinh doanh"
      }
    },
    models: {
      title: "Các động cơ mô hình được hỗ trợ",
      sub: "Cấu hình, thay đổi hoặc định tuyến các động cơ mô hình nền tảng ở thời điểm chạy mà không cần sửa mã.",
      batch: "Hoàn toàn độc lập mô hình: Định tuyến qua Google Gemini, Anthropic, OpenAI hoặc OpenRouter.",
      activeModelLabel: "Model kích hoạt",
      capabilitiesHeader: "Khả năng chính",
      list: [
        {
          name: "Google Gemini",
          desc: "Động cơ tốc độ mặc định, tối ưu hóa cho việc trích xuất thực thể và đồ thị tri thức thời gian thực.",
          modelKey: "gemini-2.0-flash",
          capabilities: [
            "Trích xuất thực thể tự động bằng spaCy & LLM",
            "Xây dựng đồ thị ngữ cảnh và tải trạng thái cực nhanh",
            "Tối ưu hóa token cho các lượt tranh luận của tác nhân"
          ]
        },
        {
          name: "Anthropic Claude",
          desc: "Động cơ logic hàng đầu cho bộ điều phối mesh đa tác nhân và sinh mã nguồn.",
          modelKey: "claude-3-5-sonnet",
          capabilities: [
            "Hỗ trợ prompt caching giảm chi phí token và độ trễ",
            "Khả năng lựa chọn công cụ và ủy thác tác nhân tối ưu",
            "Xác thực và thực thi mã nguồn sandbox tin cậy"
          ]
        },
        {
          name: "OpenAI GPT",
          desc: "Động cơ tiêu chuẩn độ tin cậy cao cho các schema JSON cấu trúc và liên kết công cụ.",
          modelKey: "gpt-4o",
          capabilities: [
            "Ràng buộc lược đồ JSON nghiêm ngặt cho input/output",
            "Định dạng đồng thuận tranh luận đa tác nhân vòng tròn",
            "Tích hợp đa dạng API và dịch vụ bên ngoài"
          ]
        },
        {
          name: "Open Weight (Qwen)",
          desc: "Động cơ trọng số mở số lượng tham số lớn cho các cụm tác nhân bảo mật tự lưu trữ hoặc offline.",
          modelKey: "qwen3.5-397B-A17B",
          capabilities: [
            "Điều phối tự lưu trữ hoàn toàn không rò rỉ dữ liệu",
            "Tối ưu hóa cho thực thi mã Python trong sandbox Docker",
            "Tương thích linh hoạt các API và máy chủ tự cấu hình"
          ]
        }
      ]
    },
    tools: {
      title: "Năng lực của Mạng lưới Tác nhân",
      sub: "Khám phá các dịch vụ runtime tiên tiến cung cấp năng lượng cho nền tảng AI Collective.",
      cta: "Xem tài liệu lập trình",
      list: [
        { name: "Điều phối Đa tác nhân", desc: "Điều phối luồng tuần tự, tranh luận vòng tròn, mạng điều phối mesh hoặc cấu trúc supervisor." },
        { name: "Hơn 50 bộ công cụ", desc: "Trang bị cho tác nhân Google Drive, Sheets, công cụ tìm kiếm Brave, mạng xã hội và các tiện ích hệ thống." },
        { name: "Ủy thác Tác nhân con", desc: "Cho phép tác nhân chính tạo và chạy song song các tác nhân con đồng thời với giới hạn lượt nghiêm ngặt." },
        { name: "Luồng SSE thời gian thực", desc: "Theo dõi tiến trình thực thi từng lượt với các sự kiện chi tiết (agent_start, llm_request, subagent_complete)." },
        { name: "Môi trường Sandbox an toàn", desc: "Thực thi an toàn các lệnh Python/Bash trong các sandbox biệt lập trên Local, Docker hoặc Kubernetes." },
        { name: "Bộ nhớ biểu đồ tri thức", desc: "Trích xuất ngữ cảnh động qua NLP (spaCy) hoặc LLM để xây dựng bộ nhớ ngữ nghĩa có thể truy vấn." },
        { name: "Quản lý ngân sách Token", desc: "Tự động cắt tỉa và tối ưu hóa cửa sổ ngữ cảnh khi tiệm cận giới hạn token để kiểm soát chi phí." },
        { name: "Human-in-the-Loop", desc: "Can thiệp trực tiếp vào các cuộc thảo luận của tác nhân để hướng dẫn hoặc cung cấp dữ liệu đầu vào thủ công." },
        { name: "Phân vùng Workspace", desc: "Phân vùng dữ liệu an toàn cho nhiều workspace bằng JWT và cơ chế xác thực Google OAuth." }
      ]
    },
    console: {
      title: "Quản lý đội ngũ tác nhân trên AI Collective Console",
      sub: "Tích hợp các đội ngũ tác nhân mạnh mẽ vào ứng dụng hiện tại thông qua các endpoint FastAPI sạch và bảng điều khiển trực quan.",
      devTitle: "Xây dựng cho kỹ sư AI",
      desc: "Theo dõi, thử nghiệm và tinh chỉnh lực lượng lao động của bạn:",
      bullets: [
        "Tạo, sửa đổi và cấu hình tác nhân và công cụ tùy chỉnh trong thời gian thực",
        "Theo dõi từng bước thực thi của tác nhân, nhật ký chi phí token và lịch sử tin nhắn",
        "Tương tác trực tiếp với các nhóm tác nhân trong các lượt chạy nhiều vòng"
      ]
    },
    usecases: {
      title: "Trường hợp sử dụng thực tế",
      list: [
        {
          name: "Tranh luận tài chính",
          desc: "Khởi tạo một nhóm tác nhân phân tích để tranh luận về các chỉ số thị trường bằng công cụ tìm kiếm Brave trong cấu trúc Ring."
        },
        {
          name: "Quy trình biên tập",
          desc: "Quản lý quy trình sáng tạo nội dung từ nghiên cứu, phác thảo đến phê bình và định dạng dưới sự dẫn dắt của Supervisor."
        },
        {
          name: "Kiểm định phần mềm",
          desc: "Chạy các tác nhân quét lỗ hổng bảo mật tự động, thực thi và kiểm thử mã nguồn trong các sandbox Docker an sau toàn."
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
      login: "Đăng nhập",
      contactSales: "Liên hệ kinh doanh",
      startBuilding: "Bắt đầu xây dựng",
      products: "Sản phẩm",
      features: "Tính năng",
      models: "Mô hình",
      useCases: "Trường hợp sử dụng",
      aiAgents: "Tác nhân AI",
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
      consoleLogin: "Đăng nhập Console",
      star: "Đánh sao"
    },
    testimonials: [
      {
        logo: "CODEMESH",
        text: "“Trên AgentBench, kiến trúc mesh đa tác nhân của AI Collective đã mang lại cải tiến độ trễ tức thì và điều phối gọn gàng cho chúng tôi.”",
        author: "Marcus Vance, CEO"
      },
      {
        logo: "EVENTPASS",
        text: "“Triển khai luồng công việc đa tác nhân cực kỳ đơn giản. Độ tin cậy và linh hoạt của các tùy chọn cấu trúc LangGraph đã giúp quá trình chuyển đổi diễn ra liền mạch.”",
        author: "Taylor Addison, Engineering Chief of Staff"
      },
      {
        logo: "SPARKAGENT",
        text: "“Khả năng chạy sandbox thực thi mã an toàn bên cạnh các bộ công cụ chuyên dụng đã nâng cao hiệu suất tác nhân của chúng tôi lên một mức vượt trội.”",
        author: "SparkAgent Core Team"
      },
      {
        logo: "SHOPMESH",
        text: "“AI Collective xử lý phân loại ticket, quy trình nhiều bước và các câu hỏi hội thoại phức tạp với sự hỗ trợ Human-in-the-loop mạnh mẽ.”",
        author: "ShopMesh Dev Team"
      }
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
      h1: "构建于 AI Collective 平台",
      sub: "用于可编程 AI 员工的高性能多智能体编排平台。部署具有原子工具集成的顺序、环形、网状或主管智能体拓扑。",
      cta1: "开始构建",
      cta2: "查看开发者文档"
    },
    started: {
      title: "选择如何开始",
      buildOwn: {
        title: "自主部署",
        sub: "启动您定制的多智能体员工：",
        bullets: [
          "顺序、环形、网状或主管智能体拓扑",
          "50+ 原子级技能工具包（Google Workspace、浏览器自动化、社交媒体）",
          "自动代币预算管理和上下文窗口优化",
          "灵活的后端：本地运行 (JSON) 或分布式扩展 (Docker/RabbitMQ)",
          "交互式人机协同 (Human-in-the-Loop) 指导能力",
          "高级 spaCy 和基于 LLM 的知识图谱提取"
        ],
        cta: "开始构建"
      },
      support: {
        title: "企业部署",
        sub: "需要定制工具集成、Kubernetes 沙箱或托管编排？",
        bullets: [
          "企业新手引导 and 定制智能体拓扑设计",
          "带 SLA 保证的定制 API 和数据库集成",
          "托管的高吞吐量 RabbitMQ 和 Redis 集群",
          "高级安全代码执行沙箱配置（Docker/K8s）",
          "专用的 24/7 工程与部署支持"
        ],
        cta: "联系销售"
      }
    },
    models: {
      title: "支持的 LLM 基座",
      sub: "在运行时配置、交换或路由行业领先提供商的基座模型引擎。",
      batch: "完全 LLM 无关：通过 Google Gemini、Anthropic、OpenAI 或 OpenRouter 网关进行路由。",
      activeModelLabel: "当前活跃模型",
      capabilitiesHeader: "核心能力",
      list: [
        {
          name: "Google Gemini",
          desc: "默认速度引擎，针对实体提取和实时知识图谱进行了优化。",
          modelKey: "gemini-2.0-flash",
          capabilities: [
            "自动 spaCy 和基于 LLM 的实体提取",
            "实时图谱构建和状态上下文加载",
            "智能体辩论轮次的高代币效率"
          ]
        },
        {
          name: "Anthropic Claude",
          desc: "用于多智能体网状协调器和代码生成的首选逻辑引擎。",
          modelKey: "claude-3-5-sonnet",
          capabilities: [
            "先进的提示词缓存以减少代币开销",
            "卓越的工具选择和智能体委派流",
            "结构化代码 execution 验证"
          ]
        },
        {
          name: "OpenAI GPT",
          desc: "用于结构化 JSON 模式和工具绑定的高可靠性标准引擎。",
          modelKey: "gpt-4o",
          capabilities: [
            "针对输入/输出的严格 JSON 模式强制执行",
            "多智能体环形辩论共识格式化",
            "广泛的外部 API 集成"
          ]
        },
        {
          name: "Open Weight (Qwen)",
          desc: "用于自托管或物理隔离的安全智能体集群的高参数开源权重引擎。",
          modelKey: "qwen3.5-397B-A17B",
          capabilities: [
            "零数据泄露的自托管编排",
            "微调用于 Docker 沙箱内的 Python 代码执行",
            "兼容定制的模型提供商和端点"
          ]
        }
      ]
    },
    tools: {
      title: "智能体网格 (Agent Mesh) 能力",
      sub: "探索为 AI Collective 平台提供支持的高级运行时服务。",
      cta: "查看开发者文档",
      list: [
        { name: "多智能体拓扑", desc: "编排顺序流水线、环形辩论模式、网状协调器网络或主管结构。" },
        { name: "50+ 技能工具包", desc: "为智能体装备 Google Drive/日历、Playwright 网页抓取、社交动态和生产力工具。" },
        { name: "子智能体委派", desc: "允许主智能体并发生成并运行具有严格轮次限制的并行子智能体。" },
        { name: "实时 SSE 流式传输", desc: "通过透明的事件日志（agent_start, llm_request, subagent_complete）逐轮跟踪执行进度。" },
        { name: "安全沙箱执行", desc: "在隔离的本地、Docker 或 Kubernetes 沙箱环境中安全地执行 Python/Bash 命令。" },
        { name: "知识图谱记忆", desc: "通过 NLP (spaCy) 或 LLM 动态提取对话上下文，构建可查询的语义记忆。" },
        { name: "上下文与代币预算", desc: "在接近代币限制时自动修剪和优化上下文窗口。" },
        { name: "人机协同 (Human-in-the-Loop)", desc: "干预正在进行的多智能体讨论以指导智能体或提供手动任务输入。" },
        { name: "多工作区隔离", desc: "使用 JWT 验证、Google OAuth 和数据库隔离来确保多租户数据段的安全。" }
      ]
    },
    console: {
      title: "在 AI Collective 控制台中管理团队",
      sub: "通过干净的 FastAPI 端点和交互式仪表盘，将强大的多智能体团队集成到您现有的应用栈中。",
      devTitle: "专为 AI 工程师打造",
      desc: "监控、测试和微调您的员工队伍：",
      bullets: [
        "实时创建、编辑和配置定制智能体与工具",
        "追踪智能体执行步骤、代币成本日志和消息历史",
        "在多轮运行中直接与团队互动"
      ]
    },
    usecases: {
      title: "真实世界多智能体使用场景",
      list: [
        {
          name: "金融辩论",
          desc: "在环形拓扑下，生成分析师团队使用实时 Brave 搜索工具辩论市场指标。"
        },
        {
          name: "编辑流水线",
          desc: "在主管领导下，管理从研究和起草到校对和格式化的内容创作。"
        },
        {
          name: "软件审计",
          desc: "运行在安全、隔离的沙箱内执行并测试代码的自动化漏洞扫描器智能体。"
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
      login: "登录",
      contactSales: "联系销售",
      startBuilding: "开始构建",
      products: "产品",
      features: "功能",
      models: "模型",
      useCases: "使用场景",
      aiAgents: "AI 智能体",
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
      consoleLogin: "控制台登录",
      star: "Star"
    },
    testimonials: [
      {
        logo: "CODEMESH",
        text: "“在 AgentBench 上，AI Collective 的多智能体网格架构为我们带来了即时的延迟改善和干净的编排。”",
        author: "Marcus Vance, CEO"
      },
      {
        logo: "EVENTPASS",
        text: "“部署多智能体工作流非常简单。LangGraph 拓扑选项的可靠性和灵活性使过渡变得无缝。”",
        author: "Taylor Addison, 首席工程参谋"
      },
      {
        logo: "SPARKAGENT",
        text: "“在专用工具包旁运行安全代码执行沙箱的能力，极大地提升了我们智能体的表现。”",
        author: "SparkAgent 核心团队"
      },
      {
        logo: "SHOPMESH",
        text: "“AI Collective 拥有强大的半自动人机协同支持，能处理工单分类、多步骤工作流和复杂的对话式查询。”",
        author: "ShopMesh 开发团队"
      }
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
      h1: "AI Collective プラットフォームでの構築",
      sub: "プログラマブルな AI 労働力のための高性能マルチエージェント編成プラットフォーム。アトミックなツール統合により、シーケンシャル、リング、メッシュ、またはスーパーバイザーのエージェントトポロジーを展開します。",
      cta1: "構築を始める",
      cta2: "開発者ドキュメントを見る"
    },
    started: {
      title: "開始方法を選択する",
      buildOwn: {
        title: "自身で展開する",
        sub: "以下を使用して、独自のカスタムマルチエージェント労働力を起動します：",
        bullets: [
          "シーケンシャル、リング、メッシュ、またはスーパーバイザーのエージェントトポロジー",
          "50以上の原子スキルツールキット（Google Workspace、ブラウザ自動化、ソーシャルメディア）",
          "自動トークン予算管理とコンテキストウィンドウの最適化",
          "柔軟なバックエンド：ローカル実行 (JSON) 或いは分散スケーリング (Docker/RabbitMQ)",
          "対話型ヒューマンインザループ（Human-in-the-Loop）ステアリング機能",
          "高度な spaCy および LLM ベースのナレッジグラフ抽出"
        ],
        cta: "構築を始める"
      },
      support: {
        title: "エンタープライズ展開",
        sub: "カスタムツール統合、Kubernetes サンドボックス、またはホスト型オーケストレーションが必要ですか？",
        bullets: [
          "エンタープライズオンボーディングとカスタムエージェントトポロジー設計",
          "SLA保証付きのカスタムAPIおよびデータベース統合",
          "管理された高スループットの RabbitMQ および Redis クラスタリング",
          "高度で安全なコード実行サンドボックス設定（Docker/K8s）",
          "24時間365日の専用エンジニアリングおよび展開サポート"
        ],
        cta: "営業に連絡"
      }
    },
    models: {
      title: "サポートされている LLM 基座",
      sub: "行业をリードするプロバイダー全体で、実行時に基座モデルエンジンを設定、交換、またはルーティングします。",
      batch: "完全に LLM 非依存：Google Gemini、Anthropic、OpenAI、或者 OpenRouter ゲートウェイ経由でルーティング。",
      activeModelLabel: "有効なモデル",
      capabilitiesHeader: "主な機能",
      list: [
        {
          name: "Google Gemini",
          desc: "デフォルトの速度エンジン。エンティティ抽出とリアルタイムのナレッジグラフに最適化されています。",
          modelKey: "gemini-2.0-flash",
          capabilities: [
            "自動化された spaCy および LLM ベースのエンティティ抽出",
            "リアルタイムのグラフ構築と状態コンテキストの読み込み",
            "エージェント討論ラウンドにおける高いトークン効率"
          ]
        },
        {
          name: "Anthropic Claude",
          desc: "マルチエージェントメッシュコーディネーターおよびコード生成用のプレミアロジックエンジン。",
          modelKey: "claude-3-5-sonnet",
          capabilities: [
            "トークンオーバーヘッドを削減する高度なプロンプトキャッシュ",
            "優れたツール選択とエージェント委任フロー",
            "構造化コード実行検証"
          ]
        },
        {
          name: "OpenAI GPT",
          desc: "構造化された JSON スキーマとツールバインディング用の信頼性の高い標準エンジン。",
          modelKey: "gpt-4o",
          capabilities: [
            "入力/出力に対する厳密な JSON スキーマの強制",
            "マルチエージェントリング討論のコンセンサスフォーマット",
            "幅広い外部 API 統合"
          ]
        },
        {
          name: "Open Weight (Qwen)",
          desc: "セルフホストまたはエアギャップされた安全なエージェントクラスター用の高パラメータオープンウェイトエンジン。",
          modelKey: "qwen3.5-397B-A17B",
          capabilities: [
            "データ漏洩ゼロのセルフホストオーケストレーション",
            "Docker サンドボックス内での Python コード実行用に微調整",
            "カスタムモデルプロバイダーおよびエンドポイントとの互换性"
          ]
        }
      ]
    },
    tools: {
      title: "エージェントメッシュ (Agent Mesh) の機能",
      sub: "AI Collective プラットフォームを駆動する高度なランタイムサービスを探索してください。",
      cta: "開発者ドキュメントを見る",
      list: [
        { name: "マルチエージェントトポロジー", desc: "シーケンシャルパイプライン、リング討論パターン、メッシュコーディネーターネットワーク、またはスーパーバイザー構造を編成します。" },
        { name: "50以上のスキルツールキット", desc: "エージェントに Google ドライブ/カレンダー、Playwright ウェブスクレイパー、ソーシャルフィード、生産性ツールを装備します。" },
        { name: "サブエージェント委任", desc: "メインエージェントが、厳密なターン制限を持つ並列サブエージェントを同時に生成して実行できるようにします。" },
        { name: "リアルタイム SSE ストリーミング", desc: "透明なイベントログ（agent_start、llm_request、subagent_complete）で実行プロセスをターンごとに追跡します。" },
        { name: "安全なサンドボックス実行", desc: "分離されたローカル、Docker、または Kubernetes サンドボックス環境内で Python/Bash コマンドを安全に実行します。" },
        { name: "ナレッジグラフメモリ", desc: "NLP (spaCy) または LLM を介して会話コンテキストを動的に抽出し、クエリ可能なセマンティックメモリを構築します。" },
        { name: "コンテキストとトークンバジェット", desc: "トークン制限に近づいたときに、コンテキストウィンドウを自動的にトリミングおよび最適化します。" },
        { name: "ヒューマンインザループ (Human-in-the-Loop)", desc: "進行中のマルチエージェントディスカッションに介入して、エージェントを指導したり手動タスク入力を提供したりします。" },
        { name: "マルチワークスペース分離", desc: "JWT 検証、Google OAuth、およびデータベース分離を使用して、安全なマルチテナントデータセグメンテーションを実現します。" }
      ]
    },
    console: {
      title: "AI Collective コンソール内でチームを管理",
      sub: "クリーンな FastAPI エンドポイントと対話型ダッシュボードを介して、強力なマルチエージェントチームを既存のアプリケーションスタックに統合します。",
      devTitle: "AI エンジニア向けに構築",
      desc: "労働力の監視、テスト、調整：",
      bullets: [
        "カスタムエージェントとツールをリアルタイムで作成、編集、設定",
        "エージェントの実行ステップ、トークンコストログ、メッセージ履歴を追跡",
        "マルチラウンド実行中にチームと直接対話"
      ]
    },
    usecases: {
      title: "現実世界のマルチエージェントユースケース",
      list: [
        {
          name: "金融討論",
          desc: "リングトポロジーの下で、リアルタイムの Brave 検索ツールを使用して市場指標を議論するアナリストチームを生成します。"
        },
        {
          name: "編集パイプライン",
          desc: "スーパーバイザーの指導の下、調査や起草から校正、フォーマットまでのコンテンツ作成を管理します。"
        },
        {
          name: "ソフトウェア監査",
          desc: "安全で隔離されたサンドボックス内でコードを実行およびテストする自動脆弱性スキャナーエージェントを実行します。"
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
      login: "ログイン",
      contactSales: "営業に連絡",
      startBuilding: "構築を始める",
      products: "製品",
      features: "機能",
      models: "モデル",
      useCases: "ユースケース",
      aiAgents: "AI エージェント",
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
      consoleLogin: "コンソールログイン",
      star: "スター"
    },
    testimonials: [
      {
        logo: "CODEMESH",
        text: "“AgentBenchにおいて、AI Collectiveのマルチエージェントメッシュアーキテクチャは、即時のレイテンシ改善とクリーンなオーケストレーションを私たちにもたらしました。”",
        author: "Marcus Vance, CEO"
      },
      {
        logo: "EVENTPASS",
        text: "“マルチエージェントワークフローのデプロイは簡単でした。LangGraphトポロジーオプション의 信頼性と柔軟性により、移行がシームレスに行われました。”",
        author: "Taylor Addison, 開発チーフオブスタッフ"
      },
      {
        logo: "SPARKAGENT",
        text: "“専用ツールキットと並行して安全なコード実行サンドボックスを実行する機能により、エージェントのパフォーマンスが大幅に向上しました。”",
        author: "SparkAgent コアチーム"
      },
      {
        logo: "SHOPMESH",
        text: "“AI Collectiveは、強力なヒューマンインザループのサポートにより、チケットのトリアージ、マルチステップのワークフロー、複雑な対話型クエリを処理します。”",
        author: "ShopMesh 開発チーム"
      }
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

export default function Landing() {
  const { stars } = useGitHubStats();
  const { language } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeMobileSection, setActiveMobileSection] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  const t = (LOCAL_COPY as Record<Language, typeof LOCAL_COPY.en>)[language] || LOCAL_COPY.en;

  // Reset active mobile accordion section when menu is closed
  useEffect(() => {
    if (!mobileMenuOpen) {
      setActiveMobileSection(null);
    }
  }, [mobileMenuOpen]);

  const toggleMobileSection = (section: string) => {
    setActiveMobileSection(activeMobileSection === section ? null : section);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-foreground font-sans relative overflow-x-hidden transition-colors duration-300">
      {/* Background Dots Grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02] dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)/.15) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--foreground)/.15) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Global Header */}
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            {/* Spider logo - original blue/green color */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <img 
                src="/spider.png" 
                alt="AI Collective Logo" 
                className="h-6 w-6 object-contain opacity-95" 
              />
            </div>
            <span className="font-serif text-lg tracking-tight font-medium text-foreground">AI Collective</span>
          </Link>

          {/* Right Side: Nav items + CTA Buttons */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium relative">
            <nav className="flex items-center gap-6 text-muted-foreground">

              {/* Meet Collective */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('meet')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap hover:text-foreground ${activeDropdown === 'meet' ? 'text-foreground' : ''}`}>
                  {t.header.meetCollective}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'meet' ? 'rotate-180 opacity-100' : 'opacity-60'}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'meet' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-[520px] bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl p-5 z-50"
                    >
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.products}</p>
                          <div className="space-y-2.5">
                            <Link to="/meet" className="block text-sm text-foreground hover:text-accent transition-colors font-medium">AI Collective</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Agent Mesh</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.features}</p>
                          <div className="space-y-2.5">
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.tools.list[0].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.tools.list[5].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.tools.list[4].name}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.models}</p>
                          <div className="space-y-2.5">
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[0].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[1].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[2].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[3].name}</Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Platform */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('platform')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer whitespace-nowrap font-semibold transition-colors ${activeDropdown === 'platform' ? 'text-foreground' : 'text-foreground'}`}>
                  {t.header.platform}
                  <ChevronDown className={`w-3.5 h-3.5 text-accent transition-transform duration-200 ${activeDropdown === 'platform' ? 'rotate-180' : ''}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'platform' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-52 bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl py-2 z-50"
                    >
                      <Link to="/" className="flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors">{t.header.overview}</Link>
                      <Link to="/docs" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <Link to="/pricing" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">{t.header.pricing}</Link>
                      <div className="my-1 border-t border-[#e8e6dc] dark:border-[#2e2e2d]" />
                      <Link to="/dashboard" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {t.header.consoleLogin} <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Solutions */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('solutions')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap hover:text-foreground ${activeDropdown === 'solutions' ? 'text-foreground' : ''}`}>
                  {t.header.solutions}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'solutions' ? 'rotate-180 opacity-100' : 'opacity-60'}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'solutions' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-[560px] bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl p-5 z-50"
                    >
                      <div className="grid grid-cols-4 gap-5">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.useCases}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.aiAgents}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.dataPipelines}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.codeReview}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.companySize}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.startups}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.enterprise}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.departments}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.engineering}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.research}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.industries}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.fintech}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.legal}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.healthcare}</Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pricing - no dropdown */}
              <Link to="/pricing" className="hover:text-foreground cursor-pointer transition-colors whitespace-nowrap">{t.header.pricing}</Link>

              {/* Resources */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('resources')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap hover:text-foreground ${activeDropdown === 'resources' ? 'text-foreground' : ''}`}>
                  {t.header.resources}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'resources' ? 'rotate-180 opacity-100' : 'opacity-60'}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'resources' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-48 bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl py-2 z-50"
                    >
                      <Link to="/resources" className="flex items-center px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 cursor-pointer transition-colors">{t.header.overview}</Link>
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        GitHub <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Link to="/docs" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <div className="my-1 border-t border-[#e8e6dc] dark:border-[#2e2e2d]" />
                      <Link to="/changelog" className="flex items-center px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors">{t.header.changelog}</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Divider */}
            <div className="h-4 w-px bg-[#e8e6dc]/80 dark:bg-[#2e2e2d]/60" />

            {/* CTA Group */}
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap text-sm">
                {t.header.login}
              </Link>
              <Link
                to="/contact-sales"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] hover:bg-muted/60 transition-colors whitespace-nowrap text-sm text-foreground"
              >
                {t.header.contactSales}
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap text-sm font-semibold"
              >
                {t.header.startBuilding}
              </Link>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-border md:hidden hover:bg-muted/50 text-foreground"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Secondary Header Platform Strip */}
        <div className="border-t border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-[#f6f5ee]/40 dark:bg-[#181817]/20 py-2">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[13px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="text-foreground font-semibold">{t.header.platform}</span>
              <div className="flex items-center gap-1 hover:text-foreground cursor-pointer font-medium">
                <span>{t.header.exploreHere}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center h-7 rounded-lg overflow-hidden border border-border/60 text-xs font-semibold hover:border-border transition-all group"
              >
                <span className="flex items-center gap-1.5 px-2.5 h-full bg-muted/60 hover:bg-muted transition-colors text-muted-foreground group-hover:text-foreground border-r border-border/60">
                  <GithubIcon className="w-3 h-3" />
                  {t.header.star}
                </span>
                <span className="flex items-center gap-1 px-2 h-full text-foreground font-bold">
                  {stars === null
                    ? <span className="w-6 h-2 rounded bg-muted animate-pulse" />
                    : <><Star className="w-3 h-3 text-accent" />{fmt(stars)}</>
                  }
                </span>
              </a>
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden absolute top-full left-0 right-0 border-b border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-background px-6 py-5 space-y-3 flex flex-col font-medium text-sm text-muted-foreground shadow-2xl z-50 max-h-[75vh] overflow-y-auto"
            >
              {/* Meet Collective */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("meet")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.meetCollective}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "meet" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "meet" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-4 py-2 mt-1"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.products}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground hover:text-accent transition-colors font-medium">AI Collective</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Agent Mesh</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.features}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.tools.list[0].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.tools.list[5].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.tools.list[4].name}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.models}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[0].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[1].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[2].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[3].name}</Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Platform */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("platform")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.platform}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "platform" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "platform" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-2 py-2 mt-1 flex flex-col"
                    >
                      <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground hover:text-accent transition-colors">{t.header.overview}</Link>
                      <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.pricing}</Link>
                      <div className="my-1 border-t border-[#e8e6dc]/40 dark:border-[#2e2e2d]/40" />
                      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        {t.header.consoleLogin} <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Solutions */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("solutions")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.solutions}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "solutions" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "solutions" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-4 py-2 mt-1"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.useCases}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.aiAgents}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.dataPipelines}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.codeReview}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.companySize}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.startups}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.enterprise}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.departments}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.engineering}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.research}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.industries}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.fintech}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.legal}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.healthcare}</Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pricing */}
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1.5 text-foreground hover:text-accent transition-colors"
              >
                {t.header.pricing}
              </Link>

              {/* Resources */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("resources")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.resources}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "resources" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "resources" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-2 py-2 mt-1 flex flex-col"
                    >
                      <Link to="/resources" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground hover:text-accent transition-colors">{t.header.overview}</Link>
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        GitHub <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <div className="my-1 border-t border-[#e8e6dc]/40 dark:border-[#2e2e2d]/40" />
                      <Link to="/changelog" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.changelog}</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <hr className="border-[#e8e6dc] dark:border-[#2e2e2d]" />
              
              <div className="flex flex-col gap-3 pt-1">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-accent transition-colors py-1">
                  {t.header.login}
                </Link>
                <Link
                  to="/contact-sales"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center h-10 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] hover:bg-muted/60 transition-colors text-foreground"
                >
                  {t.header.contactSales}
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center h-10 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] hover:opacity-90 transition-opacity font-semibold shadow-sm"
                >
                  {t.header.startBuilding}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 1. Left-aligned Hero Section with Vector Illustration on the right */}
      <section className="pt-24 pb-20 px-6 relative max-w-7xl mx-auto">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.035),transparent_70%)]" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-center">
          <div className="lg:col-span-6 text-left space-y-6">
            <FadeIn>
              <h1 className="text-5xl md:text-[68px] font-medium tracking-tight leading-[1.05] text-foreground font-serif">
                {t.hero.h1}
              </h1>
            </FadeIn>

            <FadeIn delay={0.08}>
              <p className="text-lg text-[#6b6960] dark:text-[#a3a197] leading-relaxed max-w-xl">
                {t.hero.sub}
              </p>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
                >
                  {t.hero.cta1}
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] bg-transparent text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all shadow-xs"
                >
                  {t.hero.cta2}
                </Link>
              </div>
            </FadeIn>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <FadeIn delay={0.1}>
              {/* Balanced Dynamic Spiderweb Multi-Agent Mesh with Descending Spider */}
              <div className="relative w-full max-w-[500px] aspect-square flex items-center justify-center bg-transparent">
                <svg viewBox="0 0 400 400" className="w-full h-full text-foreground" fill="none">
                  <style>{`
                    @keyframes spiderAdventure {
                      0% {
                        transform: translate(0px, -210px) rotate(0deg);
                      }
                      10% {
                        transform: translate(0px, 0px) rotate(0deg);
                      }
                      14% {
                        transform: translate(0px, -48px) rotate(0deg);
                      }
                      16% {
                        transform: translate(0px, -48px) rotate(125deg);
                      }
                      19% {
                        transform: translate(52px, -12px) rotate(125deg);
                      }
                      20% {
                        transform: translate(52px, -12px) rotate(200deg);
                      }
                      23% {
                        transform: translate(32px, 40px) rotate(200deg);
                      }
                      24% {
                        transform: translate(32px, 40px) rotate(270deg);
                      }
                      27% {
                        transform: translate(-32px, 40px) rotate(270deg);
                      }
                      28% {
                        transform: translate(-32px, 40px) rotate(340deg);
                      }
                      31% {
                        transform: translate(-52px, -12px) rotate(340deg);
                      }
                      32% {
                        transform: translate(-52px, -12px) rotate(415deg);
                      }
                      34% {
                        transform: translate(0px, -48px) rotate(415deg);
                      }
                      34.5% {
                        transform: translate(0px, -48px) rotate(0deg);
                      }
                      36.5% {
                        transform: translate(0px, -84px) rotate(0deg);
                      }
                      37.5% {
                        transform: translate(0px, -84px) rotate(125deg);
                      }
                      41.5% {
                        transform: translate(91px, -21px) rotate(125deg);
                      }
                      42.5% {
                        transform: translate(91px, -21px) rotate(200deg);
                      }
                      46.5% {
                        transform: translate(56px, 70px) rotate(200deg);
                      }
                      47.5% {
                        transform: translate(56px, 70px) rotate(270deg);
                      }
                      51.5% {
                        transform: translate(-56px, 70px) rotate(270deg);
                      }
                      52.5% {
                        transform: translate(-56px, 70px) rotate(340deg);
                      }
                      56.5% {
                        transform: translate(-91px, -21px) rotate(340deg);
                      }
                      57.5% {
                        transform: translate(-91px, -21px) rotate(415deg);
                      }
                      59.5% {
                        transform: translate(0px, -84px) rotate(415deg);
                      }
                      60% {
                        transform: translate(0px, -84px) rotate(0deg);
                      }
                      62% {
                        transform: translate(0px, -120px) rotate(0deg);
                      }
                      63% {
                        transform: translate(0px, -120px) rotate(125deg);
                      }
                      67% {
                        transform: translate(130px, -30px) rotate(125deg);
                      }
                      68% {
                        transform: translate(130px, -30px) rotate(200deg);
                      }
                      72% {
                        transform: translate(80px, 100px) rotate(200deg);
                      }
                      73% {
                        transform: translate(80px, 100px) rotate(270deg);
                      }
                      77% {
                        transform: translate(-80px, 100px) rotate(270deg);
                      }
                      78% {
                        transform: translate(-80px, 100px) rotate(340deg);
                      }
                      82% {
                        transform: translate(-130px, -30px) rotate(340deg);
                      }
                      83% {
                        transform: translate(-130px, -30px) rotate(415deg);
                      }
                      85% {
                        transform: translate(0px, -120px) rotate(415deg);
                      }
                      86% {
                        transform: translate(0px, -120px) rotate(180deg);
                      }
                      89% {
                        transform: translate(0px, -50px) rotate(180deg);
                      }
                      90% {
                        transform: translate(0px, -50px) rotate(0deg);
                      }
                      100% {
                        transform: translate(0px, -50px) rotate(0deg);
                      }
                    }
                    @keyframes threadScale {
                      0% {
                        transform: scaleY(0);
                      }
                      10% {
                        transform: scaleY(1);
                      }
                      85% {
                        transform: scaleY(1);
                      }
                      89% {
                        transform: scaleY(0.76);
                      }
                      100% {
                        transform: scaleY(0.76);
                      }
                    }
                    @keyframes drawSpoke {
                      0% {
                        stroke-dashoffset: 140;
                        opacity: 0.1;
                      }
                      10%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 0.35;
                      }
                      98%, 100% {
                        stroke-dashoffset: 140;
                        opacity: 0.1;
                      }
                    }
                    @keyframes drawInner {
                      0%, 16% {
                        stroke-dashoffset: 302;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                      16.1% {
                        stroke-dashoffset: 302;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      34%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      98%, 100% {
                        stroke-dashoffset: 302;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                    }
                    @keyframes drawMiddle {
                      0%, 37.5% {
                        stroke-dashoffset: 529;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                      37.6% {
                        stroke-dashoffset: 529;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      59.5%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      98%, 100% {
                        stroke-dashoffset: 529;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                    }
                    @keyframes drawOuter {
                      0%, 63% {
                        stroke-dashoffset: 754;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                      63.1% {
                        stroke-dashoffset: 754;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      85%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      98%, 100% {
                        stroke-dashoffset: 754;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                    }
                    @keyframes pulseGlow {
                      0%, 100% {
                        opacity: 0.3;
                        transform: scale(1);
                      }
                      50% {
                        opacity: 0.6;
                        transform: scale(1.06);
                      }
                    }
                    .spider-group {
                      animation: spiderAdventure 36s linear infinite;
                      transform-origin: 0px 0px;
                    }
                    .spider-thread {
                      animation: threadScale 36s linear infinite;
                      transform-origin: 200px 0px;
                    }
                    .pulse-circle {
                      animation: pulseGlow 4s ease-in-out infinite;
                      transform-origin: center;
                    }
                    .spoke-line {
                      stroke-dasharray: 140;
                      animation: drawSpoke 36s linear infinite;
                    }
                    .ring-inner {
                      stroke-dasharray: 302;
                      animation: drawInner 36s linear infinite;
                    }
                    .ring-middle {
                      stroke-dasharray: 529;
                      animation: drawMiddle 36s linear infinite;
                    }
                    .ring-outer {
                      stroke-dasharray: 754;
                      animation: drawOuter 36s linear infinite;
                    }
                    .agent-text {
                      font-family: var(--font-mono, monospace);
                      font-weight: 700;
                      font-size: 13.5px;
                      fill: currentColor !important;
                      letter-spacing: 0.05em;
                    }
                    /* --- SPIDER ALTERNATING TETRAPOD GAIT ---
                       Group A (swing phase 0  ): L1, L3, R2, R4
                       Group B (swing phase 0.5): L2, L4, R1, R3
                       Each leg: sweeps forward (lift) → plants → pushes back → lifts again
                    */
                    @keyframes legStrideA {
                      0%   { transform: rotate(-18deg) scaleY(0.90); }
                      15%  { transform: rotate(-18deg) scaleY(1.08); }
                      45%  { transform: rotate( 16deg) scaleY(0.96); }
                      50%  { transform: rotate( 18deg) scaleY(0.90); }
                      65%  { transform: rotate( 18deg) scaleY(1.06); }
                      95%  { transform: rotate(-16deg) scaleY(0.96); }
                      100% { transform: rotate(-18deg) scaleY(0.90); }
                    }
                    @keyframes legStrideB {
                      0%   { transform: rotate( 18deg) scaleY(0.90); }
                      15%  { transform: rotate( 18deg) scaleY(1.06); }
                      45%  { transform: rotate(-16deg) scaleY(0.96); }
                      50%  { transform: rotate(-18deg) scaleY(0.90); }
                      65%  { transform: rotate(-18deg) scaleY(1.08); }
                      95%  { transform: rotate( 16deg) scaleY(0.96); }
                      100% { transform: rotate( 18deg) scaleY(0.90); }
                    }
                    /* Front legs sweep wider; back legs push harder */
                    @keyframes legStrideFront {
                      0%   { transform: rotate(-22deg) scaleY(0.88); }
                      15%  { transform: rotate(-22deg) scaleY(1.10); }
                      45%  { transform: rotate( 18deg) scaleY(0.95); }
                      50%  { transform: rotate( 22deg) scaleY(0.88); }
                      65%  { transform: rotate( 22deg) scaleY(1.08); }
                      95%  { transform: rotate(-18deg) scaleY(0.95); }
                      100% { transform: rotate(-22deg) scaleY(0.88); }
                    }
                    @keyframes legStrideFrontB {
                      0%   { transform: rotate( 22deg) scaleY(0.88); }
                      15%  { transform: rotate( 22deg) scaleY(1.08); }
                      45%  { transform: rotate(-18deg) scaleY(0.95); }
                      50%  { transform: rotate(-22deg) scaleY(0.88); }
                      65%  { transform: rotate(-22deg) scaleY(1.10); }
                      95%  { transform: rotate( 18deg) scaleY(0.95); }
                      100% { transform: rotate( 22deg) scaleY(0.88); }
                    }
                    @keyframes palpReach {
                      0%, 100% { transform: rotate(-10deg) scaleY(0.92); }
                      50%      { transform: rotate( 10deg) scaleY(1.05); }
                    }
                    /* Group A — phase 0 */
                    .leg-l1 {
                      animation: legStrideFront 0.72s ease-in-out infinite 0s;
                      transform-origin: -3px -4px;
                    }
                    .leg-l3 {
                      animation: legStrideA 0.72s ease-in-out infinite 0s;
                      transform-origin: -4px 2px;
                    }
                    .leg-r2 {
                      animation: legStrideA 0.72s ease-in-out infinite 0s;
                      transform-origin: 4px -1px;
                    }
                    .leg-r4 {
                      animation: legStrideA 0.72s ease-in-out infinite 0s;
                      transform-origin: 3px 5px;
                    }
                    /* Group B — phase 0.36s (half of 0.72s) */
                    .leg-l2 {
                      animation: legStrideB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: -4px -1px;
                    }
                    .leg-l4 {
                      animation: legStrideB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: -3px 5px;
                    }
                    .leg-r1 {
                      animation: legStrideFrontB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: 3px -4px;
                    }
                    .leg-r3 {
                      animation: legStrideB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: 4px 2px;
                    }
                    /* Pedipalps — alternating reach */
                    .palp-l {
                      animation: palpReach 0.72s ease-in-out infinite 0s;
                      transform-origin: -1.5px -8px;
                    }
                    .palp-r {
                      animation: palpReach 0.72s ease-in-out infinite 0.36s;
                      transform-origin: 1.5px -8px;
                    }
                  `}</style>

                  {/* Soft accent gradient backgrounds for shapes */}
                  <defs>
                    <radialGradient id="tealGradCenter" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.5)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.0)" />
                    </radialGradient>
                    <radialGradient id="tealGradNode" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.65)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.1)" />
                    </radialGradient>
                    <linearGradient id="spiderThreadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.1)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.8)" />
                    </linearGradient>
                  </defs>

                  {/* Large Center Glow */}
                  <circle cx="200" cy="200" r="140" fill="url(#tealGradCenter)" className="pulse-circle" />

                  {/* Glowing Node Backgrounds */}
                  <g className="pulse-circle">
                    <circle cx="200" cy="90" r="30" fill="url(#tealGradNode)" />
                    <circle cx="330" cy="180" r="30" fill="url(#tealGradNode)" />
                    <circle cx="280" cy="310" r="30" fill="url(#tealGradNode)" />
                    <circle cx="120" cy="310" r="30" fill="url(#tealGradNode)" />
                    <circle cx="70" cy="180" r="30" fill="url(#tealGradNode)" />
                  </g>

                  {/* Spiderweb Structural Grid */}
                  <g>
                    {/* Radial spokes extending from center (200, 210) to nodes */}
                    <line x1="200" y1="210" x2="200" y2="90" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="330" y2="180" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="280" y2="310" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="120" y2="310" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="70" y2="180" stroke="currentColor" strokeWidth="1" className="spoke-line" />

                    {/* Concentric Spiderweb Rings (Straight pentagon styles) */}
                    <path
                      d="M 200 162 L 252 198 L 232 250 L 168 250 L 148 198 Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                      className="ring-inner"
                    />
                    <path
                      d="M 200 126 L 291 189 L 256 280 L 144 280 L 109 189 Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                      className="ring-middle"
                    />
                    <path
                      d="M 200 90 L 330 180 L 280 310 L 120 310 L 70 180 Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      className="ring-outer"
                    />
                  </g>

                  {/* Extra cross-mesh shortcuts to represent mesh orchestrator topology */}
                  <g opacity="0.4">
                    <line x1="200" y1="90" x2="280" y2="310" stroke="currentColor" strokeWidth="1" strokeDasharray="3,6" />
                    <line x1="330" y1="180" x2="120" y2="310" stroke="currentColor" strokeWidth="1" strokeDasharray="3,6" />
                    <line x1="70" y1="180" x2="280" y2="310" stroke="currentColor" strokeWidth="1" strokeDasharray="3,6" />
                  </g>

                  {/* Agent Mesh Nodes */}
                  
                  {/* 1. Supervisor Agent */}
                  <g className="cursor-pointer">
                    <circle cx="200" cy="90" r="10" fill="currentColor" />
                    <circle cx="200" cy="90" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="200" y="62" textAnchor="middle" className="agent-text">
                      SUPERVISOR
                    </text>
                  </g>

                  {/* 2. Coder Agent */}
                  <g className="cursor-pointer">
                    <circle cx="330" cy="180" r="8" fill="currentColor" />
                    <circle cx="330" cy="180" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="355" y="184" textAnchor="start" className="agent-text">
                      CODER
                    </text>
                  </g>

                  {/* 3. Search Agent */}
                  <g className="cursor-pointer">
                    <circle cx="280" cy="310" r="8" fill="currentColor" />
                    <circle cx="280" cy="310" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="280" y="342" textAnchor="middle" className="agent-text">
                      SEARCH
                    </text>
                  </g>

                  {/* 4. Writer Agent */}
                  <g className="cursor-pointer">
                    <circle cx="120" cy="310" r="8" fill="currentColor" />
                    <circle cx="120" cy="310" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="120" y="342" textAnchor="middle" className="agent-text">
                      WRITER
                    </text>
                  </g>

                  {/* 5. Browser Agent */}
                  <g className="cursor-pointer">
                    <circle cx="70" cy="180" r="8" fill="currentColor" />
                    <circle cx="70" cy="180" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="45" y="184" textAnchor="end" className="agent-text">
                      BROWSER
                    </text>
                  </g>

                  {/* Center Node (representing the core orchestrator mesh hub) */}
                  <g>
                    <circle cx="200" cy="210" r="6" fill="currentColor" className="text-accent" />
                    <circle cx="200" cy="210" r="12" stroke="currentColor" strokeWidth="1" className="text-accent" opacity="0.5" />
                  </g>

                  {/* Glowing silk thread descending from the top, reaching near the center */}
                  <line x1="200" y1="0" x2="200" y2="210" stroke="url(#spiderThreadGrad)" strokeWidth="1.5" className="spider-thread" />

                  {/* Spider Group (Centered around the outer web-center translate container) */}
                  <g transform="translate(200, 210)">
                    <g className="spider-group">
                      {/* Legs (8 legs) */}
                      {/* Left legs */}
                      <path d="M -3 -4 Q -12 -9 -14 -2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l1" />
                      <path d="M -4 -1 Q -15 -3 -16 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l2" />
                      <path d="M -4 2 Q -15 5 -13 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l3" />
                      <path d="M -4 5 Q -11 11 -8 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l4" />

                      {/* Right legs */}
                      <path d="M 3 -4 Q 12 -9 14 -2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r1" />
                      <path d="M 4 -1 Q 15 -3 16 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r2" />
                      <path d="M 4 2 Q 15 5 13 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r3" />
                      <path d="M 3 5 Q 11 11 8 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r4" />

                      {/* Pedipalps (front feelers) */}
                      <path d="M -1.5 -8 Q -3.5 -11 -2 -13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" className="palp-l" />
                      <path d="M 1.5 -8 Q 3.5 -11 2 -13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" className="palp-r" />

                      {/* Head (Cephalothorax) */}
                      <circle cx="0" cy="-4" r="4.5" fill="currentColor" />

                      {/* Abdomen */}
                      <ellipse cx="0" cy="4" rx="6" ry="7.5" fill="currentColor" />
                      
                      {/* Accent color dot on the back */}
                      <circle cx="0" cy="3" r="2" fill="hsl(var(--accent))" />
                    </g>
                  </g>
                </svg>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 2. Client Testimonials Row Section */}
      <section className="px-6 pb-24 max-w-7xl mx-auto border-t border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 pt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-10 divide-y md:divide-y-0 md:divide-x divide-[#e8e6dc]/80 dark:divide-[#2e2e2d]/60">
          {t.testimonials.map((c, idx) => (
            <FadeIn 
              key={idx} 
              delay={idx * 0.06}
              className={`flex flex-col h-full space-y-4 ${idx > 0 ? 'lg:pl-8' : ''} ${idx === 1 || idx === 3 ? 'md:pl-8' : ''}`}
            >
              {/* Simulated clean brand logo text */}
              <div className="font-sans font-black text-[#141413] dark:text-[#faf9f5] text-base tracking-widest uppercase">
                {c.logo}
              </div>
              <p className="text-sm text-[#6b6960] dark:text-[#a3a197] leading-relaxed flex-1 italic">
                {c.text}
              </p>
              <div className="text-xs font-semibold text-foreground">
                {c.author}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* 3. Choose How to Get Started */}
      <section className="px-6 py-20 bg-muted/15 border-y border-border/40">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="mb-12 text-center">
            <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif">
              {t.started.title}
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Build on your own */}
            <FadeIn delay={0.05} className="h-full">
              <div className="bg-card border border-border/70 rounded-2xl p-8 flex flex-col h-full hover:border-accent/40 transition-colors shadow-sm">
                <h3 className="text-xl font-medium text-foreground mb-3 font-serif">{t.started.buildOwn.title}</h3>
                <p className="text-sm text-muted-foreground mb-6">{t.started.buildOwn.sub}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {t.started.buildOwn.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard"
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow"
                >
                  {t.started.buildOwn.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            {/* Support */}
            <FadeIn delay={0.1} className="h-full">
              <div className="bg-card border border-border/70 rounded-2xl p-8 flex flex-col h-full hover:border-accent/40 transition-colors shadow-sm">
                <h3 className="text-xl font-medium text-foreground mb-3 font-serif">{t.started.support.title}</h3>
                <p className="text-sm text-muted-foreground mb-6">{t.started.support.sub}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {t.started.support.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 border border-border/40 transition-all shadow-sm"
                >
                  {t.started.support.cta}
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 4. Claude Models Section */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <FadeIn className="mb-12">
          <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif mb-3">
            {t.models.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm sm:text-base">
            {t.models.sub}
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {t.models.list.map((m, idx) => (
            <FadeIn key={idx} delay={idx * 0.05} className="h-full">
              <div className="bg-card border border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 rounded-2xl p-6 flex flex-col h-full shadow-sm hover:border-border transition-all">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-foreground font-serif mb-1.5">{m.name}</h3>
                  <div className="inline-flex">
                    <span className="font-mono text-[10px] font-medium text-accent bg-accent/5 border border-accent/15 px-2.5 py-1 rounded leading-none">
                      {m.modelKey}
                    </span>
                  </div>
                </div>
                <div className="h-[72px] flex items-start mb-4 overflow-hidden">
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
                <div className="border-t border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 pt-4 flex-1">
                  <span className="block text-[11px] font-semibold text-foreground/70 mb-2">{t.models.capabilitiesHeader}</span>
                  <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 leading-relaxed">
                    {m.capabilities.map((cap, cidx) => (
                      <li key={cidx}>{cap}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <div className="bg-accent/5 border border-accent/15 rounded-xl px-4 py-3 text-xs text-accent flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{t.models.batch}</span>
          </div>
        </FadeIn>
      </section>

      {/* 5. Do more with built-in tools */}
      <section className="px-6 py-20 bg-muted/10 border-t border-border/40">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif mb-2">
                {t.tools.title}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl">
                {t.tools.sub}
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground border border-border/40 hover:bg-secondary/80 text-xs font-semibold transition-all shadow-sm"
            >
              {t.tools.cta}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.tools.list.map((tool, idx) => (
              <FadeIn key={idx} delay={idx * 0.03} className="h-full">
                <div className="bg-card border border-border/60 rounded-xl p-5 h-full hover:border-accent/30 hover:shadow-sm transition-all duration-200">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 font-serif">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {tool.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Claude Console section */}
      <section className="px-6 py-24 max-w-5xl mx-auto border-t border-border/40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary font-semibold mb-6">
              <Bot className="w-3.5 h-3.5" />
              {t.console.devTitle}
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground font-serif leading-tight mb-4">
              {t.console.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-8">
              {t.console.sub}
            </p>
            <div className="space-y-4 border-l-2 border-accent/40 pl-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider block">{t.console.desc}</span>
              <ul className="space-y-3">
                {t.console.bullets.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            {/* Console Workbench Simulator */}
            <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl text-xs font-mono text-zinc-400">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-[10px] text-zinc-500">AI Collective Console · Mesh Workbench</span>
                </div>
                <div className="px-2 py-0.5 rounded bg-white/5 text-[9px] text-zinc-500">v0.2.6</div>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center justify-between">
                    <span>Task Objective</span>
                    <span className="text-accent text-[9px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/25">Supervisor Mode</span>
                  </div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 text-zinc-300">
                    Analyze user auth logic, execute vulnerability tests in sandbox, and patch SQL injection vectors.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Active Agent Team</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-zinc-500 font-semibold block text-[8px] uppercase">Lead</span>
                      <span className="text-zinc-300 font-medium">Orchestrator</span>
                    </div>
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-zinc-500 font-semibold block text-[8px] uppercase">Sandbox Exec</span>
                      <span className="text-zinc-300 font-medium">Coder Agent</span>
                    </div>
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-accent font-semibold block text-[8px] uppercase">Human-In-Loop</span>
                      <span className="text-zinc-300 font-medium">Auditor Agent</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Real-Time Streaming Events</div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 space-y-2 text-[10px]">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-semibold uppercase text-[8px] mt-0.5 px-1 rounded bg-emerald-500/10 border border-emerald-500/20">SSE</span>
                      <span className="text-zinc-400">Event: <span className="text-zinc-300">agent_turn_start</span> ➔ Coder Agent</span>
                    </div>
                    <div className="flex items-start gap-2 pl-4 border-l border-zinc-800">
                      <span className="text-zinc-500 mt-0.5">&gt;</span>
                      <span className="text-zinc-500 italic">Spawning Docker Sandbox. Executing target code...</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-semibold uppercase text-[8px] mt-0.5 px-1 rounded bg-emerald-500/10 border border-emerald-500/20">SSE</span>
                      <span className="text-zinc-400">Event: <span className="text-zinc-300">turn_complete</span> ➔ Patch written to db.py.</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-zinc-500 text-[10px]">Routed via Gemini 2.0 + Claude 3.5</div>
                  <button className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-white font-semibold text-[11px] hover:bg-accent/80 transition-colors">
                    <Play className="w-3 h-3 fill-current" />
                    Run Orchestrator
                  </button>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 7. Use cases for Claude */}
      <section className="px-6 py-20 bg-muted/15 border-y border-border/40">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="mb-12">
            <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif">
              {t.usecases.title}
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.usecases.list.map((uc, idx) => (
              <FadeIn key={idx} delay={idx * 0.05} className="h-full">
                <div className="flex flex-col h-full">
                  <h3 className="text-base font-semibold text-foreground mb-2 font-serif flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {uc.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{uc.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Footer start building cta */}
      <section className="bg-zinc-950 text-white py-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_top_right,rgba(217,119,87,0.06),transparent_60%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight font-serif text-white mb-6">
              {t.footer.ctaTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors shadow animate-pulse"
              >
                {t.hero.cta1}
                <ArrowRight className="w-4 h-4 text-zinc-950" />
              </Link>
              <Link
                to="/contact-sales"
                className="inline-flex items-center gap-2 h-10 px-6 rounded-lg border border-white/20 bg-transparent text-white font-medium text-sm hover:bg-white/5 transition-colors"
              >
                {t.header.contactSales}
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white font-serif mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent" />
                  {t.footer.newsTitle}
                </h3>
                <p className="text-xs text-zinc-400">{t.footer.newsSub}</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t.footer.newsPlaceholder}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 text-xs focus:outline-none focus:border-accent text-white"
                />
                <button className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/80 transition-colors shadow-sm">
                  {t.footer.newsButton}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">{t.footer.newsDisclaimer}</p>
            </div>
          </FadeIn>
        </div>

        {/* Global Sitemap Columns */}
        <div className="max-w-5xl mx-auto mt-20 pt-16 border-t border-white/5 grid grid-cols-2 md:grid-cols-5 gap-8 text-xs text-zinc-400">
          <div className="col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2 text-white">
              <img src="/spider.png" alt="" className="h-5 w-5 object-contain opacity-90" />
              <span className="font-serif text-sm tracking-tight font-medium">AI Collective</span>
            </Link>
            <p className="text-[10px] text-zinc-600 leading-normal max-w-xs">
              © {new Date().getFullYear()} AI Collective. {t.footerSitemap.rights}
            </p>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">{t.footerSitemap.products}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.orchestrator}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.pricing}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.documentation}</span>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">{t.footerSitemap.solutions}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.enterprise}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.education}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.financial}</span>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">{t.footerSitemap.company}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.aboutUs}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.careers}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.press}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
