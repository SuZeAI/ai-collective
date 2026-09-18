import { memo, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Sparkles, Trash2, Pencil, Loader2, X, Check, Layers, CalendarRange } from "lucide-react";
import {
  api, type Project, type Epic, type Sprint, type SprintStatus, type Task, type DraftIssue, type IssueType,
} from "@/lib/api";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useScopedProject } from "@/hooks/use-scoped-project";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t: lang } = useLanguage();
  const fetchRelated = useCallback(async () => {
    const [epics, sprints, issues] = await Promise.all([api.listEpics(), api.listSprints(), api.listTasks()]);
    return { epics, sprints, issues };
  }, []);
  const { project, data, loading, reload: load } = useScopedProject(projectKey, fetchRelated);
  const { epics = [], sprints = [], issues = [] } = data;

  const epicById = useMemo(() => new Map(epics.map((e) => [e.id, e])), [epics]);

  const moveIssueToSprint = useCallback(async (issue: Task, sprintId: string | null) => {
    try {
      await api.upsertTask({ ...issue, sprintId });
      await load();
    } catch (e) {
      toast({ title: lang.backlogPage.couldNotMoveIssue, description: String((e as Error).message ?? e), variant: "destructive" });
    }
  }, [toast, load, lang]);

  const deleteIssue = useCallback(async (issue: Task) => {
    if (!confirm(`${lang.backlogPage.deleteConfirmPrefix}${issue.issueKey || lang.backlogPage.issueFallback}?`)) return;
    await api.deleteTask(issue.id);
    await load();
  }, [load, lang]);

  const [sprintDialog, setSprintDialog] = useState<{ open: boolean; sprint: Sprint | null }>({ open: false, sprint: null });
  const [epicDialog, setEpicDialog] = useState<{ open: boolean; epic: Epic | null }>({ open: false, epic: null });

  const deleteSprint = useCallback(async (sprint: Sprint) => {
    if (!confirm(`${lang.backlogPage.deleteConfirmPrefix}${sprint.name}?`)) return;
    await api.deleteSprint(sprint.id);
    await load();
  }, [load, lang]);

  const deleteEpic = useCallback(async (epic: Epic) => {
    if (!confirm(`${lang.backlogPage.deleteConfirmPrefix}${epic.title}?`)) return;
    await api.deleteEpic(epic.id);
    await load();
  }, [load, lang]);

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
          <Button size="sm" variant="outline" className="h-9 gap-1 text-xs" disabled={!project?.id} onClick={() => setSprintDialog({ open: true, sprint: null })}>
            <Plus className="w-3.5 h-3.5" /> {lang.backlogPage.sprintBtnLabel}
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1 text-xs" disabled={!project?.id} onClick={() => setEpicDialog({ open: true, epic: null })}>
            <Layers className="w-3.5 h-3.5" /> {lang.backlogPage.epicBtnLabel}
          </Button>
          <CreateIssueButton project={project} epics={epics} sprints={sprints} onCreated={load} />
          <PlannerButton project={project} epics={epics} sprints={sprints} onCommitted={load} />
        </div>
      </ProjectSubnav>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-10">{lang.backlogPage.loadingText}</div>
        ) : !project ? (
          <div className="text-center text-muted-foreground text-sm py-10">{lang.backlogPage.projectNotFoundPrefix}{projectKey}{lang.backlogPage.projectNotFoundSuffix}</div>
        ) : (
          <>
            <EpicsBar
              epics={epics}
              onEdit={(epic) => setEpicDialog({ open: true, epic })}
              onDelete={deleteEpic}
            />
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
                onEditSprint={() => setSprintDialog({ open: true, sprint: s })}
                onDeleteSprint={() => deleteSprint(s)}
              />
            ))}
            <SprintSection
              title={lang.backlogPage.backlogTitle}
              subtitle={lang.backlogPage.backlogSubtitle}
              issues={groups.backlog}
              sprints={sprints}
              epicById={epicById}
              onMove={moveIssueToSprint}
              onDelete={deleteIssue}
            />
          </>
        )}
      </div>

      <SprintDialog
        projectId={project?.id}
        sprint={sprintDialog.sprint}
        open={sprintDialog.open}
        onOpenChange={(open) => setSprintDialog((d) => ({ ...d, open }))}
        onSaved={load}
      />
      <EpicDialog
        projectId={project?.id}
        epic={epicDialog.epic}
        open={epicDialog.open}
        onOpenChange={(open) => setEpicDialog((d) => ({ ...d, open }))}
        onSaved={load}
      />
    </div>
  );
}

