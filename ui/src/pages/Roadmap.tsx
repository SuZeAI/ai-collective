import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Map as MapIcon, Layers, ListChecks, TrendingUp, CalendarRange } from "lucide-react";
import { api, type Epic, type Task } from "@/lib/api";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { useScopedProject } from "@/hooks/use-scoped-project";
import { cn } from "@/lib/utils";

const DAY = 86400000;
// Fixed width of the epic label column, shared by the header row and every
// epic row so the timeline overlay (gridlines/today marker) — which is
// positioned independently — lines up under the bar column exactly.
const LABEL_COL = "220px";

const EPIC_COLORS = [
  { fill: "bg-cyan-500/70", track: "bg-cyan-500/15", dot: "bg-cyan-500" },
  { fill: "bg-violet-500/70", track: "bg-violet-500/15", dot: "bg-violet-500" },
  { fill: "bg-emerald-500/70", track: "bg-emerald-500/15", dot: "bg-emerald-500" },
  { fill: "bg-amber-500/70", track: "bg-amber-500/15", dot: "bg-amber-500" },
  { fill: "bg-rose-500/70", track: "bg-rose-500/15", dot: "bg-rose-500" },
  { fill: "bg-sky-500/70", track: "bg-sky-500/15", dot: "bg-sky-500" },
];

