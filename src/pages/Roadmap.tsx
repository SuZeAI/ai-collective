import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Map as MapIcon } from "lucide-react";
import { api, type Project, type Epic, type Task } from "@/lib/api";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { cn } from "@/lib/utils";

const DAY = 86400000;

export default function Roadmap() {
  const { key: projectKey = "" } = useParams<{ key: string }>();
  const scope = useCompanyScope();
  const [project, setProject] = useState<Project | undefined>();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [issues, setIssues] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scope.pending) return;
    let cancelled = false;
    (async () => {
      try {
        const [projects, allEpics, allTasks] = await Promise.all([
          api.listProjects(scope.isOverall ? undefined : scope.company?.id),
          api.listEpics(),
          api.listTasks(),
        ]);
        if (cancelled) return;
        // Project belongs to another office — same guard as an unknown key.
        const proj = projects.find((p) => p.key === projectKey);
        setProject(proj);
        setEpics(allEpics.filter((e) => e.projectId === proj?.id));
        setIssues(allTasks.filter((t) => t.projectId === proj?.id));
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectKey, scope.pending, scope.isOverall, scope.company?.id]);

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
    return { left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - Math.max(0, left))}%` };
  };

  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <ProjectSubnav project={project} projectKey={projectKey} active="roadmap" />
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-10">Loading…</div>
        ) : epics.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <MapIcon className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No epics yet</p>
            <p className="text-xs mt-1">Create epics (with start/due dates) in the Backlog to see them on the roadmap.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pb-1">
              <span>{fmt(windowStart)}</span>
              <span>Timeline</span>
              <span>{fmt(windowEnd)}</span>
            </div>
            {epics.map((e, idx) => {
              const childIssues = issuesByEpic.get(e.id) ?? [];
              const done = childIssues.filter((t) => t.status === "completed").length;
              const pct = childIssues.length ? Math.round((done / childIssues.length) * 100) : 0;
              const style = barFor(e);
              return (
                <div key={e.id} className="grid grid-cols-[180px_1fr] gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{e.title}</p>
                    <p className="text-[9px] text-muted-foreground">{e.key} · {childIssues.length} issues · {pct}%</p>
                  </div>
                  <div className="relative h-7 rounded-md bg-muted/40">
                    <div
                      className={cn("absolute top-0 h-7 rounded-md flex items-center px-2 overflow-hidden",
                        idx % 4 === 0 ? "bg-purple-500/30" : idx % 4 === 1 ? "bg-sky-500/30" : idx % 4 === 2 ? "bg-emerald-500/30" : "bg-amber-500/30")}
                      style={style}
                    >
                      <div className="absolute inset-y-0 left-0 bg-foreground/10 rounded-md" style={{ width: `${pct}%` }} />
                      <span className="relative text-[9px] font-medium text-foreground/80 truncate">{e.title}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
