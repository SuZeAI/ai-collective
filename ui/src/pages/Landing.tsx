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

const PROVIDER_LOGOS = {
  gemini: {
    color: "#8E75B2",
    path: "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
  },
  anthropic: {
    color: "#191919",
    mono: true,
    path: "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z",
  },
  openai: {
    color: "#000000",
    mono: true,
    path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
  },
  deepseek: {
    color: "#5786FE",
    path: "M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45",
  },
  kimi: {
    color: "#000000",
    mono: true,
    path: "M21.765.351C22.998.351 24 1.353 24 2.586S22.998 4.82 21.765 4.82h-1.974c-.15 0-.26-.12-.26-.26V2.586A2.237 2.237 0 0 1 21.765.35M9.41 13.388l8.447-8.377c.16-.16.07-.471-.14-.471h-4.55s-.1.02-.14.06l-9.099 9.029c-.14.14-.35.02-.35-.21V4.81c0-.15-.1-.27-.221-.27H.22c-.12 0-.22.12-.22.27v18.57c0 .15.1.27.22.27h3.137c.12 0 .22-.12.22-.27v-3.79c0-.08.03-.16.08-.21l2.826-2.796c.07-.07.16-.08.241-.03l7.546 5.551a8.9 8.9 0 0 0 4.018 1.493c.12.01.23-.11.23-.27V19.76c0-.14-.08-.25-.19-.26a5.8 5.8 0 0 1-2.355-.942l-6.533-4.73c-.14-.09-.15-.32-.03-.441",
  },
  openrouter: {
    color: "#94A3B8",
    path: "M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z",
  },
} as const satisfies Record<string, { color: string; path: string; mono?: boolean }>;

type ProviderLogoKey = keyof typeof PROVIDER_LOGOS;

function ProviderIcon({ slug, className }: { slug: ProviderLogoKey; className?: string }) {
  const logo = PROVIDER_LOGOS[slug];
  return (
    <svg
      viewBox="0 0 24 24"
      fill={logo.color}
      className={`${className ?? ""} ${"mono" in logo && logo.mono ? "dark:invert" : ""}`}
    >
      <path d={logo.path} />
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
      login: "Login",
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
      consoleLogin: "Dashboard login",
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
      login: "Đăng nhập",
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
      consoleLogin: "Đăng nhập Dashboard",
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
      login: "登录",
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
      consoleLogin: "Dashboard 登录",
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
      login: "ログイン",
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
      consoleLogin: "Dashboard ログイン",
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
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Mesh</Link>
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
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.aiStaff}</Link>
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
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Mesh</Link>
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
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.aiStaff}</Link>
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
              {/* Balanced Dynamic Spiderweb Multi-Staff Mesh with Descending Spider */}
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
                    .staff-text {
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

                  {/* Staff Mesh Nodes */}

                  {/* 1. Company node */}
                  <g className="cursor-pointer">
                    <circle cx="200" cy="90" r="10" fill="currentColor" />
                    <circle cx="200" cy="90" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="200" y="62" textAnchor="middle" className="staff-text">
                      COMPANY
                    </text>
                  </g>

                  {/* 2. Project node */}
                  <g className="cursor-pointer">
                    <circle cx="330" cy="180" r="8" fill="currentColor" />
                    <circle cx="330" cy="180" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="355" y="184" textAnchor="start" className="staff-text">
                      STAFF
                    </text>
                  </g>

                  {/* 3. Department node */}
                  <g className="cursor-pointer">
                    <circle cx="280" cy="310" r="8" fill="currentColor" />
                    <circle cx="280" cy="310" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="280" y="342" textAnchor="middle" className="staff-text">
                      DEPARTMENT
                    </text>
                  </g>

                  {/* 4. Staff node */}
                  <g className="cursor-pointer">
                    <circle cx="120" cy="310" r="8" fill="currentColor" />
                    <circle cx="120" cy="310" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="120" y="342" textAnchor="middle" className="staff-text">
                      PROJECT
                    </text>
                  </g>

                  {/* 5. Skill node */}
                  <g className="cursor-pointer">
                    <circle cx="70" cy="180" r="8" fill="currentColor" />
                    <circle cx="70" cy="180" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="45" y="184" textAnchor="end" className="staff-text">
                      SKILL
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

      {/* 2. Real Platform Capabilities Marquee */}
      <style>{`
        @keyframes landingMarquee {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .landing-marquee-track {
          animation: landingMarquee 18s linear infinite;
        }
        .landing-marquee-track:hover {
          animation-play-state: paused;
        }
        .landing-marquee-mask {
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-6 overflow-hidden landing-marquee-mask">
          <div className="flex w-max gap-10 landing-marquee-track">
            {[...t.highlights, ...t.highlights].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 shrink-0 text-sm text-muted-foreground whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Choose How to Get Started */}
      <section className="px-6 py-20 bg-muted/15">
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
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/5 border border-accent/15 text-xs text-accent font-semibold mb-4 w-fit">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.started.support.comingSoonBadge}
                </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {t.models.list.map((m, idx) => (
            <FadeIn key={idx} delay={idx * 0.05} className="h-full">
              <div className="bg-card border border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 rounded-2xl p-6 flex flex-col h-full shadow-sm hover:border-border transition-all">
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                    style={{ backgroundColor: `${PROVIDER_LOGOS[m.icon as ProviderLogoKey].color}1A` }}
                  >
                    <ProviderIcon slug={m.icon as ProviderLogoKey} className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-semibold text-foreground font-serif">{m.name}</h3>
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
      <section className="px-6 py-20 bg-muted/10">
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

      {/* 6. Dashboard preview section */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
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
                  <span className="ml-2 text-[10px] text-zinc-500">AI Collective Dashboard · Mesh Workbench</span>
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
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Active Staff Department</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-zinc-500 font-semibold block text-[8px] uppercase">Lead</span>
                      <span className="text-zinc-300 font-medium">Orchestrator</span>
                    </div>
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-zinc-500 font-semibold block text-[8px] uppercase">Sandbox Exec</span>
                      <span className="text-zinc-300 font-medium">Coder Staff</span>
                    </div>
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-accent font-semibold block text-[8px] uppercase">Human-In-Loop</span>
                      <span className="text-zinc-300 font-medium">Auditor Staff</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Real-Time Streaming Events</div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 space-y-2 text-[10px]">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-semibold uppercase text-[8px] mt-0.5 px-1 rounded bg-emerald-500/10 border border-emerald-500/20">SSE</span>
                      <span className="text-zinc-400">Event: <span className="text-zinc-300">staff_turn_start</span> ➔ Coder Staff</span>
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
      <section className="px-6 py-20 bg-muted/15">
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
