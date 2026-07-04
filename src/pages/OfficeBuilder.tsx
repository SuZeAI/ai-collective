import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Building2, Users, User, Wrench, Send, Sparkles, Loader2,
  CheckCircle2, RotateCcw, Bot, Workflow, Plus, Trash2, MessageSquare, History,
} from "lucide-react";
import {
  api,
  canDeleteItem,
  type OfficeChatMessage,
  type OfficePlan,
  type OfficeDepartmentPlan,
  type OfficeHumanPlan,
  type OfficeBuilderSessionSummary,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_TYPES } from "@/lib/company-types";
import type { CompanyType } from "@/lib/api";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Create a software company office with engineering, product and QA departments",
  "Build a digital marketing agency: content, social media and analytics teams",
  "Set up a market research office with web research and reporting departments",
];

// Remember which session the user was working on across visits.
const ACTIVE_SESSION_KEY = "ai-collective-office-builder-session";

const PlanStats = memo(function PlanStats({ plan }: { plan: OfficePlan }) {
  const humans = plan.departments.reduce((n, d) => n + d.humans.length, 0);
  const skills = plan.departments.reduce(
    (n, d) => n + d.humans.reduce((m, h) => m + h.skills.length, 0),
    0,
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Users className="h-3 w-3" /> {plan.departments.length} departments
      </Badge>
      <Badge variant="secondary" className="text-[10px] gap-1">
        <User className="h-3 w-3" /> {humans} humans
      </Badge>
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Wrench className="h-3 w-3" /> {skills} skills
      </Badge>
    </div>
  );
});