// Memoized so moving/deleting an issue in one sprint section doesn't
// re-render every other section's rows too — each row only re-renders when
// its own issue, the epic it links to, or the sprint list actually changes
// (onMove/onDelete are stable useCallback refs from the parent).
const IssueRow = memo(function IssueRow({
  issue, sprints, epic, onMove, onDelete,
}: {
  issue: Task; sprints: Sprint[]; epic?: Epic;
  onMove: (i: Task, s: string | null) => void; onDelete: (i: Task) => void;
}) {
  const { t: lang } = useLanguage();
  return (
    <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 group">
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
          <SelectItem value={NONE}>{lang.backlogPage.backlogTitle}</SelectItem>
          {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <button onClick={() => onDelete(issue)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500" title={lang.backlogPage.deleteBtnTitle}>
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
});

const SprintSection = memo(function SprintSection({
  title, subtitle, badge, issues, sprints, epicById, onMove, onDelete, onEditSprint, onDeleteSprint,
}: {
  title: string; subtitle?: string; badge?: string; issues: Task[]; sprints: Sprint[];
  epicById: Map<string, Epic>; onMove: (i: Task, s: string | null) => void; onDelete: (i: Task) => void;
  onEditSprint?: () => void; onDeleteSprint?: () => void;
}) {
  const { t: lang } = useLanguage();
  const points = issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 group/sprint">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
        <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-bold text-foreground">{title}</h3>
        {badge && <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-semibold uppercase text-muted-foreground">{badge}</span>}
        {subtitle && <span className="text-[10px] text-muted-foreground truncate">· {subtitle}</span>}
        <span className="ml-auto text-[10px] text-muted-foreground">{issues.length} {lang.backlogPage.issuesLabel} · {points} {lang.backlogPage.ptsLabel}</span>
        {onEditSprint && (
          <button onClick={onEditSprint} className="p-1 rounded opacity-0 group-hover/sprint:opacity-100 text-muted-foreground hover:text-foreground" title={lang.backlogPage.editBtnTitle}>
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {onDeleteSprint && (
          <button onClick={onDeleteSprint} className="p-1 rounded opacity-0 group-hover/sprint:opacity-100 text-muted-foreground hover:text-rose-500" title={lang.backlogPage.deleteBtnTitle}>
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {issues.length === 0 ? (
        <p className="px-4 py-3 text-[11px] text-muted-foreground italic">{lang.backlogPage.noIssuesText}</p>
      ) : (
        <div className="divide-y divide-border/30">
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              sprints={sprints}
              epic={issue.epicId ? epicById.get(issue.epicId) : undefined}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const SPRINT_STATUSES: SprintStatus[] = ["planned", "active", "completed"];

function EpicsBar({ epics, onEdit, onDelete }: { epics: Epic[]; onEdit: (e: Epic) => void; onDelete: (e: Epic) => void }) {
  const { t: lang } = useLanguage();
  if (epics.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card/40">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-bold text-foreground">{lang.backlogPage.epicsListTitle}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {epics.map((epic) => (
          <div key={epic.id} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 group">
            <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 bg-purple-500/15 text-purple-500">epic</span>
            <span className="text-xs text-foreground truncate flex-1">{epic.title}</span>
            {epic.description && <span className="text-[10px] text-muted-foreground truncate max-w-[280px]">{epic.description}</span>}
            <button onClick={() => onEdit(epic)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0" title={lang.backlogPage.editBtnTitle}>
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(epic)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 shrink-0" title={lang.backlogPage.deleteBtnTitle}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SprintDialog({ projectId, sprint, open, onOpenChange, onSaved }: {
  projectId?: string; sprint: Sprint | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const { t: lang } = useLanguage();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<SprintStatus>("planned");
  const handleOpenChange = (o: boolean) => {
    if (o) { setName(sprint?.name ?? ""); setGoal(sprint?.goal ?? ""); setStatus(sprint?.status ?? "planned"); }
    onOpenChange(o);
  };
  const save = async () => {
    if (!projectId || !name.trim()) return;
    await api.upsertSprint({ id: sprint?.id, projectId, name: name.trim(), goal: goal.trim(), status });
    onOpenChange(false); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{sprint ? lang.backlogPage.editSprintTitle : lang.backlogPage.newSprintTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder={lang.backlogPage.sprintNamePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder={lang.backlogPage.sprintGoalPlaceholder} value={goal} onChange={(e) => setGoal(e.target.value)} />
          {sprint && (
            <Select value={status} onValueChange={(v) => setStatus(v as SprintStatus)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPRINT_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st === "planned" ? lang.backlogPage.sprintStatusPlanned : st === "active" ? lang.backlogPage.sprintStatusActive : lang.backlogPage.sprintStatusCompleted}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={save} className="w-full" disabled={!name.trim()}>
            {sprint ? lang.backlogPage.saveBtn : lang.backlogPage.createSprintBtn}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EpicDialog({ projectId, epic, open, onOpenChange, onSaved }: {
  projectId?: string; epic: Epic | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const { t: lang } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const handleOpenChange = (o: boolean) => {
    if (o) { setTitle(epic?.title ?? ""); setDescription(epic?.description ?? ""); }
    onOpenChange(o);
  };
  const save = async () => {
    if (!projectId || !title.trim()) return;
    await api.upsertEpic({ id: epic?.id, projectId, title: title.trim(), description: description.trim() });
    onOpenChange(false); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{epic ? lang.backlogPage.editEpicTitle : lang.backlogPage.newEpicTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder={lang.backlogPage.epicTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder={lang.backlogPage.descriptionOptionalPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none min-h-[70px]" />
          <Button onClick={save} className="w-full" disabled={!title.trim()}>
            {epic ? lang.backlogPage.saveBtn : lang.backlogPage.createEpicBtn}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateIssueButton({ project, epics, sprints, onCreated }: { project?: Project; epics: Epic[]; sprints: Sprint[]; onCreated: () => void }) {
  const { t: lang } = useLanguage();
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
        <Button size="sm" className="h-9 gap-1 text-xs" disabled={!project}><Plus className="w-3.5 h-3.5" /> {lang.backlogPage.issueBtnLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{lang.backlogPage.newIssueTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder={lang.backlogPage.issueTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder={lang.backlogPage.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none min-h-[70px]" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={type} onValueChange={(v) => setType(v as IssueType)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{ISSUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" min={0} placeholder={lang.backlogPage.storyPointsPlaceholder} value={points} onChange={(e) => setPoints(e.target.value)} className="h-9 text-xs" />
            <Select value={epicId} onValueChange={setEpicId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={lang.backlogPage.epicSelectPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{lang.backlogPage.noEpicOption}</SelectItem>
                {epics.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={lang.backlogPage.sprintSelectPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{lang.backlogPage.backlogTitle}</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} className="w-full" disabled={!title.trim()}>{lang.backlogPage.createIssueBtn}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlannerButton({ project, epics, sprints, onCommitted }: { project?: Project; epics: Epic[]; sprints: Sprint[]; onCommitted: () => void }) {
  const { toast } = useToast();
  const { t: lang } = useLanguage();
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
      if (res.issues.length === 0) toast({ title: lang.backlogPage.plannerNoIssuesTitle, description: lang.backlogPage.plannerNoIssuesDesc });
    } catch (e) {
      toast({ title: lang.backlogPage.plannerFailedTitle, description: String((e as Error).message ?? e), variant: "destructive" });
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
      toast({ title: lang.backlogPage.issuesCreatedTitle, description: `${drafts.length}${lang.backlogPage.issuesCreatedDescSuffix}` });
    } catch (e) {
      toast({ title: lang.backlogPage.commitFailedTitle, description: String((e as Error).message ?? e), variant: "destructive" });
    } finally {
      setCommitting(false);
    }
  };

  const updateDraft = (i: number, patch: Partial<DraftIssue>) =>
    setDrafts((prev) => prev ? prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) : prev);
  const removeDraft = (i: number) => setDrafts((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);

  const noPlanner = project && !project.plannerStaffId && !project.plannerSystemPrompt;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDrafts(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="h-9 gap-1 text-xs" disabled={!project}>
          <Sparkles className="w-3.5 h-3.5" /> {lang.backlogPage.generateWithPlannerBtn}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{lang.backlogPage.aiPlannerTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          {noPlanner && (
            <p className="text-[11px] text-amber-500 bg-amber-500/10 rounded px-3 py-2">
              {lang.backlogPage.noPlannerWarning}
            </p>
          )}
          <Textarea
            placeholder={lang.backlogPage.describePlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none min-h-[90px] text-xs"
          />
          <div className="grid grid-cols-3 gap-3">
            <Input type="number" min={1} max={30} placeholder={lang.backlogPage.countPlaceholder} value={count} onChange={(e) => setCount(e.target.value)} className="h-9 text-xs" />
            <Select value={epicId} onValueChange={setEpicId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={lang.backlogPage.epicSelectPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{lang.backlogPage.noEpicOption}</SelectItem>
                {epics.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={lang.backlogPage.sprintSelectPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{lang.backlogPage.backlogTitle}</SelectItem>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} variant="secondary" className="w-full gap-1.5" disabled={!description.trim() || generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? lang.backlogPage.generatingBtn : drafts ? lang.backlogPage.regenerateBtn : lang.backlogPage.generateDraftBtn}
          </Button>

          {drafts && (
            <div className="border border-border/50 rounded-lg max-h-[260px] overflow-y-auto divide-y divide-border/30">
              {drafts.length === 0 && <p className="p-3 text-[11px] text-muted-foreground italic">{lang.backlogPage.noIssuesAdjustText}</p>}
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
                    className="h-7 w-12 text-[10px] shrink-0" placeholder={lang.backlogPage.ptsPlaceholder}
                  />
                  <button onClick={() => removeDraft(i)} className="p-1 text-muted-foreground hover:text-rose-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}

          {drafts && drafts.length > 0 && (
            <Button onClick={commit} className="w-full gap-1.5" disabled={committing}>
              {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {lang.backlogPage.commitIssuesBtnPrefix}{drafts.length}{lang.backlogPage.commitIssuesBtnSuffix}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
