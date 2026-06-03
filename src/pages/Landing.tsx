import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ArrowRight, Star, ChevronRight, Bot, Check, Globe, HelpCircle,
  Menu, X, ChevronDown, Play, BookOpen, Users, Code, Sparkles,
  Search, Cpu, Layers, History, Zap, FileText, Database,
  ExternalLink, Settings, Shield, Mail, ArrowUpRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

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
      sub: "Use our API to create new user experiences, products, and ways to work with the most advanced AI models on the market.",
      cta1: "Start building",
      cta2: "See developer docs"
    },
    started: {
      title: "Choose how to get started",
      buildOwn: {
        title: "Build on your own",
        sub: "Launch your own generative AI solution with:",
        bullets: [
          "Access to all AI Collective models",
          "Usage-based tiers",
          "Automatically increasing rate limits",
          "Simple pay-as-you-go pricing",
          "Self-serve deployment on workbench",
          "Prompting guides and developer docs"
        ],
        cta: "Start building"
      },
      support: {
        title: "Get extra support",
        sub: "Need custom rate limits or hands-on help? Contact our sales team for:",
        bullets: [
          "Anthropic-supported onboarding",
          "Custom rate limits",
          "Billing via monthly invoices",
          "Prompting support",
          "Deployment support"
        ],
        cta: "Contact sales"
      }
    },
    models: {
      title: "AI Collective models",
      sub: "Right-sized for any task, our models offer the best combination of speed and performance.",
      batch: "Save 50% with batch processing. Learn more",
      list: [
        {
          name: "Opus 4.8",
          desc: "Most intelligent model for agents and coding",
          input: "$5 / MTok",
          output: "$25 / MTok",
          caching: "Write $6.25 / MTok · Read $0.50 / MTok"
        },
        {
          name: "Sonnet 4.6",
          desc: "Optimal balance of intelligence, cost, and speed",
          input: "$3 / MTok",
          output: "$15 / MTok",
          caching: "Write $3.75 / MTok · Read $0.30 / MTok"
        },
        {
          name: "Haiku 4.5",
          desc: "Fastest, most cost-effective model",
          input: "$1 / MTok",
          output: "$5 / MTok",
          caching: "Write $1.25 / MTok · Read $0.10 / MTok"
        }
      ]
    },
    tools: {
      title: "Do more with built-in tools",
      sub: "Explore AI Collective's advanced features and capabilities.",
      cta: "See developer docs",
      list: [
        { name: "Claude Managed Agents", desc: "A suite of composable APIs for building and deploying agents at scale." },
        { name: "Prompt caching", desc: "Give Claude more background knowledge and example outputs to reduce costs and latency." },
        { name: "Web search and fetch", desc: "Augment Claude’s knowledge with current, real-world data from across the web." },
        { name: "Advanced tool use", desc: "Allow Claude to interact with hundreds of external tools and APIs so it can perform a wider range of tasks." },
        { name: "Batch processing", desc: "Process large volumes of requests asynchronously and save 50% on costs." },
        { name: "Memory", desc: "Let Claude store and consult information from a dedicated memory file." },
        { name: "Context editing", desc: "Automatically clear less relevant tool calls and results from context window when approaching limits." },
        { name: "MCP connector", desc: "Connect Claude to any remote MCP server without writing client code." },
        { name: "Code execution", desc: "Run Python code, create visualizations, and analyze data directly within API calls." },
        { name: "Citations", desc: "Get detailed references to the exact sentences and passages Claude uses to generate responses." },
        { name: "Files API", desc: "Upload documents once and reference them repeatedly across conversations." },
        { name: "Skills", desc: "Teach Claude your expertise, procedures, and best practices so it delivers consistent results." },
        { name: "Structured outputs", desc: "Ensure Claude's responses conform to your JSON schema." }
      ]
    },
    console: {
      title: "Get to production faster with the AI Collective Console",
      sub: "Integrate Claude’s powerful AI capabilities into your apps and deliver production-grade solutions faster.",
      devTitle: "Built for developers",
      desc: "Build, test, and iterate on your deployment:",
      bullets: [
        "Automatically generate or improve existing prompts",
        "Evaluate model responses against real-world scenarios",
        "Build faster with pre-built cookbooks and guides"
      ]
    },
    usecases: {
      title: "Use cases for Claude",
      list: [
        {
          name: "Coding",
          desc: "Our models are constantly improving on coding, math, and reasoning. Claude can complete complex engineering tasks to solve problems that would typically take a day."
        },
        {
          name: "Agents",
          desc: "Claude offers superior instruction following, tool selection, error correction, and advanced reasoning for customer-facing agents and complex AI workflows."
        },
        {
          name: "Productivity",
          desc: "Claude can extract relevant information from business emails and documents, categorize survey responses, and wrangle reams of text with high speed."
        },
        {
          name: "Customer support",
          desc: "Claude can handle ticket triage, on-demand complex inquiries using rich context awareness, and multi-step support workflows—all with a natural tone."
        }
      ]
    },
    footer: {
      ctaTitle: "Start building",
      newsTitle: "Get the developer newsletter",
      newsSub: "Product updates, how-tos, community spotlights, and more. Delivered monthly to your inbox.",
      newsPlaceholder: "Enter your email",
      newsButton: "Subscribe",
      newsDisclaimer: "Please provide your email address if you'd like to receive our monthly developer newsletter. You can unsubscribe at any time."
    }
  },
  vi: {
    hero: {
      h1: "Xây dựng trên Nền tảng AI Collective",
      sub: "Sử dụng API của chúng tôi để tạo ra trải nghiệm người dùng, sản phẩm mới và cách thức làm việc với các mô hình AI tiên tiến nhất thị trường.",
      cta1: "Bắt đầu xây dựng",
      cta2: "Xem tài liệu lập trình"
    },
    started: {
      title: "Chọn cách thức bắt đầu",
      buildOwn: {
        title: "Tự xây dựng",
        sub: "Khởi chạy giải pháp AI của riêng bạn với:",
        bullets: [
          "Quyền truy cập vào tất cả mô hình AI Collective",
          "Hạn ngạch dựa trên mức sử dụng",
          "Tự động tăng hạn ngạch sử dụng",
          "Thanh toán đơn giản theo mức sử dụng",
          "Tự triển khai trên workbench",
          "Hướng dẫn viết prompt và tài liệu phát triển"
        ],
        cta: "Bắt đầu xây dựng"
      },
      support: {
        title: "Nhận hỗ trợ nâng cao",
        sub: "Cần hạn ngạch tùy chỉnh hoặc hỗ trợ trực tiếp? Liên hệ bộ phận bán hàng:",
        bullets: [
          "Hỗ trợ tích hợp chuyên sâu",
          "Hạn ngạch (rate limit) tùy chỉnh",
          "Thanh toán qua hóa đơn hàng tháng",
          "Hỗ trợ kỹ thuật prompt",
          "Hỗ trợ triển khai hệ thống"
        ],
        cta: "Liên hệ kinh doanh"
      }
    },
    models: {
      title: "Các mô hình AI Collective",
      sub: "Thiết kế phù hợp cho mọi tác vụ, mô hình của chúng tôi đem lại sự kết hợp tốt nhất giữa tốc độ và hiệu suất.",
      batch: "Tiết kiệm 50% với xử lý theo lô. Tìm hiểu thêm",
      list: [
        {
          name: "Opus 4.8",
          desc: "Mô hình thông minh nhất dành cho tác nhân và viết mã",
          input: "$5 / Triệu Token",
          output: "$25 / Triệu Token",
          caching: "Ghi $6.25 / Triệu Token · Đọc $0.50 / Triệu Token"
        },
        {
          name: "Sonnet 4.6",
          desc: "Cân bằng tối ưu giữa trí tuệ, chi phí và tốc độ",
          input: "$3 / Triệu Token",
          output: "$15 / Triệu Token",
          caching: "Ghi $3.75 / Triệu Token · Đọc $0.30 / Triệu Token"
        },
        {
          name: "Haiku 4.5",
          desc: "Mô hình nhanh nhất và hiệu quả chi phí nhất",
          input: "$1 / Triệu Token",
          output: "$5 / Triệu Token",
          caching: "Ghi $1.25 / Triệu Token · Đọc $0.10 / Triệu Token"
        }
      ]
    },
    tools: {
      title: "Làm được nhiều hơn với các công cụ tích hợp sẵn",
      sub: "Khám phá các tính năng và khả năng nâng cao của AI Collective.",
      cta: "Xem tài liệu lập trình",
      list: [
        { name: "Claude Managed Agents", desc: "Bộ API giúp xây dựng và triển khai tác nhân linh hoạt ở quy mô lớn." },
        { name: "Prompt caching", desc: "Cung cấp cho Claude nhiều kiến thức nền và ví dụ hơn để giảm chi phí và độ trễ." },
        { name: "Web search and fetch", desc: "Bổ sung kiến thức cho Claude với dữ liệu thời gian thực từ khắp nơi trên web." },
        { name: "Advanced tool use", desc: "Cho phép Claude tương tác với hàng trăm công cụ bên ngoài và API để làm được nhiều việc hơn." },
        { name: "Batch processing", desc: "Xử lý hàng loạt yêu cầu không đồng bộ và tiết kiệm 50% chi phí." },
        { name: "Memory", desc: "Cho phép Claude lưu trữ và tham khảo thông tin từ tệp bộ nhớ riêng biệt." },
        { name: "Context editing", desc: "Tự động dọn dẹp các lệnh gọi công cụ ít liên quan khi gần chạm giới hạn token." },
        { name: "MCP connector", desc: "Kết nối Claude với bất kỳ máy chủ MCP từ xa nào mà không cần viết mã máy khách." },
        { name: "Code execution", desc: "Chạy mã Python, tạo trực quan hóa và phân tích dữ liệu trực tiếp trong cuộc gọi API." },
        { name: "Citations", desc: "Nhận tham chiếu chi tiết đến các câu và đoạn văn chính xác mà Claude sử dụng." },
        { name: "Files API", desc: "Tải tài liệu lên một lần và tham chiếu chúng liên tục qua các cuộc trò chuyện." },
        { name: "Skills", desc: "Dạy cho Claude chuyên môn, quy trình và thực hành tốt nhất của bạn." },
        { name: "Structured outputs", desc: "Đảm bảo phản hồi của Claude tuân thủ chính xác lược đồ JSON của bạn." }
      ]
    },
    console: {
      title: "Triển khai thực tế nhanh hơn với AI Collective Console",
      sub: "Tích hợp năng lực AI mạnh mẽ của Claude vào ứng dụng của bạn và mang lại giải pháp cấp sản xuất nhanh chóng.",
      devTitle: "Xây dựng cho lập trình viên",
      desc: "Xây dựng, thử nghiệm và lặp lại trên triển khai của bạn:",
      bullets: [
        "Tự động tạo hoặc cải tiến các prompt hiện có",
        "Đánh giá phản hồi của mô hình đối với các kịch bản thực tế",
        "Xây dựng nhanh hơn với cookbooks và các tài liệu mẫu"
      ]
    },
    usecases: {
      title: "Các trường hợp sử dụng",
      list: [
        {
          name: "Lập trình",
          desc: "Các mô hình liên tục cải thiện về viết mã, toán và tư duy suy luận. Claude có thể hoàn thành các nhiệm vụ kỹ thuật phức tạp."
        },
        {
          name: "Tác nhân (Agents)",
          desc: "Claude cung cấp khả năng tuân thủ hướng dẫn vượt trội, lựa chọn công cụ và sửa lỗi cho các agent tự động."
        },
        {
          name: "Năng suất",
          desc: "Trích xuất thông tin liên quan từ email và tài liệu kinh doanh, phân loại phản hồi khảo sát với tốc độ cao."
        },
        {
          name: "Hỗ trợ khách hàng",
          desc: "Xử lý phân loại yêu cầu, giải đáp các thắc mắc phức tạp dựa trên ngữ cảnh đầy đủ, phản hồi tự nhiên."
        }
      ]
    },
    footer: {
      ctaTitle: "Bắt đầu xây dựng",
      newsTitle: "Đăng ký nhận bản tin lập trình viên",
      newsSub: "Cập nhật sản phẩm, hướng dẫn, tiêu điểm cộng đồng và hơn thế nữa. Gửi hàng tháng tới hộp thư của bạn.",
      newsPlaceholder: "Nhập email của bạn",
      newsButton: "Đăng ký",
      newsDisclaimer: "Vui lòng cung cấp địa chỉ email của bạn nếu bạn muốn nhận bản tin phát triển hàng tháng. Hủy đăng ký bất cứ lúc nào."
    }
  }
};