const HumanCard = memo(function HumanCard({ human }: { human: OfficeHumanPlan }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/60 p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
          {human.name?.[0]?.toUpperCase() || "H"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{human.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{human.role}</p>
        </div>
      </div>
      {human.description && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/80 line-clamp-2">{human.description}</p>
      )}
      {human.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {human.skills.map((s, i) => (
            <Badge key={`${s.name}-${i}`} variant="outline" className="text-[9px] gap-1 px-1.5 py-0">
              <Wrench className="h-2.5 w-2.5" />
              {s.name}
              {s.tool_name && <span className="text-muted-foreground/70 font-mono">· {s.tool_name}</span>}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
});

const DepartmentCard = memo(function DepartmentCard({ dept }: { dept: OfficeDepartmentPlan }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
          {dept.name?.[0]?.toUpperCase() || "D"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{dept.name}</p>
          {dept.description && (
            <p className="text-[10px] text-muted-foreground truncate">{dept.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="text-[9px] gap-1 shrink-0">
          <Workflow className="h-2.5 w-2.5" /> {dept.mode}
        </Badge>
      </div>
      <div className="mt-2 grid gap-2 pl-3 border-l-2 border-border/40 ml-3.5">
        {dept.humans.map((h, i) => (
          <HumanCard key={`${h.name}-${i}`} human={h} />
        ))}
      </div>
    </div>
  );
});

// ─── "AI is working" overlay shown on the preview while a plan is generated ──
const GhostDepartmentCard = memo(function GhostDepartmentCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: [0, 1, 1, 0.5], x: [-14, 0, 0, 0] }}
      transition={{
        duration: 3.2,
        times: [0, 0.15, 0.85, 1],
        delay: index * 0.45,
        repeat: Infinity,
        repeatDelay: 0.6,
        ease: "easeOut",
      }}
      className="w-full rounded-xl border border-border/50 bg-muted/30 p-3"
    >
      <div className="flex items-center gap-2.5">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: index * 0.2 }}
          className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500/50 to-cyan-600/50 shrink-0"
        />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-2 w-2/3 rounded-full bg-foreground/15 animate-pulse" />
          <div className="h-1.5 w-1/2 rounded-full bg-foreground/10 animate-pulse" />
        </div>
      </div>
      <div className="mt-2.5 ml-3.5 pl-3 border-l-2 border-border/40 space-y-2">
        {[0, 1].map((h) => (
          <div key={h} className="flex items-center gap-2">
            <motion.div
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 1.3, repeat: Infinity, delay: index * 0.2 + h * 0.3 + 0.2 }}
              className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500/50 to-purple-600/50 shrink-0"
            />
            <div className="h-1.5 flex-1 max-w-[60%] rounded-full bg-foreground/10 animate-pulse" />
            <motion.div
              animate={{ opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 1.3, repeat: Infinity, delay: index * 0.2 + h * 0.3 + 0.4 }}
              className="h-3 w-10 rounded-full border border-border/50 bg-muted/40"
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
});

function DesigningOverlay({ updating }: { updating: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 rounded-xl bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-8"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-4 w-4 text-teal-400" />
        </motion.div>
        <span className="text-xs font-semibold">
          {updating ? "Updating the plan" : "Designing your office"}
        </span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
              className="w-1 h-1 rounded-full bg-teal-400"
            />
          ))}
        </span>
      </div>

      {/* Blueprint skeleton: ghost departments being sketched in */}
      <div className="w-full max-w-xs space-y-2.5">
        {[0, 1, 2].map((i) => (
          <GhostDepartmentCard key={i} index={i} />
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/70">
        Departments → Humans → Skills & Tools
      </p>
    </motion.div>
  );
}

// ─── "Under construction" overlay shown while the office is being created ────
const BUILD_STEPS = [
  { icon: Wrench, label: "Creating skills…" },
  { icon: User, label: "Hiring humans…" },
  { icon: Users, label: "Forming departments…" },
  { icon: Building2, label: "Opening the office…" },
];

function ConstructionOverlay({ plan, done }: { plan: OfficePlan; done: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setStep((s) => (s + 1) % BUILD_STEPS.length), 1500);
    return () => clearInterval(id);
  }, [done]);

  // One tower per department, height follows headcount.
  const towers = plan.departments
    .slice(0, 5)
    .map((d) => Math.min(5, Math.max(2, d.humans.length + 1)));
  const cycle = towers.length * 0.2 + 5 * 0.3 + 1.2;
  const StepIcon = BUILD_STEPS[step].icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 rounded-xl bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-6"
    >
      {done ? (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <p className="text-sm font-bold">{plan.name} is open! 🎉</p>
          <p className="text-xs text-muted-foreground">Taking you to your new office…</p>
        </motion.div>
      ) : (
        <>
          {/* Animated skyline: blocks stack up tower by tower, looping */}
          <div className="flex items-end gap-2 h-32">
            {towers.map((blocks, ti) => (
              <div key={ti} className="flex flex-col-reverse gap-1">
                {Array.from({ length: blocks }).map((_, bi) => (
                  <motion.div
                    key={bi}
                    initial={{ opacity: 0, y: -18, scaleY: 0.3 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [-18, 0, 0, 0], scaleY: [0.3, 1, 1, 1] }}
                    transition={{
                      duration: cycle,
                      times: [0, 0.15, 0.85, 1],
                      delay: ti * 0.2 + bi * 0.3,
                      repeat: Infinity,
                      repeatDelay: 0.4,
                      ease: "easeOut",
                    }}
                    className="w-9 h-5 rounded-sm bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-500/20 border border-white/10"
                  />
                ))}
              </div>
            ))}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="text-3xl ml-1 select-none"
            >
              🏗️
            </motion.div>
          </div>

          {/* Cycling build step */}
          <div className="h-6 flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 text-xs font-medium text-foreground"
              >
                <StepIcon className="h-3.5 w-3.5 text-teal-400" />
                {BUILD_STEPS[step].label}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Departments being assembled */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
            {plan.departments.map((d, i) => (
              <motion.div
                key={`${d.name}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.3 }}
              >
                <Badge variant="secondary" className="text-[9px] gap-1">
                  <motion.span
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}
                    className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400"
                  />
                  {d.name}
                </Badge>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function formatSessionTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function OfficeBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [sessions, setSessions] = useState<OfficeBuilderSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appliedWorkspaceId, setAppliedWorkspaceId] = useState<string>("");
  const [companyType, setCompanyType] = useState<CompanyType>("general");
  const [messages, setMessages] = useState<OfficeChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<OfficePlan | null>(null);
  const [planRev, setPlanRev] = useState(0); // bumped whenever a fresh plan lands → retriggers the reveal animation
  const [thinking, setThinking] = useState(false); // waiting for the first token
  const [streaming, setStreaming] = useState(false); // tokens are arriving
  const [creating, setCreating] = useState(false);
  const [built, setBuilt] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const busy = thinking || streaming || creating;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await api.listOfficeBuilderSessions());
    } catch (err) {
      console.error("Failed to list office builder sessions:", err);
    }
  }, []);

  // Initial load: session list + restore the last active session.
  useEffect(() => {
    refreshSessions();
    const storedId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (storedId) void openSession(storedId, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSession = async (id: string, opts?: { silent?: boolean }) => {
    if (busy) return;
    setLoadingSession(true);
    try {
      const s = await api.getOfficeBuilderSession(id);
      setSessionId(s.id);
      setMessages(s.messages);
      setPlan(s.plan);
      setPlanRev((v) => v + 1);
      setAppliedWorkspaceId(s.workspaceId || "");
      setInput("");
      localStorage.setItem(ACTIVE_SESSION_KEY, s.id);
    } catch (err) {
      // Session was deleted elsewhere — forget it quietly on restore.
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      if (!opts?.silent) {
        const detail = err instanceof Error ? err.message : "Failed to load session";
        toast({ title: "Office Builder", description: detail, variant: "destructive" });
      }
    } finally {
      setLoadingSession(false);
    }
  };

  const newChat = () => {
    if (busy) return;
    setSessionId(null);
    setMessages([]);
    setPlan(null);
    setAppliedWorkspaceId("");
    setInput("");
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  };

  const persistSession = async (
    nextMessages: OfficeChatMessage[],
    nextPlan: OfficePlan | null,
    workspaceId?: string,
  ): Promise<string | null> => {
    try {
      const saved = await api.upsertOfficeBuilderSession({
        id: sessionId,
        messages: nextMessages,
        plan: nextPlan,
        workspaceId: workspaceId ?? appliedWorkspaceId,
      });
      setSessionId(saved.id);
      localStorage.setItem(ACTIVE_SESSION_KEY, saved.id);
      void refreshSessions();
      return saved.id;
    } catch (err) {
      console.error("Failed to save office builder session:", err);
      return null;
    }
  };

  const removeSession = async (id: string) => {
    if (busy) return;
    try {
      await api.deleteOfficeBuilderSession(id);
      if (id === sessionId) newChat();
      void refreshSessions();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to delete session";
      toast({ title: "Office Builder", description: detail, variant: "destructive" });
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const nextMessages: OfficeChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);

    let assistantText = "";
    let nextPlan: OfficePlan | null = plan;
    const showAssistant = (t: string) => {
      assistantText = t;
      setMessages([...nextMessages, { role: "assistant", content: t }]);
    };

    try {
      for await (const ev of api.officeBuilderChatStream({ messages: nextMessages, plan })) {
        if (ev.type === "delta") {
          if (!assistantText) {
            setThinking(false);
            setStreaming(true);
          }
          showAssistant(assistantText + ev.text);
        } else if (ev.type === "plan") {
          nextPlan = ev.plan;
          setPlan(ev.plan);
          setPlanRev((v) => v + 1);
        } else if (ev.type === "done") {
          // The backend's canonical reply (trimmed, fence-free) wins.
          if (ev.reply) showAssistant(ev.reply);
        } else if (ev.type === "error") {
          throw new Error(ev.detail);
        }
      }
      if (!assistantText) showAssistant("…");
      await persistSession([...nextMessages, { role: "assistant", content: assistantText }], nextPlan);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Plan generation failed";
      const withError: OfficeChatMessage[] = [...nextMessages, { role: "assistant", content: `⚠️ ${detail}` }];
      setMessages(withError);
      toast({ title: "Office Builder", description: detail, variant: "destructive" });
      await persistSession(withError, nextPlan);
    } finally {
      setThinking(false);
      setStreaming(false);
    }
  };

  const createOffice = async () => {
    if (!plan || creating) return;
    setCreating(true);
    try {
      const res = await api.applyOfficePlan({ plan: { ...plan, company_type: companyType } });
      toast({
        title: "Office created",
        description: `"${res.workspace.name}" — ${res.team_ids.length} departments, ${res.agent_ids.length} humans, ${res.skill_ids.length} new skills.`,
      });
      setAppliedWorkspaceId(res.workspace.id);
      // Keep the session in history, marked as applied.
      await persistSession(messages, plan, res.workspace.id);
      // Let the "office is open" animation play before leaving the page.
      setBuilt(true);
      await new Promise((r) => setTimeout(r, 1600));
      // Refresh the sidebar workspace switcher and jump to the new office.
      localStorage.setItem("activeWorkspaceId", res.workspace.id);
      window.dispatchEvent(new CustomEvent("workspaceChanged"));
      navigate("/workspaces");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Office creation failed";
      toast({ title: "Office Builder", description: detail, variant: "destructive" });
    } finally {
      setCreating(false);
      setBuilt(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-400" />
            AI Office Designer
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Describe your company — AI builds a full company (departments, staff, skills &amp; tools), then pick a type and create it.
          </p>
        </div>
        {(messages.length > 0 || plan) && (
          <Button size="sm" variant="ghost" onClick={newChat} className="text-xs gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> New chat
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* ── Chat history panel ── */}
        <div className="hidden md:flex w-56 shrink-0 flex-col rounded-xl border border-border/50 bg-card/50">
          <div className="p-2.5 border-b border-border/50">
            <Button size="sm" variant="outline" onClick={newChat} className="w-full text-xs gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> New chat
            </Button>
          </div>
          <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="h-3 w-3" /> History
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-1">
            {sessions.length === 0 && (
              <p className="px-2 py-4 text-[11px] text-muted-foreground/70 text-center">
                No chats yet. Your office-building conversations will appear here.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => openSession(s.id)}
                onKeyDown={(e) => e.key === "Enter" && openSession(s.id)}
                className={cn(
                  "group w-full rounded-lg px-2.5 py-2 cursor-pointer transition-colors border border-transparent",
                  s.id === sessionId
                    ? "bg-muted/70 border-border/60"
                    : "hover:bg-muted/40",
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-snug line-clamp-2">{s.title}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground">{formatSessionTime(s.updatedAt)}</span>
                      {s.hasPlan && !s.workspaceId && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0">draft</Badge>
                      )}
                      {s.workspaceId && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 text-emerald-500 border-emerald-500/40">
                          created
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canDeleteItem(s) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400 shrink-0 mt-0.5"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat + preview panels ── */}
        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chat panel */}
          <div className="flex flex-col min-h-0 rounded-xl border border-border/50 bg-card/50">
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {loadingSession && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!loadingSession && messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Chat to create a full office</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Tell me what kind of company you want. I'll design the departments,
                      staff each one with humans, and equip every human with skills and tools.
                    </p>
                  </div>
                  <div className="grid gap-2 w-full max-w-md">
                    {EXAMPLE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-left text-xs rounded-lg border border-border/50 bg-muted/30 px-3 py-2 hover:bg-muted/60 hover:border-teal-500/40 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!loadingSession && (
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                          m.role === "user"
                            ? "bg-foreground text-background"
                            : "bg-gradient-to-br from-teal-500 to-cyan-600 text-white",
                        )}
                      >
                        {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div
                        className={cn(
                          "rounded-xl px-3 py-2 text-xs max-w-[85%] leading-relaxed",
                          m.role === "user"
                            ? "bg-foreground text-background"
                            : "bg-muted/50 border border-border/40",
                        )}
                      >
                        <div
                          className={cn(
                            "prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
                            m.role === "user" && "text-background [&_*]:text-background",
                          )}
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                        {streaming && m.role === "assistant" && i === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-teal-400 animate-pulse rounded-[1px]" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              {thinking && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-xl px-3 py-2 text-xs bg-muted/50 border border-border/40 flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Designing your office…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border/50 p-3">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder='e.g. "A content studio with research, writing and publishing departments"'
                  rows={2}
                  disabled={busy}
                  className="text-xs resize-none min-h-0"
                />
                <Button
                  size="icon"
                  onClick={() => send()}
                  disabled={!input.trim() || busy}
                  className="shrink-0 h-9 w-9"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Plan preview panel */}
          <div className="relative flex flex-col min-h-0 rounded-xl border border-border/50 bg-card/50">
            <AnimatePresence>
              {(creating || built) && plan && <ConstructionOverlay plan={plan} done={built} />}
              {(thinking || streaming) && !creating && (
                <DesigningOverlay key="designing" updating={!!plan} />
              )}
            </AnimatePresence>
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{plan?.name || "Office preview"}</p>
                  {plan?.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{plan.description}</p>
                  )}
                </div>
              </div>
              {plan && appliedWorkspaceId && (
                <Badge variant="outline" className="text-[9px] gap-1 shrink-0 text-emerald-500 border-emerald-500/40">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Created
                </Badge>
              )}
              {plan && !appliedWorkspaceId && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Select value={companyType} onValueChange={(v) => setCompanyType(v as CompanyType)} disabled={busy}>
                    <SelectTrigger className="h-8 w-[150px] text-xs" title={t.companyTypeLabel}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_TYPES.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value} className="text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <ct.icon className="h-3 w-3" />
                            {t.companyTypes[ct.value]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={createOffice} disabled={busy} className="text-xs gap-1.5">
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {creating ? "Creating…" : "Create Company"}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
              {!plan ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                  <Building2 className="h-8 w-8 opacity-30" />
                  <p className="text-xs">The generated org structure will appear here.</p>
                  <p className="text-[10px] opacity-70">Office → Departments → Humans → Skills & Tools</p>
                </div>
              ) : (
                <div key={planRev} className="space-y-3">
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <PlanStats plan={plan} />
                  </motion.div>
                  {plan.departments.map((d, i) => (
                    <motion.div
                      key={`${d.name}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.1, duration: 0.3, ease: "easeOut" }}
                    >
                      <DepartmentCard dept={d} />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
