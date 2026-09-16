import { useState, useCallback } from "react";
import {
  ChevronRight, Check, Copy, Info, Lightbulb, AlertTriangle, Flame, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Language } from "@/locales";

export type { Language };

// Every doc page component takes the active UI language, renders its own
// fully-written content for that language (no locale-file lookups), and can
// cross-link to another doc page via onNavigate(id) — same ids used as
// DOCS_PAGES keys / NAV_STRUCTURE items in Docs.tsx.
export type DocPageProps = { lang: Language; onNavigate: (id: string) => void };

// ─── Shared typography ─────────────────────────────────────────────────────────

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-3 mt-0">{children}</h1>;
}
export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="text-xl font-bold tracking-tight text-foreground mt-10 mb-3 pt-2 border-t border-border/50 scroll-mt-20">{children}</h2>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-foreground/75 leading-relaxed mb-4">{children}</p>;
}
export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-none space-y-1.5 mb-4 pl-0">{children}</ul>;
}
export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[15px] text-foreground/75">
      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
export function Pill({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "orange" | "purple" }) {
  const c = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    orange: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
  }[color];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border", c)}>{children}</span>;
}
export function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded-md bg-muted text-[13px] font-mono text-foreground/90 border border-border/50">{children}</code>;
}

// Numbered variant of UL/LI, for narrative step-by-step walkthroughs
// ("1. Claude reads the file, 2. edits it, 3. runs the tests...").
export function OL({ children }: { children: React.ReactNode }) {
  return <ol className="list-none space-y-2.5 mb-4 pl-0">{children}</ol>;
}
export function OLI({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] text-foreground/75">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

// Inline cross-reference to another doc page (id = DOCS_PAGES key).
export function DocLink({ id, onNavigate, children }: { id: string; onNavigate: (id: string) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      className="text-primary font-semibold hover:underline underline-offset-2 decoration-primary/40"
    >
      {children}
    </button>
  );
}

// "What's next" card group for the end of a doc page.
export function NextSteps({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">{children}</div>;
}
export function NextStepCard({ id, onNavigate, title, desc }: { id: string; onNavigate: (id: string) => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      className="flex items-start justify-between gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
    >
      <div>
        <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{title}</div>
        <div className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
    </button>
  );
}

export function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);
  return (
    <div className="my-5 rounded-xl overflow-hidden border border-[hsl(222,44%,20%)] bg-[hsl(222,47%,8%)] text-sm font-mono">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(222,44%,16%)] bg-[hsl(222,47%,10%)]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          {title && <span className="text-[11px] text-slate-400 ml-1">{title}</span>}
          {!title && lang && <span className="text-[11px] text-slate-500 uppercase tracking-wider ml-1">{lang}</span>}
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-white/5">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="px-5 py-4 text-slate-200 leading-relaxed whitespace-pre text-[13px]">{code}</pre>
      </div>
    </div>
  );
}

export function Callout({ type = "info", children }: { type?: "info" | "tip" | "warning" | "danger"; children: React.ReactNode }) {
  const cfg = {
    info:    { icon: Info, bg: "bg-blue-500/10 border-blue-500/25", icon_cls: "text-blue-500" },
    tip:     { icon: Lightbulb, bg: "bg-emerald-500/10 border-emerald-500/25", icon_cls: "text-emerald-500" },
    warning: { icon: AlertTriangle, bg: "bg-amber-500/10 border-amber-500/25", icon_cls: "text-amber-500" },
    danger:  { icon: Flame, bg: "bg-rose-500/10 border-rose-500/25", icon_cls: "text-rose-500" },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={cn("my-5 flex gap-3 rounded-xl border p-4", cfg.bg)}>
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", cfg.icon_cls)} />
      <div className="text-sm leading-relaxed text-foreground/80">{children}</div>
    </div>
  );
}

export function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    PATCH: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <span className={cn("flex-shrink-0 text-[11px] font-black px-2 py-0.5 rounded-md w-16 text-center", colors[method] ?? "bg-muted text-muted-foreground")}>{method}</span>
      <code className="text-[13px] font-mono text-foreground/80 flex-1">{path}</code>
      <span className="text-[13px] text-muted-foreground text-right hidden sm:block">{desc}</span>
    </div>
  );
}
