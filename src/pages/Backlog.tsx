import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Sparkles, Trash2, Loader2, X, Check, Layers, CalendarRange } from "lucide-react";
import {
  api, type Project, type Epic, type Sprint, type Task, type DraftIssue, type IssueType,
} from "@/lib/api";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const ISSUE_TYPES: IssueType[] = ["story", "task", "bug", "subtask"];
const TYPE_CLS: Record<string, string> = {
  epic: "bg-purple-500/15 text-purple-500",
  story: "bg-emerald-500/15 text-emerald-500",
  task: "bg-sky-500/15 text-sky-500",
  bug: "bg-rose-500/15 text-rose-500",
  subtask: "bg-muted text-muted-foreground",
};

export default function Backlog() {
  const { key: projectKey = "" } = useParams<{ key: string }>();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | undefined>();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [projects, allEpics, allSprints, allTasks] = await Promise.all([
        api.listProjects(), api.listEpics(), api.listSprints(), api.listTasks(),
      ]);
      const proj = projects.find((p) => p.key === projectKey);
      setProject(proj);
      setEpics(allEpics.filter((e) => e.projectId === proj?.id));
      setSprints(allSprints.filter((s) => s.projectId === proj?.id));
      setIssues(allTasks.filter((t) => t.projectId === proj?.id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [projectKey]);

  const epicById = useMemo(() => new Map(epics.map((e) => [e.id, e])), [epics]);

  const moveIssueToSprint = async (issue: Task, sprintId: string | null) => {
    try {
      await api.upsertTask({ ...issue, sprintId });
      await load();
    } catch (e) {
      toast({ title: "Could not move issue", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const deleteIssue = async (issue: Task) => {
    if (!confirm(`Delete ${issue.issueKey || "issue"}?`)) return;
    await api.deleteTask(issue.id);
    await load();
  };

  const groups = useMemo(() => {
    const bySprint = new Map<string, Task[]>();
    const backlog: Task[] = [];
    for (const issue of issues) {
      if (issue.sprintId) {
        const arr = bySprint.get(issue.sprintId) ?? [];
        arr.push(issue);
        bySprint.set(issue.sprintId, arr);
      } else {
        backlog.push(issue);
      }
    }
    return { bySprint, backlog };
  }, [issues]);

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <ProjectSubnav project={project} projectKey={projectKey} active="backlog">
        <div className="flex items-center gap-2">
          <CreateSprintButton projectId={project?.id} onCreated={load} />
          <CreateEpicButton projectId={project?.id} onCreated={load} />
          <CreateIssueButton project={project} epics={epics} sprints={sprints} onCreated={load} />
          <PlannerButton project={project} epics={epics} sprints={sprints} onCommitted={load} />
        </div>
      </ProjectSubnav>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-10">Loading…</div>
        ) : !project ? (
          <div className="text-center text-muted-foreground text-sm py-10">Project "{projectKey}" not found.</div>
        ) : (
          <>
            {sprints.map((s) => (
              <SprintSection
                key={s.id}
                title={s.name}
                subtitle={s.goal}
                badge={s.status}
                issues={groups.bySprint.get(s.id) ?? []}
                sprints={sprints}
                epicById={epicById}
                onMove={moveIssueToSprint}
                onDelete={deleteIssue}
              />
            ))}
            <SprintSection
              title="Backlog"
              subtitle="Issues not yet planned into a sprint"
              issues={groups.backlog}
              sprints={sprints}
              epicById={epicById}
              onMove={moveIssueToSprint}
              onDelete={deleteIssue}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SprintSection({
  title, subtitle, badge, issues, sprints, epicById, onMove, onDelete,
}: {
  title: string; subtitle?: string; badge?: string; issues: Task[]; sprints: Sprint[];
  epicById: Map<string, Epic>; onMove: (i: Task, s: string | null) => void; onDelete: (i: Task) => void;
}) {
  const points = issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
  return (
    <div className="rounded-xl border border-border/50 bg-card/40">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
        <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-bold text-foreground">{title}</h3>
        {badge && <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-semibold uppercase text-muted-foreground">{badge}</span>}
        {subtitle && <span className="text-[10px] text-muted-foreground truncate">· {subtitle}</span>}
        <span className="ml-auto text-[10px] text-muted-foreground">{issues.length} issues · {points} pts</span>
      </div>
      {issues.length === 0 ? (
        <p className="px-4 py-3 text-[11px] text-muted-foreground italic">No issues</p>
      ) : (
        <div className="divide-y divide-border/30">
          {issues.map((issue) => {
            const epic = issue.epicId ? epicById.get(issue.epicId) : undefined;
            return (
              <div key={issue.id} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 group">
                <span className={cn("px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0", TYPE_CLS[issue.issueType ?? "task"])}>
                  {(issue.issueType ?? "task").slice(0, 4)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-16">{issue.issueKey}</span>
                <span className="text-xs text-foreground truncate flex-1">{issue.title}</span>
                {epic && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 shrink-0">{epic.title}</span>}
                {issue.storyPoints != null && (
                  <span className="text-[9px] font-bold text-foreground/70 w-5 text-center shrink-0">{issue.storyPoints}</span>
                )}
                <Select
                  value={issue.sprintId ?? NONE}
                  onValueChange={(v) => onMove(issue, v === NONE ? null : v)}
                >
                  <SelectTrigger className="h-7 w-[120px] text-[10px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Backlog</SelectItem>
                    {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => onDelete(issue)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateSprintButton({ projectId, onCreated }: { projectId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const save = async () => {
    if (!projectId || !name.trim()) return;
    await api.upsertSprint({ projectId, name: name.trim(), goal: goal.trim(), status: "planned" });
    setName(""); setGoal(""); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 gap-1 text-xs" disabled={!projectId}><Plus className="w-3.5 h-3.5" /> Sprint</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Sprint</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Sprint name (e.g. Sprint 1)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Sprint goal (optional)" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Button onClick={save} className="w-full" disabled={!name.trim()}>Create Sprint</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateEpicButton({ projectId, onCreated }: { projectId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const save = async () => {
    if (!projectId || !title.trim()) return;
    await api.upsertEpic({ projectId, title: title.trim(), description: description.trim() });
    setTitle(""); setDescription(""); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 gap-1 text-xs" disabled={!projectId}><Layers className="w-3.5 h-3.5" /> Epic</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Epic</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Epic title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none min-h-[70px]" />
          <Button onClick={save} className="w-full" disabled={!title.trim()}>Create Epic</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateIssueButton({ project, epics, sprints, onCreated }: { project?: Project; epics: Epic[]; sprints: Sprint[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>("task");
  const [epicId, setEpicId] = useState(NONE);
  const [sprintId, setSprintId] = useState(NONE);
  const [points, setPoints] = useState("");
  const save = async () => {
    if (!project || !title.trim()) return;
    await api.upsertTask({
      title: title.trim(),
      description: description.trim(),
      status: "pending",
      projectId: project.id,
      issueType: type,
      epicId: epicId === NONE ? null : epicId,
      sprintId: sprintId === NONE ? null : sprintId,
      storyPoints: points ? Number(points) : null,
    });
    setTitle(""); setDescription(""); setType("task"); setEpicId(NONE); setSprintId(NONE); setPoints("");
    setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1 text-xs" disabled={!project}><Plus className="w-3.5 h-3.5" /> Issue</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Issue</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Issue title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none min-h-[70px]" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={type} onValueChange={(v) => setType(v as IssueType)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{ISSUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" min={0} placeholder="Story points" value={points} onChange={(e) => setPoints(e.target.value)} className="h-9 text-xs" />
            <Select value={epicId} onValueChange={setEpicId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Epic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No epic</SelectItem>
                {epics.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sprint" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Backlog</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} className="w-full" disabled={!title.trim()}>Create Issue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlannerButton({ project, epics, sprints, onCommitted }: { project?: Project; epics: Epic[]; sprints: Sprint[]; onCommitted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [count, setCount] = useState("8");
  const [epicId, setEpicId] = useState(NONE);
  const [sprintId, setSprintId] = useState(NONE);
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [drafts, setDrafts] = useState<DraftIssue[] | null>(null);

  const generate = async () => {
    if (!project || !description.trim()) return;
    setGenerating(true);
    try {
      const res = await api.plannerDecompose({
        projectId: project.id,
        epicId: epicId === NONE ? null : epicId,
        description: description.trim(),
        count: Number(count) || 8,
      });
      setDrafts(res.issues);
      if (res.issues.length === 0) toast({ title: "Planner returned no issues", description: "Try a more detailed description." });
    } catch (e) {
      toast({ title: "Planner failed", description: String((e as Error).message ?? e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const commit = async () => {
    if (!project || !drafts || drafts.length === 0) return;
    setCommitting(true);
    try {
      await api.plannerCommit({
        projectId: project.id,
        epicId: epicId === NONE ? null : epicId,
        sprintId: sprintId === NONE ? null : sprintId,
        issues: drafts,
      });
      setDrafts(null);
      setDescription("");
      setOpen(false);
      onCommitted();
      toast({ title: "Issues created", description: `${drafts.length} issues added to the backlog.` });
    } catch (e) {
      toast({ title: "Commit failed", description: String((e as Error).message ?? e), variant: "destructive" });
    } finally {
      setCommitting(false);
    }
  };

  const updateDraft = (i: number, patch: Partial<DraftIssue>) =>
    setDrafts((prev) => prev ? prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) : prev);
  const removeDraft = (i: number) => setDrafts((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);

  const noPlanner = project && !project.plannerAgentId && !project.plannerSystemPrompt;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDrafts(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="h-9 gap-1 text-xs" disabled={!project}>
          <Sparkles className="w-3.5 h-3.5" /> Generate with planner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>AI Planner — decompose into issues</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          {noPlanner && (
            <p className="text-[11px] text-amber-500 bg-amber-500/10 rounded px-3 py-2">
              No planner agent is set for this project — a generic planner will be used. Configure one in the project settings for tailored results.
            </p>
          )}
          <Textarea
            placeholder="Describe the feature, epic, or project to break down into issues…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none min-h-[90px] text-xs"
          />
          <div className="grid grid-cols-3 gap-3">
            <Input type="number" min={1} max={30} placeholder="Count" value={count} onChange={(e) => setCount(e.target.value)} className="h-9 text-xs" />
            <Select value={epicId} onValueChange={setEpicId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Epic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No epic</SelectItem>
                {epics.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sprint" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Backlog</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} variant="secondary" className="w-full gap-1.5" disabled={!description.trim() || generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Generating…" : drafts ? "Regenerate" : "Generate draft"}
          </Button>

          {drafts && (
            <div className="border border-border/50 rounded-lg max-h-[260px] overflow-y-auto divide-y divide-border/30">
              {drafts.length === 0 && <p className="p-3 text-[11px] text-muted-foreground italic">No issues — adjust the description and regenerate.</p>}
              {drafts.map((d, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <Select value={d.type} onValueChange={(v) => updateDraft(i, { type: v as IssueType })}>
                    <SelectTrigger className="h-7 w-[90px] text-[10px] shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>{ISSUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={d.title} onChange={(e) => updateDraft(i, { title: e.target.value })} className="h-7 text-xs flex-1" />
                  <Input
                    type="number" min={0} value={d.storyPoints ?? ""}
                    onChange={(e) => updateDraft(i, { storyPoints: e.target.value ? Number(e.target.value) : null })}
                    className="h-7 w-12 text-[10px] shrink-0" placeholder="pts"
                  />
                  <button onClick={() => removeDraft(i)} className="p-1 text-muted-foreground hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}

          {drafts && drafts.length > 0 && (
            <Button onClick={commit} className="w-full gap-1.5" disabled={committing}>
              {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Commit {drafts.length} issues
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
