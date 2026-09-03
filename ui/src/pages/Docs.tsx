import { useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronRight, ChevronDown, ExternalLink,
  BookOpen, ArrowRight, Menu, X, ArrowLeft, ArrowUpRight,
  Terminal, Package, Layers, GitBranch, Rocket, Heart, Lightbulb,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDocContent } from "@/locales/docs-content";

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";

// ─── Nav structure (keyed by section id) ────────────────────────────────────

const NAV_STRUCTURE = [
  { id: "intro",         icon: BookOpen,   items: ["what-is","architecture","key-concepts","pricing"] },
  { id: "getting-started", icon: Rocket,   items: ["quickstart","installation","configuration"] },
  { id: "concepts",      icon: Layers,     items: ["staff","skills","departments","tasks","meetings","playground","analytics","companies","settings"] },
  { id: "guides",        icon: Lightbulb,  items: ["guide-first-staff","guide-build-department","guide-run-task","guide-skills"] },
  { id: "api-reference", icon: Terminal,   items: ["api-staff","api-skills","api-departments","api-tasks","api-chat"] },
  { id: "deployment",    icon: Package,    items: ["deploy-docker","deploy-env"] },
  { id: "contributing",  icon: Heart,      items: ["contributing-guide","contributing-dev"] },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DocSidebar({
  activeId, onSelect, searchQuery, onSearch, mobile, onClose,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const { t, language } = useLanguage();
  const ui = t.docs.ui;
  const navT = t.docs.nav;

  const localTitles: Record<string, Record<string, string>> = {
    pricing: { en: "Pricing & Plans", vi: "Bảng giá & Gói dịch vụ", zh: "定价与计划", ja: "料金とプラン" },
    playground: { en: "Playground", vi: "Thử nghiệm (Playground)", zh: "演练场", ja: "プレイグラウンド" },
    analytics: { en: "Analytics", vi: "Phân tích & Thống kê", zh: "分析", ja: "分析" },
    companies: { en: "Companies", vi: "Không gian làm việc", zh: "工作空间", ja: "ワークスペース" },
    settings: { en: "Settings", vi: "Cài đặt", zh: "设置", ja: "設定" },
  };

  const nav = NAV_STRUCTURE.map((s) => ({
    ...s,
    title: navT.sections[s.id] ?? s.id,
    items: s.items.map((id) => ({ 
      id, 
      title: navT.items[id] ?? localTitles[id]?.[language] ?? id 
    })),
  }));

  const allItems = nav.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const active = nav.find((s) => s.items.some((i) => i.id === activeId));
    return new Set(active ? [active.id] : [nav[0].id]);
  });

  const filtered = searchQuery.trim()
    ? allItems.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  return (
    <div className={cn("flex flex-col h-full", mobile && "pt-2")}>
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={ui.search}
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border/60 bg-background/60 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6 scrollbar-thin">
        {filtered ? (
          <div className="space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">{ui.noResults}</p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); onClose?.(); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  activeId === item.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <div className="font-medium">{item.title}</div>
                <div className="text-[11px] text-muted-foreground/60 mt-0.5">{item.section}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {nav.map((section) => {
              const isExpanded = expanded.has(section.id);
              const hasActive = section.items.some((i) => i.id === activeId);
              const Icon = section.icon;
              return (
                <div key={section.id}>
                  <button
                    onClick={() => toggle(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors",
                      hasActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 text-left">{section.title}</span>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-3 ml-1 border-l border-border/50 space-y-0.5 mb-1">
                          {section.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => { onSelect(item.id); onClose?.(); }}
                              className={cn(
                                "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all duration-150",
                                activeId === item.id
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              {item.title}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Docs component ──────────────────────────────────────────────────────

export default function Docs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const ui = t.docs.ui;
  const navT = t.docs.nav;

  const activeId = searchParams.get("page") ?? "what-is";

  const setPage = useCallback((id: string) => {
    setSearchParams({ page: id });
    setSearch("");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSearchParams]);

  const localTitles: Record<string, Record<string, string>> = {
    pricing: { en: "Pricing & Plans", vi: "Bảng giá & Gói dịch vụ", zh: "定价与计划", ja: "料金とプラン" },
    playground: { en: "Playground", vi: "Thử nghiệm (Playground)", zh: "演练场", ja: "プレイグラウンド" },
    analytics: { en: "Analytics", vi: "Phân tích & Thống kê", zh: "分析", ja: "分析" },
    companies: { en: "Companies", vi: "Không gian làm việc", zh: "工作空间", ja: "ワークスペース" },
    settings: { en: "Settings", vi: "Cài đặt", zh: "设置", ja: "設定" },
  };

  const allItems = NAV_STRUCTURE.flatMap((s) =>
    s.items.map((id) => ({ 
      id, 
      title: navT.items[id] ?? localTitles[id]?.[language] ?? id 
    }))
  );
  const currentIdx = allItems.findIndex((i) => i.id === activeId);
  const prev = currentIdx > 0 ? allItems[currentIdx - 1] : null;
  const next = currentIdx < allItems.length - 1 ? allItems[currentIdx + 1] : null;

  const content = getDocContent(t)[activeId] ?? (
    <div className="py-20 text-center text-muted-foreground">
      <p className="text-lg font-semibold mb-2">{ui.pageNotFound}</p>
      <p className="text-sm">{ui.comingSoon}</p>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Navbar */}
      <nav className="h-14 flex-shrink-0 flex items-center border-b border-border/60 bg-background/90 backdrop-blur-xl z-50 shadow-sm">
        <div className="w-full flex items-center px-4 gap-3">
          <button
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>

          <Link to="/" className="flex items-center gap-2 flex-shrink-0 group">
            <img src="/spider.png" alt="" className="h-7 w-7 object-contain" />
            <span className="font-bold text-sm text-foreground/80 group-hover:text-foreground transition-colors hidden sm:block">AI Collective</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block" />
          <span className="text-sm font-semibold text-foreground hidden sm:block">{ui.docsLabel}</span>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{ui.backToSite}</span>
              </Button>
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <LanguageSwitcher />
            <ThemeToggle />
            <Link to="/dashboard">
              <Button size="sm" className="h-8 text-xs shadow-sm shadow-primary/15">
                {ui.openApp}
                <ArrowUpRight className="ml-1.5 w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r border-border/60 bg-background/60 overflow-y-auto scrollbar-thin">
          <div className="pt-4">
            <DocSidebar activeId={activeId} onSelect={setPage} searchQuery={search} onSearch={setSearch} />
          </div>
        </aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-background border-r border-border/60 lg:hidden flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between px-4 h-14 border-b border-border/60 flex-shrink-0">
                  <span className="font-bold text-sm">{ui.documentation}</span>
                  <button onClick={() => setMobileOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <DocSidebar activeId={activeId} onSelect={setPage} searchQuery={search} onSearch={setSearch} mobile onClose={() => setMobileOpen(false)} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main ref={contentRef} className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="max-w-3xl mx-auto px-6 md:px-10 py-10"
          >
            {content}

            {/* Prev / Next */}
            <div className="mt-16 pt-8 border-t border-border/60 grid grid-cols-2 gap-4">
              {prev ? (
                <button
                  onClick={() => setPage(prev.id)}
                  className="flex flex-col items-start p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                >
                  <span className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> {ui.previous}
                  </span>
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">{prev.title}</span>
                </button>
              ) : <div />}
              {next ? (
                <button
                  onClick={() => setPage(next.id)}
                  className="flex flex-col items-end p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-right group ml-auto w-full"
                >
                  <span className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                    {ui.next} <ArrowRight className="w-3 h-3" />
                  </span>
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">{next.title}</span>
                </button>
              ) : <div />}
            </div>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground/60">
              <span>AI Collective Docs · MIT License</span>
              <a
                href={`${GITHUB_URL}/edit/main/docs/${activeId}.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {ui.editOnGitHub}
              </a>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