const CLIENT_TESTIMONIALS = [
  {
    logo: "CURSOR",
    text: "“On CursorBench, Claude 3.5 Sonnet is outstanding. We migrated all our agent mesh architecture over and saw immediate latency improvements.”",
    author: "Michael Truell, CEO"
  },
  {
    logo: "StubHub",
    text: "“The decision to choose Claude was simple. The safety, reliability, and ease of deployment across our global platforms was seamless.”",
    author: "Timothy Addison, Engineering Chief of Staff"
  },
  {
    logo: "Genspark.ai",
    text: "“On our Super Agent benchmark, Claude leads by a wide margin. It excels in reasoning, instruction following, and error correction.”",
    author: "Genspark Team"
  },
  {
    logo: "Rakuten",
    text: "“Claude 3.5 Sonnet produced the best iOS outputs. It handles ticket triage, multi-step workflows, and complex conversational queries.”",
    author: "Rakuten Engineering"
  }
];

export default function Landing() {
  const { stars } = useGitHubStats();
  const { language } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const t = LOCAL_COPY[language as "en" | "vi"] || LOCAL_COPY.en;

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
      <header className="sticky top-0 z-50 border-b border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-background/90 backdrop-blur-xl">
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
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <nav className="flex items-center gap-6 text-muted-foreground">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors group whitespace-nowrap">
                Meet Collective
                <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="flex items-center gap-1 text-foreground font-semibold cursor-pointer group whitespace-nowrap">
                Platform
                <ChevronDown className="w-3.5 h-3.5 text-accent" />
              </span>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors group whitespace-nowrap">
                Solutions
                <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="hover:text-foreground cursor-pointer transition-colors whitespace-nowrap">Pricing</span>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors group whitespace-nowrap">
                Resources
                <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
            </nav>

            {/* Divider line */}
            <div className="h-4 w-px bg-[#e8e6dc]/80 dark:bg-[#2e2e2d]/60" />

            {/* CTA Group */}
            <div className="flex items-center gap-4">
              <Link to="/login" className="hover:text-foreground transition-colors whitespace-nowrap">
                Login
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] hover:bg-muted/60 transition-colors whitespace-nowrap"
              >
                Contact sales
              </Link>

              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
              >
                Start building
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
              <span className="text-foreground font-semibold">Platform</span>
              <div className="flex items-center gap-1 hover:text-foreground cursor-pointer font-medium">
                <span>Explore here</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>
            </div>

            {/* Shifted Action Toggles to Secondary Header Strip */}
            <div className="hidden sm:flex items-center gap-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center h-7 rounded-lg overflow-hidden border border-border/60 text-xs font-semibold hover:border-border transition-all group"
              >
                <span className="flex items-center gap-1.5 px-2.5 h-full bg-muted/60 hover:bg-muted transition-colors text-muted-foreground group-hover:text-foreground border-r border-border/60">
                  <GithubIcon className="w-3 h-3" />
                  Star
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
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-border/60 bg-background px-6 py-4 space-y-3 flex flex-col font-medium text-sm text-muted-foreground"
          >
            <span className="hover:text-foreground cursor-pointer py-1">Meet Collective</span>
            <span className="text-foreground font-semibold py-1">Platform</span>
            <span className="hover:text-foreground cursor-pointer py-1">Solutions</span>
            <span className="hover:text-foreground cursor-pointer py-1">Pricing</span>
            <span className="hover:text-foreground cursor-pointer py-1">Resources</span>
            <hr className="border-border/60" />
            <Link to="/login" className="hover:text-foreground py-1">Login</Link>
            <Link to="/login" className="hover:text-foreground py-1">Contact sales</Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Left-aligned Hero Section with Vector Illustration on the right */}
      <section className="pt-24 pb-20 px-6 relative max-w-7xl mx-auto">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.035),transparent_70%)]" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-center">
          <div className="lg:col-span-7 text-left space-y-6">
            <FadeIn>
              <h1 className="text-5xl md:text-[68px] font-medium tracking-tight leading-[1.05] text-foreground font-serif">
                Build on the<br />AI Collective Platform
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
                  Start building
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] bg-transparent text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all shadow-xs"
                >
                  See developer docs
                </Link>
              </div>
            </FadeIn>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <FadeIn delay={0.1}>
              {/* Node Drawing Line-Art vector matching Claude Platform exactly in teal color style */}
              <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center bg-transparent">
                <svg viewBox="0 0 400 400" className="w-full h-full text-foreground" fill="none">
                  {/* Soft accent gradient backgrounds for shapes */}
                  <defs>
                    <radialGradient id="tealGrad1" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.65)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.2)" />
                    </radialGradient>
                    <radialGradient id="tealGrad2" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.5)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.1)" />
                    </radialGradient>
                  </defs>

                  {/* Circular node soft glow */}
                  <circle cx="280" cy="140" r="48" fill="url(#tealGrad1)" />
                  {/* Rounded square node soft glow */}
                  <rect x="235" y="215" width="76" height="76" rx="20" fill="url(#tealGrad2)" />

                  {/* Connected line with node indicators */}
                  <path 
                    d="M 280 140 L 310 250" 
                    stroke="currentColor" 
                    strokeWidth="6" 
                    strokeLinecap="round" 
                  />
                  <circle cx="280" cy="140" r="9" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                  <circle cx="310" cy="250" r="9" fill="currentColor" stroke="currentColor" strokeWidth="2" />

                  {/* Drawing Hand Outline contour */}
                  <path
                    d="M 180 320 C 190 280, 220 280, 230 280 C 235 280, 240 270, 240 260 M 240 260 C 240 240, 260 240, 265 240 C 270 240, 275 250, 275 265 M 275 265 C 275 245, 292 245, 296 245 C 300 245, 305 255, 305 270 M 305 270 C 305 255, 320 255, 324 255 C 328 255, 332 265, 332 280 C 332 300, 310 320, 310 330 C 310 340, 350 350, 370 380"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Wave scribble background line */}
                  <path
                    d="M 350 120 C 320 180, 380 220, 340 300 C 320 330, 360 360, 330 390"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.85"
                  />
                </svg>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 2. Client Testimonials Row Section */}
      <section className="px-6 pb-24 max-w-7xl mx-auto border-t border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 pt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-10 divide-y md:divide-y-0 md:divide-x divide-[#e8e6dc]/80 dark:divide-[#2e2e2d]/60">
          {CLIENT_TESTIMONIALS.map((c, idx) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {t.models.list.map((m, idx) => (
            <FadeIn key={idx} delay={idx * 0.05} className="h-full">
              <div className="bg-card border border-border/80 rounded-2xl p-6 flex flex-col h-full shadow-sm hover:border-border transition-all">
                <h3 className="text-lg font-semibold text-foreground mb-1 font-serif">{m.name}</h3>
                <p className="text-xs text-muted-foreground mb-6">{m.desc}</p>
                <div className="space-y-3 text-sm border-t border-border/40 pt-4 flex-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input</span>
                    <span className="font-medium text-foreground">{m.input}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output</span>
                    <span className="font-medium text-foreground">{m.output}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="block font-semibold text-foreground/70 mb-1">Prompt caching</span>
                  {m.caching}
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
                  <span className="ml-2 text-[10px] text-zinc-500">Claude Console · Workbench</span>
                </div>
                <div className="px-2 py-0.5 rounded bg-white/5 text-[9px] text-zinc-500">v4.6</div>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">User System Prompt</div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 text-zinc-300">
                    You are an expert software reviewer. Evaluate the code quality, locate potential security vulnerabilities, and propose optimized refactoring steps.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">User Message Input</div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 text-zinc-300">
                    async function fetchUser(id) {"{"} return await db.query("SELECT * FROM users WHERE id = " + id); {"}"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-zinc-500 text-[10px]">Evaluating with Claude 3.5 Sonnet</div>
                  <button className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-white font-semibold text-[11px] hover:bg-accent/80 transition-colors">
                    <Play className="w-3 h-3 fill-current" />
                    Run Prompt
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
                Start building
                <ArrowRight className="w-4 h-4 text-zinc-950" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 h-10 px-6 rounded-lg border border-white/20 bg-transparent text-white font-medium text-sm hover:bg-white/5 transition-colors"
              >
                Contact sales
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
              © {new Date().getFullYear()} AI Collective. All rights reserved. Integrating agent mesh networks across public and local systems.
            </p>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">Products</span>
            <span className="block hover:text-white cursor-pointer">Claude Platform</span>
            <span className="block hover:text-white cursor-pointer">Pricing</span>
            <span className="block hover:text-white cursor-pointer">Documentation</span>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">Solutions</span>
            <span className="block hover:text-white cursor-pointer">Enterprise</span>
            <span className="block hover:text-white cursor-pointer">Education</span>
            <span className="block hover:text-white cursor-pointer">Financial</span>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">Company</span>
            <span className="block hover:text-white cursor-pointer">About us</span>
            <span className="block hover:text-white cursor-pointer">Careers</span>
            <span className="block hover:text-white cursor-pointer">Press</span>
          </div>
        </div>
      </section>
    </div>
  );
}
