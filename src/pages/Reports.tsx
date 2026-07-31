import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { api, type Project, type Sprint, type Task } from "@/lib/api";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { Card } from "@/components/ui/card";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { cn } from "@/lib/utils";

const STATUS_META: { key: string; label: string; cls: string }[] = [
  { key: "pending", label: "To Do", cls: "bg-muted-foreground/40" },
  { key: "in-progress", label: "In Progress", cls: "bg-primary" },
  { key: "in-review", label: "In Review", cls: "bg-violet-500" },
  { key: "paused", label: "Paused", cls: "bg-amber-500" },
  { key: "stopped", label: "Stopped", cls: "bg-rose-500" },
  { key: "completed", label: "Done", cls: "bg-emerald-500" },
];

const TYPE_META: { key: string; label: string; cls: string }[] = [
  { key: "story", label: "Story", cls: "bg-emerald-500" },
  { key: "task", label: "Task", cls: "bg-sky-500" },
  { key: "bug", label: "Bug", cls: "bg-rose-500" },
  { key: "subtask", label: "Subtask", cls: "bg-muted-foreground/50" },
  { key: "epic", label: "Epic", cls: "bg-purple-500" },
];

export default function Reports() {
  const { key: projectKey = "" } = useParams<{ key: string }>();
  const scope = useCompanyScope();
  const [project, setProject] = useState<Project | undefined>();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scope.pending) return;
    let cancelled = false;
    (async () => {
      try {
        const [projects, allSprints, allTasks] = await Promise.all([
          api.listProjects(scope.isOverall ? undefined : scope.company?.id),
          api.listSprints(),
          api.listTasks(),
        ]);
        if (cancelled) return;
        const proj = projects.find((p) => p.key === projectKey);
        setProject(proj);
        setSprints(allSprints.filter((s) => s.projectId === proj?.id));
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

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of issues) m[t.status] = (m[t.status] ?? 0) + 1;
    return m;
  }, [issues]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of issues) m[t.issueType ?? "task"] = (m[t.issueType ?? "task"] ?? 0) + 1;
    return m;
  }, [issues]);

  const pointsBySprint = useMemo(() => {
    return sprints.map((s) => {
      const sprintIssues = issues.filter((t) => t.sprintId === s.id);
      const total = sprintIssues.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
      const done = sprintIssues.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
      return { sprint: s, total, done };
    });
  }, [sprints, issues]);

  const totalIssues = issues.length;
  const completed = statusCounts["completed"] ?? 0;
  const totalPoints = issues.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const donePoints = issues.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const maxStatus = Math.max(1, ...STATUS_META.map((s) => statusCounts[s.key] ?? 0));

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <ProjectSubnav project={project} projectKey={projectKey} active="reports" />
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-10">Loading…</div>
        ) : totalIssues === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No issues to report on yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total issues" value={totalIssues} />
              <StatCard label="Completed" value={`${completed} (${Math.round((completed / totalIssues) * 100)}%)`} />
              <StatCard label="Story points" value={totalPoints} />
              <StatCard label="Points done" value={`${donePoints} (${totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0}%)`} />
            </div>

            <Card className="p-4">
              <h3 className="text-xs font-bold text-foreground mb-3">Status breakdown</h3>
              <div className="space-y-2">
                {STATUS_META.map((s) => {
                  const count = statusCounts[s.key] ?? 0;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{s.label}</span>
                      <div className="flex-1 h-4 rounded bg-muted/40 overflow-hidden">
                        <div className={cn("h-4 rounded", s.cls)} style={{ width: `${(count / maxStatus) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold text-foreground/70 w-6 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-xs font-bold text-foreground mb-3">Issue types</h3>
                <div className="flex flex-wrap gap-3">
                  {TYPE_META.filter((t) => (typeCounts[t.key] ?? 0) > 0).map((t) => (
                    <div key={t.key} className="flex items-center gap-1.5">
                      <span className={cn("w-2.5 h-2.5 rounded-full", t.cls)} />
                      <span className="text-[11px] text-muted-foreground">{t.label}</span>
                      <span className="text-[11px] font-bold text-foreground">{typeCounts[t.key]}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-xs font-bold text-foreground mb-3">Velocity by sprint (points)</h3>
                {pointsBySprint.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No sprints yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pointsBySprint.map(({ sprint, total, done }) => (
                      <div key={sprint.id} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-24 truncate shrink-0">{sprint.name}</span>
                        <div className="flex-1 h-4 rounded bg-muted/40 overflow-hidden relative">
                          <div className="h-4 bg-primary/30" style={{ width: `${total ? 100 : 0}%` }} />
                          <div className="h-4 bg-emerald-500 absolute top-0 left-0" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-foreground/70 w-12 text-right shrink-0">{done}/{total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </Card>
  );
}