export default function Roadmap() {
  const { key: projectKey = "" } = useParams<{ key: string }>();
  const fetchRelated = useCallback(async () => {
    const [epics, issues] = await Promise.all([api.listEpics(), api.listTasks()]);
    return { epics, issues };
  }, []);
  const { project, data, loading } = useScopedProject(projectKey, fetchRelated);
  const { epics = [], issues = [] } = data;

  const issuesByEpic = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of issues) {
      if (!t.epicId) continue;
      const arr = m.get(t.epicId) ?? [];
      arr.push(t);
      m.set(t.epicId, arr);
    }
    return m;
  }, [issues]);

  // Build a shared time window across all dated epics; fall back to a default
  // 90-day window starting today when none have dates.
  const { windowStart, windowEnd } = useMemo(() => {
    const dates: number[] = [];
    for (const e of epics) {
      if (e.startDate) dates.push(new Date(e.startDate).getTime());
      if (e.dueDate) dates.push(new Date(e.dueDate).getTime());
    }
    const now = Date.now();
    if (dates.length === 0) return { windowStart: now, windowEnd: now + 90 * DAY };
    const min = Math.min(...dates, now);
    const max = Math.max(...dates, now + 14 * DAY);
    return { windowStart: min, windowEnd: max };
  }, [epics]);

  const span = Math.max(windowEnd - windowStart, DAY);

  const barFor = (e: Epic) => {
    const start = e.startDate ? new Date(e.startDate).getTime() : windowStart;
    const end = e.dueDate ? new Date(e.dueDate).getTime() : start + 14 * DAY;
    const left = ((start - windowStart) / span) * 100;
    const width = Math.max(((end - start) / span) * 100, 3);
    return { left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - Math.max(0, left))}%`, end };
  };

  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Month tick marks along the shared timeline, for a legible axis on longer windows.
  const monthTicks = useMemo(() => {
    const ticks: { label: string; left: number }[] = [];
    const cursor = new Date(windowStart);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    if (cursor.getTime() < windowStart) cursor.setMonth(cursor.getMonth() + 1);
    while (cursor.getTime() <= windowEnd) {
      ticks.push({
        label: cursor.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
        left: ((cursor.getTime() - windowStart) / span) * 100,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return ticks;
  }, [windowStart, windowEnd, span]);

  const todayLeft = useMemo(() => {
    const pct = ((Date.now() - windowStart) / span) * 100;
    return pct >= 0 && pct <= 100 ? pct : null;
  }, [windowStart, span]);

  const totalIssuesCount = issues.length;
  const doneIssuesCount = issues.filter((t) => t.status === "completed").length;
  const overallPct = totalIssuesCount ? Math.round((doneIssuesCount / totalIssuesCount) * 100) : 0;

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <ProjectSubnav project={project} projectKey={projectKey} active="roadmap" />
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border/40 bg-card/40 animate-pulse" />
              ))}
            </div>
            <div className="h-40 rounded-2xl border border-border/40 bg-card/40 animate-pulse" />
          </div>
        ) : !project ? (
          <div className="text-center text-muted-foreground text-sm py-10">Project "{projectKey}" not found.</div>
        ) : epics.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500/10 to-teal-600/10 border border-cyan-500/20 mb-4">
              <MapIcon className="w-7 h-7 text-cyan-400/70" />
            </div>
            <p className="text-sm font-medium text-foreground">No epics yet</p>
            <p className="text-xs mt-1">Create epics (with start/due dates) in the Backlog to see them on the roadmap.</p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Epics", value: epics.length, icon: Layers, color: "text-violet-500" },
                { label: "Issues", value: totalIssuesCount, icon: ListChecks, color: "text-cyan-500" },
                { label: "Overall progress", value: `${overallPct}%`, icon: TrendingUp, color: "text-emerald-500" },
                { label: "Timeline span", value: `${fmt(windowStart)} – ${fmt(windowEnd)}`, icon: CalendarRange, color: "text-amber-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl border border-border/40 bg-card/40 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                    <Icon className={cn("w-4 h-4", color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-none text-foreground truncate">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="relative rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
              {/* Gridlines + today marker, spanning the full card height, aligned
                  under the bar column only (the label column is excluded). */}
              <div className="absolute top-0 bottom-0 right-0 pointer-events-none" style={{ left: LABEL_COL }}>
                {monthTicks.map((t) => (
                  <div key={t.label} className="absolute top-0 bottom-0 w-px bg-border/40" style={{ left: `${t.left}%` }} />
                ))}
                {todayLeft != null && (
                  <div className="absolute top-0 bottom-0 w-px bg-rose-500/60" style={{ left: `${todayLeft}%` }}>
                    <span className="absolute -top-0.5 -left-[3px] w-[7px] h-[7px] rounded-full bg-rose-500" />
                  </div>
                )}
              </div>

              <div
                className="grid items-center gap-3 px-4 py-2 border-b border-border/40 bg-muted/20 relative"
                style={{ gridTemplateColumns: `${LABEL_COL} 1fr` }}
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Epic</span>
                <div className="relative h-4">
                  {monthTicks.map((t) => (
                    <span
                      key={t.label}
                      className="absolute -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap"
                      style={{ left: `${Math.min(Math.max(t.left, 4), 96)}%` }}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-border/30">
                {epics.map((e, idx) => {
                  const childIssues = issuesByEpic.get(e.id) ?? [];
                  const done = childIssues.filter((t) => t.status === "completed").length;
                  const pct = childIssues.length ? Math.round((done / childIssues.length) * 100) : 0;
                  const points = childIssues.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
                  const style = barFor(e);
                  const overdue = pct < 100 && style.end < Date.now();
                  const palette = EPIC_COLORS[idx % EPIC_COLORS.length];
                  const statusLabel = overdue ? "Overdue" : pct === 100 ? "Done" : pct === 0 ? "Not started" : "In progress";
                  const statusCls = overdue
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/25"
                    : pct === 100
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                    : pct === 0
                    ? "bg-muted text-muted-foreground border-border"
                    : "bg-sky-500/10 text-sky-500 border-sky-500/25";

                  return (
                    <div
                      key={e.id}
                      className="grid items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                      style={{ gridTemplateColumns: `${LABEL_COL} 1fr` }}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", palette.dot)} />
                          <p className="text-xs font-semibold text-foreground truncate">{e.title}</p>
                        </div>
                        {e.description && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{e.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-semibold", statusCls)}>{statusLabel}</span>
                          <span className="text-[9px] text-muted-foreground">
                            {e.key ?? ""} · {done}/{childIssues.length} issues{points > 0 ? ` · ${points} pts` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="relative h-8 rounded-lg bg-muted/30">
                        <div
                          className={cn("absolute top-0 h-8 rounded-lg flex items-center px-2.5 overflow-hidden border border-white/10", palette.track)}
                          style={{ left: style.left, width: style.width }}
                        >
                          <div className={cn("absolute inset-y-0 left-0 rounded-lg", palette.fill)} style={{ width: `${pct}%` }} />
                          <span className="relative text-[9px] font-semibold text-foreground/90 truncate">
                            {e.title} · {pct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
