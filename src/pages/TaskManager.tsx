import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, CheckCircle2, Clock, Circle, Pause, Play, Square, Pencil, Trash2, X, Eye, Send, UserRound, Hand, HelpCircle, Zap, LayoutGrid, Flag, CalendarClock, Tag, Building2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { StaffAvatar } from "@/components/StaffAvatar";
import { AppendFromOverallDialog } from "@/components/AppendFromOverallDialog";
import { MeetingFiles } from "@/components/MeetingFiles";
import { api, buildCustomGraphPayload, canDeleteItem, canEditItem, type Staff, type GraphContextSnapshot, type Message, type Department, type Task, type TaskPriority, type Project, type Sprint, type Epic } from "@/lib/api";
import { useRunEngine, type GraphHighlight, type UserInputRequest } from "@/contexts/RunEngineContext";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { getStaffRoleColor } from "@/lib/staff-role-ui";
import { cn } from "@/lib/utils";

const statusIcons = {
  "pending": Circle,
  "in-progress": Clock,
  "in-review": Eye,
  "paused": Pause,
  "stopped": Square,
  "completed": CheckCircle2,
};

const statusColors: Record<string, string> = {
  "pending": "text-muted-foreground",
  "in-progress": "text-primary",
  "in-review": "text-violet-500",
  "paused": "text-amber-500",
  "stopped": "text-rose-500",
  "completed": "text-staff-dev",
};

// Jira-style Kanban columns: one per task status. Dragging a card between
// columns drives the status transition (and auto-run for "In Progress").
// "In Review" is a manual column (a human reviews staff output before Done);
// the run engine never auto-emits it.
const BOARD_COLUMNS: { status: Task["status"]; label: string; accent: string }[] = [
  { status: "pending", label: "To Do", accent: "bg-muted-foreground/30" },
  { status: "in-progress", label: "In Progress", accent: "bg-primary" },
  { status: "in-review", label: "In Review", accent: "bg-violet-500" },
  { status: "paused", label: "Paused", accent: "bg-amber-500" },
  { status: "stopped", label: "Stopped", accent: "bg-rose-500" },
  { status: "completed", label: "Done", accent: "bg-emerald-500" },
];

// Issue-type → short glyph for board/backlog cards.
const ISSUE_TYPE_GLYPH: Record<string, { label: string; cls: string }> = {
  epic: { label: "Epic", cls: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  story: { label: "Story", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  task: { label: "Task", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  bug: { label: "Bug", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  subtask: { label: "Sub", cls: "bg-muted text-muted-foreground border-border" },
};

// Priority presentation. `order` drives sorting (urgent first) inside columns.
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string; dot: string; order: number }> = {
  urgent: { label: "Urgent", badge: "bg-rose-500/15 text-rose-500 border-rose-500/30", dot: "bg-rose-500", order: 0 },
  high: { label: "High", badge: "bg-orange-500/15 text-orange-500 border-orange-500/30", dot: "bg-orange-500", order: 1 },
  medium: { label: "Medium", badge: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500", order: 2 },
  low: { label: "Low", badge: "bg-sky-500/15 text-sky-500 border-sky-500/30", dot: "bg-sky-500", order: 3 },
};

const priorityOf = (task: Task): TaskPriority => (task.priority && PRIORITY_CONFIG[task.priority] ? task.priority : "medium");

const parseTaskDate = (value?: string | null) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const isOverdue = (dueDate?: string | null, status?: string) => {
  if (status === "completed") return false;
  const d = parseTaskDate(dueDate);
  return d ? d.getTime() < Date.now() : false;
};

const formatDueDate = (date: Date) =>
  date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

const formatDuration = (ms: number) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatTaskDateTime = (date: Date) => {
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// ---- Kanban board pieces ----------------------------------------------------

type KanbanCardProps = {
  task: Task;
  department?: Department;
  assignee?: Staff;
  progress: number;
  isSelected: boolean;
  isRunning: boolean;
  onOpen: (taskId: string) => void;
};

type KanbanCardBodyProps = {
  task: Task;
  department?: Department;
  assignee?: Staff;
  progress: number;
  isRunning?: boolean;
};

// Pure visual content, shared between the in-column draggable card and its
// DragOverlay clone (the overlay must not itself be draggable — see below).
function KanbanCardBody({ task, department, assignee, progress, isRunning }: KanbanCardBodyProps) {
  const priority = PRIORITY_CONFIG[priorityOf(task)];
  const dueDate = parseTaskDate(task.dueDate);
  const overdue = isOverdue(task.dueDate, task.status);
  const labels = task.labels ?? [];

  return (
    <>
      {(task.issueKey || task.issueType || task.storyPoints != null) && (
        <div className="flex items-center gap-1.5 mb-1.5">
          {task.issueType && (
            <span className={cn("px-1 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wide", (ISSUE_TYPE_GLYPH[task.issueType] ?? ISSUE_TYPE_GLYPH.task).cls)}>
              {(ISSUE_TYPE_GLYPH[task.issueType] ?? ISSUE_TYPE_GLYPH.task).label}
            </span>
          )}
          {task.issueKey && (
            <span className="text-[9px] font-mono font-semibold text-muted-foreground">{task.issueKey}</span>
          )}
          {task.storyPoints != null && (
            <span className="ml-auto inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-muted text-[9px] font-bold text-foreground/70" title="Story points">
              {task.storyPoints}
            </span>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-bold text-foreground/90 leading-snug line-clamp-2 flex-1">{task.title}</h4>
        <span className={cn("shrink-0 w-2 h-2 rounded-full mt-1", priority.dot)} title={`Priority: ${priority.label}`} />
      </div>

      {task.description && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
      )}

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {labels.slice(0, 4).map((label) => (
            <span key={label} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[9px] font-semibold text-muted-foreground">
              <Tag className="w-2 h-2" /> {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-border/20">
        <div className="flex items-center gap-1 min-w-0">
          {assignee ? (
            <>
              <StaffAvatar staff={assignee} className="w-4 h-4 rounded-md text-[8px] shrink-0" iconClassName="w-2.5 h-2.5" />
              <span className="text-[9px] text-muted-foreground truncate">{assignee.name}</span>
            </>
          ) : department ? (
            <>
              <StaffAvatar staff={department} className="w-4 h-4 rounded-md text-[8px] shrink-0" iconClassName="w-2.5 h-2.5" />
              <span className="text-[9px] text-muted-foreground truncate">{department.name}</span>
            </>
          ) : (
            <span className="text-[9px] text-muted-foreground truncate">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning && (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-primary">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              Running
            </span>
          )}
          <span className="text-[9px] font-semibold text-foreground/75">{progress}%</span>
        </div>
      </div>

      {dueDate && (
        <div className={cn("flex items-center gap-1 mt-2 text-[9px] font-medium", overdue ? "text-rose-500" : "text-muted-foreground")}>
          <CalendarClock className="w-2.5 h-2.5" />
          {formatDueDate(dueDate)} {overdue ? "· overdue" : ""}
        </div>
      )}
    </>
  );
}

const KanbanCard = memo(function KanbanCard({ task, department, assignee, progress, isSelected, isRunning, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task.id)}
      className={cn(
        "rounded-xl border p-3 bg-card/70 cursor-grab active:cursor-grabbing transition-all group select-none",
        "hover:border-border/80 hover:bg-muted/30",
        // The dragged card is rendered by DragOverlay (portalled above everything
        // else) instead of moving this node in place — moving it via transform
        // kept it clipped inside its origin column's overflow-y-auto and behind
        // later columns in paint order. This one just fades out while dragging.
        isDragging ? "opacity-0" : "shadow-sm",
        isSelected
          ? "ring-1 ring-primary/40 border-accent-foreground/20"
          : isRunning
          ? "border-primary/50"
          : "border-border/40",
      )}
    >
      <KanbanCardBody task={task} department={department} assignee={assignee} progress={progress} isRunning={isRunning} />
    </div>
  );
});

type KanbanColumnProps = {
  status: Task["status"];
  label: string;
  accent: string;
  count: number;
  children: React.ReactNode;
};

function KanbanColumn({ status, label, accent, count, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col w-[300px] shrink-0 h-full">
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <span className={cn("w-2 h-2 rounded-full", accent)} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] font-semibold text-muted-foreground/70 bg-muted rounded-full px-1.5 py-0.5 ml-auto">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto rounded-xl p-2 space-y-2 scrollbar-thin transition-colors border border-dashed",
          isOver ? "bg-primary/5 border-primary/40" : "bg-muted/15 border-transparent",
        )}
      >
        {children}
        {count === 0 && (
          <div className="text-center py-6 text-[10px] text-muted-foreground/60">Drop a task here</div>
        )}
      </div>
    </div>
  );
}

export default function TaskManager() {
  const scope = useCompanyScope();
  // Shared run engine (lives above the router): owns the streaming loop and all
  // run-state so a task keeps running and stays in sync when navigating away.
  const engine = useRunEngine();
  const {
    tasks: taskList,
    meetings: taskConversations,
    thinkingStaff,
    activeFanouts,
    heldTaskIds,
    pendingInterjections,
    userInputRequests,
    loadingConversationTaskIds,
    updatingTaskIds,
    sendingInterjectTaskIds,
    holdTogglingTaskIds,
    respondingRequestIds,
    interjectErrors,
    isStreaming,
  } = engine;

  const [departmentList, setDepartmentList] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  // Project scoping: when reached via /projects/:key/board the board is filtered
  // to that project's issues and a sprint filter is offered. On the generic
  // /tasks board there's no URL project, so the same scoping is offered via a
  // Project/Epic/Sprint filter row instead (projectFilter/epicFilter/sprintFilter).
  const { key: projectKeyParam } = useParams<{ key?: string }>();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [epicList, setEpicList] = useState<Epic[]>([]);
  const [sprintList, setSprintList] = useState<Sprint[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [epicFilter, setEpicFilter] = useState<string>("all");
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const activeProject = useMemo(
    () => (projectKeyParam ? projectList.find((p) => p.key === projectKeyParam) : undefined),
    [projectKeyParam, projectList],
  );
  // The project actually filtering the board: the URL project when on a
  // project's own board route, otherwise whatever the dropdown picked.
  const projectScope = useMemo(
    () => activeProject ?? (projectFilter !== "all" ? projectList.find((p) => p.id === projectFilter) : undefined),
    [activeProject, projectFilter, projectList],
  );
  // Task creation belongs to a specific company (office) or a project board. The
  // global "Overall Collective" scope is monitoring-only, so the New Task button
  // is hidden there. Editing existing tasks stays available in every scope.
  const canCreateTask = !!activeProject || !scope.isOverall;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  // Jira-style create/edit form fields.
  const [assignMode, setAssignMode] = useState<"department" | "staff">("department");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
  // Human-in-the-loop composer draft and ask_user free-text drafts (UI-local).
  const [humanInputs, setHumanInputs] = useState<Record<string, string>>({});
  const [userRequestDrafts, setUserRequestDrafts] = useState<Record<string, string>>({});
  // User comment drafts per task (separate from the staff live-chat composer).
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // A small activation distance lets a plain click open the detail dialog while
  // an actual drag (>6px) starts the board move.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // The dragged card is rendered via DragOverlay (portalled to the document
  // body) instead of in place, so it isn't clipped by its origin column's
  // overflow-y-auto or painted behind later columns.
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tasks, departments, staff, projects, epics, sprints] = await Promise.all([
          api.listTasks(),
          api.listDepartments(),
          api.listStaff(),
          api.listProjects().catch(() => [] as Project[]),
          api.listEpics().catch(() => [] as Epic[]),
          api.listSprints().catch(() => [] as Sprint[]),
        ]);
        if (cancelled) return;
        // Reconcile with the engine: it keeps the lead for any task it's actively
        // streaming, and seeds meetings only where it has no live transcript.
        engine.ingestTasks(tasks);
        setDepartmentList(departments);
        setStaffList(staff);
        setProjectList(projects);
        setEpicList(epics);
        setSprintList(sprints);

        // Load meetings for all tasks
        if (tasks.length > 0) {
          try {
            const results = await Promise.all(
              tasks.map(async (task) => ({ id: task.id, messages: await api.listMeetings(task.id) }))
            );
            if (!cancelled) {
              for (const item of results) {
                engine.ingestMeetings(item.id, item.messages);
              }
            }
          } catch (e) {
            console.error("Failed to load meetings:", e);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staffById = useMemo(() => {
    const map = new Map<string, Staff>();
    staffList.forEach((a) => map.set(a.id, a));
    return map;
  }, [staffList]);

  // Staff the active office can pick for an individual ("staff") assignment.
  const scopedStaff = useMemo(() => {
    if (scope.isOverall) return staffList;
    const ids = new Set<string>();
    departmentList.filter((t) => scope.departmentIds.has(t.id)).forEach((t) => (t.staff ?? []).forEach((a) => ids.add(a)));
    return staffList.filter((a) => ids.has(a.id));
  }, [staffList, departmentList, scope]);

  // The engine is department-agnostic; the page supplies the department's run config. Tasks
  // assigned to an individual (no department) fall back to a single-staff sequential run.
  const departmentRunOpts = (task: Task) => {
    const department = departmentList.find((t) => t.id === task.departmentId);
    // Custom mode runs the user-drawn flow; if it was never wired, fall back to
    // sequential so the task still executes.
    const customGraph = department ? buildCustomGraphPayload(department) : undefined;
    const mode = department?.mode === "custom" && !customGraph ? "sequential" : (department?.mode ?? "sequential");
    return { mode, maxSteps: department?.maxSteps ?? 6, customGraph };
  };

  // Office scoping: a task belongs to the active office if its department is in
  // scope OR (for individual assignments without a department) its assignee is a
  // member of a department in scope. Projects have no office of their own (see
  // domain Project — no company_id field), so an issue keeps its department/
  // assignee empty; it's always visible instead of needing manual assignment.
  const isTaskInScope = (task: Task) => {
    if (scope.isOverall) return true;
    if (task.projectId) return true;
    if (task.departmentId && scope.departmentIds.has(task.departmentId)) return true;
    if (task.assigneeId) {
      return departmentList.some((t) => scope.departmentIds.has(t.id) && (t.staff ?? []).includes(task.assigneeId as string));
    }
    return false;
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return taskList.filter((task) => {
      // Scoped to a project (via URL or the Project filter dropdown): narrow to
      // that project's issues plus the optional epic/sprint filter, instead of
      // the office membership filter.
      if (projectScope) {
        if (task.projectId !== projectScope.id) return false;
        if (epicFilter !== "all" && (task.epicId ?? "") !== epicFilter) return false;
        if (sprintFilter === "__backlog__" && task.sprintId) return false;
        if (sprintFilter !== "all" && sprintFilter !== "__backlog__" && (task.sprintId ?? "") !== sprintFilter) return false;
      } else if (!isTaskInScope(task)) {
        return false;
      }
      if (!q) return true;
      const department = departmentList.find((t) => t.id === task.departmentId);
      const assignee = task.assigneeId ? staffById.get(task.assigneeId) : undefined;
      return (
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q) ||
        (department?.name ?? "").toLowerCase().includes(q) ||
        (assignee?.name ?? "").toLowerCase().includes(q) ||
        (task.labels ?? []).some((l) => l.toLowerCase().includes(q))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskList, departmentList, staffById, searchQuery, scope, projectScope, epicFilter, sprintFilter]);

  // Group the in-scope tasks into board columns, urgent priority first.
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = {
      "pending": [],
      "in-progress": [],
      "in-review": [],
      "paused": [],
      "stopped": [],
      "completed": [],
    };
    for (const task of filteredTasks) {
      (groups[task.status] ?? (groups[task.status] = [])).push(task);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => PRIORITY_CONFIG[priorityOf(a)].order - PRIORITY_CONFIG[priorityOf(b)].order);
    }
    return groups;
  }, [filteredTasks]);

  const taskIdParam = searchParams.get("id");

  useEffect(() => {
    if (scope.pending) return; // wait until office membership is resolved
    if (taskIdParam && taskList.length > 0) {
      const target = taskList.find((t) => t.id === taskIdParam);
      if (target && isTaskInScope(target)) {
        setViewTaskId(taskIdParam);
        void loadTaskGraphContext(taskIdParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdParam, taskList, scope]);

  // Switching office must never leave another office's task in the detail panel.
  useEffect(() => {
    if (!scope.ready || scope.isOverall || !viewTaskId) return;
    const current = taskList.find((t) => t.id === viewTaskId);
    if (current && !isTaskInScope(current)) {
      setViewTaskId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, viewTaskId, taskList]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [taskConversations, viewTaskId, userInputRequests]);

  const closeTaskView = () => {
    setViewTaskId(null);
    setSearchParams({});
  };

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle("");
    setDesc("");
    setDepartmentId("");
    setAssignMode("department");
    setAssigneeId("");
    setPriority("medium");
    setDueDate("");
    setLabelsInput("");
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDesc(task.description ?? "");
    if (task.assigneeId && !task.departmentId) {
      setAssignMode("staff");
      setAssigneeId(task.assigneeId);
      setDepartmentId("");
    } else {
      setAssignMode("department");
      setDepartmentId(task.departmentId);
      setAssigneeId("");
    }
    setPriority(priorityOf(task));
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
    setLabelsInput((task.labels ?? []).join(", "));
    setOpen(true);
  };

  const loadTaskGraphContext = useCallback(
    (taskId: string) => engine.loadGraph(taskId),
    [engine.loadGraph],
  );

  const openTaskView = useCallback(
    (taskId: string) => {
      setViewTaskId(taskId);
      void loadTaskGraphContext(taskId);
    },
    [loadTaskGraphContext],
  );

  // Stable identity so memoized KanbanCard rows don't re-render on every
  // unrelated TaskManager state change.
  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSearchParams({ id: taskId });
      openTaskView(taskId);
    },
    [setSearchParams, openTaskView],
  );

  const saveTask = async () => {
    if (!title.trim()) return;
    if (assignMode === "department" && !departmentId) return;
    if (assignMode === "staff" && !assigneeId) return;
    const existing = editingTaskId ? taskList.find((t) => t.id === editingTaskId) : undefined;
    const department = departmentList.find((t) => t.id === departmentId);
    const labels = labelsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const base = {
      id: editingTaskId ?? undefined,
      title: title.trim(),
      description: desc,
      status: existing?.status ?? "pending",
      progress: existing?.progress ?? 0,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      labels,
      comments: existing?.comments ?? [],
      // Keep the task tied to its project/epic/sprint. The backend upsert fully
      // replaces these fields from the request, so we must preserve them on edit
      // (existing?.…) and seed them from the active project board on create —
      // otherwise the task is saved with an empty projectId and vanishes from the
      // board after reload.
      projectId: existing?.projectId ?? activeProject?.id,
      epicId: existing?.epicId ?? null,
      sprintId:
        existing?.sprintId ??
        (activeProject && sprintFilter !== "all" && sprintFilter !== "__backlog__"
          ? sprintFilter
          : null),
      issueType: existing?.issueType,
      storyPoints: existing?.storyPoints ?? null,
    };
    try {
      if (assignMode === "staff") {
        await engine.upsertTask({ ...base, departmentId: "", assigneeId, assignedStaff: [assigneeId] });
      } else {
        await engine.upsertTask({ ...base, departmentId, assigneeId: null, assignedStaff: department?.staff || [] });
      }
      resetForm();
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Drag a card between columns → drive the matching status transition. Moving
  // into "In Progress" auto-runs the staff; the user keeps stop/pause controls.
  const moveTaskToStatus = (task: Task, status: Task["status"]) => {
    if (task.status === status) return;
    if (!canEditItem(task)) return;
    if (updatingTaskIds.has(task.id)) return;
    if (status === "in-progress") {
      openTaskView(task.id);
      void engine.startTask(task, departmentRunOpts(task));
    } else if (status === "stopped") {
      void engine.stopTask(task);
    } else if (status === "paused") {
      void engine.pauseTask(task);
    } else {
      // pending | completed — generic setter aborts any live stream first.
      void engine.setStatus(task, status);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTaskId(null);
    const { active, over } = event;
    if (!over) return;
    const task = taskList.find((t) => t.id === active.id);
    if (!task) return;
    moveTaskToStatus(task, String(over.id) as Task["status"]);
  };

  // Dispatch the detail-panel status buttons to the shared engine. Start/restart
  // opens the run stream (which lives in the engine, so it survives navigation);
  // the engine aborts on stop/pause and clears run state when restarting.
  const updateTaskStatus = (task: Task, status: Task["status"]) => {
    if (task.status === status) return;
    if (updatingTaskIds.has(task.id)) return;
    if (status === "in-progress") {
      openTaskView(task.id);
      void engine.startTask(task, departmentRunOpts(task));
    } else if (status === "stopped") {
      void engine.stopTask(task);
    } else if (status === "paused") {
      void engine.pauseTask(task);
    }
  };

  // Follow-up on a finished task: relaunch in the SAME meeting (graph
  // context preserved) with the message as the steering instruction. The engine
  // owns the run; the page only supplies the department config and transcript tail.
  const continueTaskWithMessage = async (task: Task) => {
    const content = (humanInputs[task.id] ?? "").trim();
    if (!content || updatingTaskIds.has(task.id) || isStreaming(task.id)) return;
    if (task.assignedStaff.length === 0) return;
    // Snapshot the recent transcript BEFORE the follow-up so the new run sees
    // verbatim what was said (the knowledge graph alone is lossy).
    const transcriptTail = (taskConversations[task.id] ?? [])
      .slice(-10)
      .map((m) => {
        const speaker = m.staffId === "user" ? "User" : (staffById.get(m.staffId)?.name ?? m.staffId);
        const text = m.content.length > 600 ? `${m.content.slice(0, 600)}…` : m.content;
        return `${speaker}: ${text}`;
      })
      .join("\n---\n");
    setHumanInputs((prev) => ({ ...prev, [task.id]: "" }));
    await engine.continueTask(task, content, { ...departmentRunOpts(task), transcriptTail });
  };

  // Composer dispatch: mid-run messages interject into the live run; messages
  // on a finished task relaunch it as a follow-up run.
  const handleComposerSend = (task: Task) => {
    if (task.status === "in-progress") {
      void sendHumanMessage(task);
    } else if (task.status === "completed" || task.status === "stopped" || task.status === "paused") {
      void continueTaskWithMessage(task);
    }
  };

  // User comment thread (separate from the staff live-chat). Persisted on the
  // task itself via upsert, so it survives reloads like every other task field.
  const addComment = async (task: Task) => {
    const content = (commentDrafts[task.id] ?? "").trim();
    if (!content) return;
    const next = [
      ...(task.comments ?? []),
      { id: `c_${Date.now()}`, author_id: "you", content, created_at: new Date().toISOString() },
    ];
    try {
      await engine.upsertTask({ ...task, comments: next });
      setCommentDrafts((prev) => ({ ...prev, [task.id]: "" }));
    } catch (e) {
      console.error(e);
    }
  };

  const clearHistory = async (id: string) => {
    if (updatingTaskIds.has(id)) return;
    if (!window.confirm("Clear all meeting history and knowledge for this task? This cannot be undone.")) return;
    try {
      await engine.clearHistory(id);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTask = async (id: string) => {
    if (updatingTaskIds.has(id)) return;
    try {
      await engine.removeTask(id);
      // Clear page-local presentation state for the removed task.
      setHumanInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
      if (editingTaskId === id) {
        resetForm();
        setOpen(false);
      }
      if (viewTaskId === id) {
        closeTaskView();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Human-in-the-loop: send a message while staff are running (interjection).
  const sendHumanMessage = async (task: Task) => {
    const content = (humanInputs[task.id] ?? "").trim();
    if (!content) return;
    const ok = await engine.interject(task, content);
    if (ok) setHumanInputs((prev) => ({ ...prev, [task.id]: "" }));
  };

  // ask_user tool: deliver the user's answer to the blocked staff.
  const respondToStaffQuestion = async (task: Task, request: UserInputRequest, response: string) => {
    const content = response.trim();
    if (!content) return;
    const ok = await engine.respond(task, request, content);
    if (ok) setUserRequestDrafts((prev) => { const next = { ...prev }; delete next[request.requestId]; return next; });
  };

  // Interrupt/resume the run at a turn boundary (the SSE stream stays open).
  const toggleHoldTask = (task: Task, hold: boolean) => engine.hold(task, hold);

  const selectedTask = viewTaskId ? taskList.find((task) => task.id === viewTaskId) : undefined;

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden select-none">
      {/* TOP TOOLBAR */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 bg-background/50 backdrop-blur-sm flex-wrap">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <LayoutGrid className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            {activeProject ? (
              <>
                <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
                  <span className="font-mono text-primary mr-1.5">{activeProject.key}</span>
                  {activeProject.name}
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <Link to={`/projects/${activeProject.key}/board`} className="text-[10px] font-semibold text-primary border-b-2 border-primary pb-0.5">Board</Link>
                  <Link to={`/projects/${activeProject.key}/backlog`} className="text-[10px] font-medium text-muted-foreground hover:text-foreground pb-0.5">Backlog</Link>
                  <Link to={`/projects/${activeProject.key}/roadmap`} className="text-[10px] font-medium text-muted-foreground hover:text-foreground pb-0.5">Roadmap</Link>
                  <Link to={`/projects/${activeProject.key}/reports`} className="text-[10px] font-medium text-muted-foreground hover:text-foreground pb-0.5">Reports</Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-base font-bold tracking-tight text-foreground leading-none">Projects &amp; Tasks</h1>
                <p className="text-[10px] text-muted-foreground mt-1">Kanban board · drag cards between columns to change status</p>
              </>
            )}
          </div>
        </div>

        {/* On the generic /tasks board (no URL project) let the user scope down
            to a project directly, instead of only via /projects/:key/board. */}
        {!activeProject && (
          <Select
            value={projectFilter}
            onValueChange={(v) => { setProjectFilter(v); setEpicFilter("all"); setSprintFilter("all"); }}
          >
            <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projectList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.key} · {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {projectScope && (
          <>
            <Select value={epicFilter} onValueChange={setEpicFilter}>
              <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder="All epics" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All epics</SelectItem>
                {epicList.filter((e) => e.projectId === projectScope.id).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sprintFilter} onValueChange={setSprintFilter}>
              <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder="All sprints" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sprints</SelectItem>
                <SelectItem value="__backlog__">Backlog (no sprint)</SelectItem>
                {sprintList.filter((s) => s.projectId === projectScope.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {/* Search box */}
        <div className="relative">
          <Input
            type="text"
            placeholder="Search tasks, labels, people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs pl-8 pr-3 w-[240px]"
          />
          <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {scope.company && (
          <AppendFromOverallDialog
            size="sm"
            title={`Append tasks to "${scope.company.name}"`}
            description="Pick existing tasks from Overall and assign them to one of this office's departments."
            items={taskList
              .filter((t) => !isTaskInScope(t))
              .map((t) => ({ id: t.id, name: t.title, sub: t.description, badge: t.status }))}
            emptyText="Every task from Overall already belongs to this office."
            targets={departmentList
              .filter((t) => scope.departmentIds.has(t.id))
              .map((t) => ({ id: t.id, name: t.name }))}
            targetLabel="Assign to department"
            noTargetText="This office has no departments yet. Add a department first."
            copyLabel="Create independent copies for this office (when unchecked, your own tasks are moved instead; shared tasks are always copied)."
            onAppend={async (ids, targetId, makeCopy) => {
              const department = departmentList.find((t) => t.id === targetId);
              if (!department) return;
              for (const id of ids) {
                const task = taskList.find((t) => t.id === id);
                if (!task) continue;
                if (!makeCopy && canEditItem(task)) {
                  await engine.upsertTask({ ...task, departmentId: department.id, assigneeId: null, assignedStaff: department.staff || [] });
                } else {
                  await engine.upsertTask({
                    title: task.title,
                    description: task.description,
                    departmentId: department.id,
                    status: "pending",
                    progress: 0,
                    assignedStaff: department.staff || [],
                  });
                }
              }
            }}
          />
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          {canCreateTask && (
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateDialog} className="h-9 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> New Task
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTaskId ? "Edit Task" : "Create Task"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea
                placeholder="Description"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="min-h-[100px] max-h-[180px] overflow-y-auto resize-none"
              />

              {/* Assignment: department OR an individual staff member */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Assign to</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignMode("department")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors",
                      assignMode === "department" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignMode("staff")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors",
                      assignMode === "staff" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <UserRound className="w-3.5 h-3.5" /> Staff
                  </button>
                </div>
                {assignMode === "department" ? (
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                    <SelectContent>
                      {(scope.isOverall ? departmentList : departmentList.filter((t) => scope.departmentIds.has(t.id)))
                        .map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger><SelectValue placeholder="Select a staff member" /></SelectTrigger>
                    <SelectContent>
                      {scopedStaff.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Priority</label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full", PRIORITY_CONFIG[p].dot)} /> {PRIORITY_CONFIG[p].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Due date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Labels</label>
                <Input placeholder="comma, separated, labels" value={labelsInput} onChange={(e) => setLabelsInput(e.target.value)} className="h-9 text-xs" />
              </div>

              <Button
                onClick={saveTask}
                className="w-full"
                disabled={!title.trim() || (assignMode === "department" ? !departmentId : !assigneeId)}
              >
                {editingTaskId ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KANBAN BOARD */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragTaskId(null)}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full min-w-max">
            {BOARD_COLUMNS.map((col) => {
              const columnTasks = tasksByStatus[col.status] ?? [];
              return (
                <KanbanColumn key={col.status} status={col.status} label={col.label} accent={col.accent} count={columnTasks.length}>
                  {columnTasks.map((task) => {
                    const department = task.departmentId ? departmentList.find((t) => t.id === task.departmentId) : undefined;
                    const assignee = task.assigneeId ? staffById.get(task.assigneeId) : undefined;
                    const messages = taskConversations[task.id] ?? [];
                    const progress = task.status === "completed" ? 100 : Math.min(Math.round((messages.length / (department?.maxSteps ?? 6)) * 100), 99);
                    return (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        department={department}
                        assignee={assignee}
                        progress={progress}
                        isSelected={viewTaskId === task.id}
                        isRunning={isStreaming(task.id)}
                        onOpen={handleSelectTask}
                      />
                    );
                  })}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {(() => {
            const dragTask = activeDragTaskId ? taskList.find((t) => t.id === activeDragTaskId) : undefined;
            if (!dragTask) return null;
            const department = dragTask.departmentId ? departmentList.find((t) => t.id === dragTask.departmentId) : undefined;
            const assignee = dragTask.assigneeId ? staffById.get(dragTask.assigneeId) : undefined;
            const messages = taskConversations[dragTask.id] ?? [];
            const progress = dragTask.status === "completed" ? 100 : Math.min(Math.round((messages.length / (department?.maxSteps ?? 6)) * 100), 99);
            return (
              <div className="rounded-xl border border-border/40 p-3 bg-card shadow-2xl w-[276px] cursor-grabbing">
                <KanbanCardBody task={dragTask} department={department} assignee={assignee} progress={progress} isRunning={isStreaming(dragTask.id)} />
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {/* TASK DETAIL DIALOG: live chat, interject, files, comments, controls */}
      <Dialog open={!!viewTaskId} onOpenChange={(o) => { if (!o) closeTaskView(); }}>
        <DialogContent className="max-w-6xl w-[96vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Task details</DialogTitle>
          {(() => {
            if (!selectedTask) {
              return (
                <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-muted-foreground">
                  Task not found
                </div>
              );
            }

            const department = departmentList.find((t) => t.id === selectedTask.departmentId);
            const assignee = selectedTask.assigneeId ? staffById.get(selectedTask.assigneeId) : undefined;
            const messages = taskConversations[selectedTask.id] ?? [];
            const visibleMessages = messages.slice(-50);
            const openQuestions = userInputRequests[selectedTask.id] ?? [];
            const taskComments = selectedTask.comments ?? [];
            const taskLabels = selectedTask.labels ?? [];
            const taskPriority = PRIORITY_CONFIG[priorityOf(selectedTask)];
            const dueDateObj = parseTaskDate(selectedTask.dueDate);
            const overdue = isOverdue(selectedTask.dueDate, selectedTask.status);
            // Finished tasks accept follow-up messages that relaunch the run in
            // the same meeting (knowledge graph context preserved).
            const canFollowUp =
              (selectedTask.status === "completed" || selectedTask.status === "stopped" || selectedTask.status === "paused") &&
              selectedTask.assignedStaff.length > 0;
            const composerEnabled = selectedTask.status === "in-progress" || canFollowUp;
            const composerBusy =
              selectedTask.status === "in-progress"
                ? sendingInterjectTaskIds.has(selectedTask.id)
                : updatingTaskIds.has(selectedTask.id);
            const maxRounds = department?.maxSteps ?? 6;
            const calculatedProgress = selectedTask.status === "completed" ? 100 : Math.min(Math.round((messages.length / maxRounds) * 100), 99);
            const startDate = parseTaskDate(selectedTask.startTime);
            const endDate = parseTaskDate(selectedTask.endTime);
            const completionDuration =
              selectedTask.status === "completed" && startDate && endDate
                ? formatDuration(endDate.getTime() - startDate.getTime())
                : null;
            const completionSummary = !startDate
              ? "(No start time yet)"
              : completionDuration ?? "(Not completed yet)";
            const canStart = selectedTask.status === "pending" || selectedTask.status === "paused" || selectedTask.status === "stopped" || selectedTask.status === "completed";
            const canPause = selectedTask.status === "in-progress";
            const canStop = selectedTask.status === "in-progress" || selectedTask.status === "paused";
            const isUpdating = updatingTaskIds.has(selectedTask.id);
            const isConversationLoading = loadingConversationTaskIds.has(selectedTask.id);
            const isRestart = selectedTask.status === "completed";
            const Icon = statusIcons[selectedTask.status] ?? Circle;

            return (
              <div className="flex-1 h-full min-h-0 flex flex-col bg-background select-text">
                {/* Detail Header bar */}
                <div className="px-5 py-3 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={cn("w-4.5 h-4.5 shrink-0", statusColors[selectedTask.status])} />
                    {selectedTask.issueType && (
                      <span className={cn("px-1 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wide shrink-0", (ISSUE_TYPE_GLYPH[selectedTask.issueType] ?? ISSUE_TYPE_GLYPH.task).cls)}>
                        {(ISSUE_TYPE_GLYPH[selectedTask.issueType] ?? ISSUE_TYPE_GLYPH.task).label}
                      </span>
                    )}
                    {selectedTask.issueKey && (
                      <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{selectedTask.issueKey}</span>
                    )}
                    <h2 className="font-bold text-sm truncate text-foreground leading-none">{selectedTask.title}</h2>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border shrink-0", taskPriority.badge)}>
                      {taskPriority.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEditItem(selectedTask) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3"
                        onClick={() => openEditDialog(selectedTask)}
                        disabled={isUpdating}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                    )}
                    {canEditItem(selectedTask) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs px-3"
                        onClick={() => clearHistory(selectedTask.id)}
                        disabled={isUpdating}
                        title="Wipe meeting history and knowledge for a fresh start"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" /> Clear history
                      </Button>
                    )}
                    {canDeleteItem(selectedTask) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs px-3 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() => deleteTask(selectedTask.id)}
                        disabled={isUpdating}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* Detail columns company */}
                <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_1fr] divide-x divide-border">
                  {/* Panel 1: Settings / Metadata */}
                  <div className="h-full overflow-y-auto p-4 space-y-5 bg-muted/5 flex-shrink-0 scrollbar-thin">
                    {selectedTask.projectId && (
                      <div className="space-y-1.5 text-xs">
                        {(() => {
                          const issueProject = projectList.find((p) => p.id === selectedTask.projectId);
                          const issueEpic = selectedTask.epicId ? epicList.find((e) => e.id === selectedTask.epicId) : undefined;
                          const issueSprint = selectedTask.sprintId ? sprintList.find((s) => s.id === selectedTask.sprintId) : undefined;
                          return (
                            <>
                              {issueProject && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Project</span>
                                  <Link to={`/projects/${issueProject.key}/board`} className="font-semibold text-primary hover:underline">{issueProject.name}</Link>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground font-medium">Epic</span>
                                <span className="font-semibold text-foreground">{issueEpic?.title ?? "None"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground font-medium">Sprint</span>
                                <span className="font-semibold text-foreground">{issueSprint?.name ?? "Backlog"}</span>
                              </div>
                              {selectedTask.storyPoints != null && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Story points</span>
                                  <span className="font-semibold text-foreground">{selectedTask.storyPoints}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Progress</span>
                        <span className="font-bold text-foreground">{calculatedProgress}%</span>
                      </div>
                      <Progress value={calculatedProgress} className="h-1.5" />
                    </div>

                    {canEditItem(selectedTask) && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs font-semibold"
                          variant={selectedTask.status === "in-progress" ? "default" : "outline"}
                          onClick={() => updateTaskStatus(selectedTask, "in-progress")}
                          disabled={!canStart || isUpdating}
                        >
                          <Play className="w-3 h-3 mr-1.5 fill-current" />
                          {selectedTask.status === "paused" ? "Resume" : isRestart ? "Restart" : "Start"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-2.5"
                          variant="outline"
                          onClick={() => updateTaskStatus(selectedTask, "paused")}
                          disabled={!canPause}
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-2.5 hover:bg-rose-500/10 hover:border-rose-500/20"
                          variant="outline"
                          onClick={() => updateTaskStatus(selectedTask, "stopped")}
                          disabled={!canStop}
                        >
                          <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        </Button>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Description</label>
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedTask.description || "(No description)"}</p>
                    </div>

                    {/* Assigned to: an individual staff member or a department */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        {assignee ? "Assignee" : "Department"}
                      </label>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-semibold">
                        {assignee ? (
                          <>
                            <StaffAvatar staff={assignee} className="w-4 h-4 rounded-md text-[9px]" iconClassName="w-2.5 h-2.5" />
                            {assignee.name}
                          </>
                        ) : (
                          <>
                            <StaffAvatar staff={department || { avatar: "D", avatar_icon: "users" }} className="w-4 h-4 rounded-md text-[9px]" iconClassName="w-2.5 h-2.5" />
                            {department?.name || "(Unassigned)"}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Priority</label>
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border", taskPriority.badge)}>
                          <Flag className="w-2.5 h-2.5" /> {taskPriority.label}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Due date</label>
                        {dueDateObj ? (
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold", overdue ? "bg-rose-500/10 text-rose-500" : "bg-muted text-foreground")}>
                            <CalendarClock className="w-2.5 h-2.5" /> {formatDueDate(dueDateObj)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">(None)</span>
                        )}
                      </div>
                    </div>

                    {taskLabels.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Labels</label>
                        <div className="flex flex-wrap gap-1.5">
                          {taskLabels.map((label) => (
                            <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background text-[11px] font-medium border border-border/60">
                              <Tag className="w-2.5 h-2.5" /> {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Personnel</label>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTask.assignedStaff.map((aid) => {
                          const staff = staffById.get(aid);
                          return staff ? (
                            <span key={aid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background text-[11px] font-medium border border-border/60 shadow-sm">
                              <StaffAvatar staff={staff} className="w-4 h-4 rounded-md text-[8px]" iconClassName="w-2.5 h-2.5" />
                              {staff.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-border/40">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Duration</label>
                      <p className="text-xs font-semibold text-foreground">{completionSummary}</p>
                      {startDate && (
                        <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                          <p>Started: {formatTaskDateTime(startDate)}</p>
                          {endDate && <p>Ended: {formatTaskDateTime(endDate)}</p>}
                        </div>
                      )}
                    </div>

                    {/* Comments: user-authored thread, separate from staff live-chat */}
                    <div className="space-y-2 pt-3 border-t border-border/40">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" /> Comments ({taskComments.length})
                      </label>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                        {taskComments.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">No comments yet.</p>
                        ) : (
                          taskComments.map((c) => {
                            const created = parseTaskDate(c.created_at);
                            return (
                              <div key={c.id} className="rounded-lg border border-border/40 bg-card/40 p-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="w-4 h-4 rounded bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                    <UserRound className="w-2.5 h-2.5" />
                                  </div>
                                  <span className="text-[10px] font-bold text-foreground">{c.author_id === "you" ? "You" : c.author_id}</span>
                                  {created && (
                                    <span className="text-[9px] text-muted-foreground ml-auto">{formatTaskDateTime(created)}</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {canEditItem(selectedTask) && (
                        <div className="flex items-end gap-1.5">
                          <Textarea
                            value={commentDrafts[selectedTask.id] ?? ""}
                            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void addComment(selectedTask);
                              }
                            }}
                            placeholder="Add a comment… (Enter to send)"
                            rows={1}
                            className="min-h-[34px] max-h-[90px] text-xs resize-none flex-1 py-2"
                          />
                          <Button
                            size="sm"
                            className="h-8 px-2.5 shrink-0"
                            onClick={() => void addComment(selectedTask)}
                            disabled={!(commentDrafts[selectedTask.id] ?? "").trim()}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Panel 2: Live Chat/Meeting */}
                  <div className="h-full flex flex-col overflow-hidden bg-background">
                    <div className="px-4 py-2 border-b border-border/40 bg-muted/5 flex items-center justify-between flex-shrink-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Live Chat Logs
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                      {isConversationLoading && messages.length === 0 && (thinkingStaff[selectedTask.id]?.size ?? 0) === 0 ? (
                        <p className="text-xs text-muted-foreground animate-pulse">Loading meeting...</p>
                      ) : visibleMessages.length > 0 || (thinkingStaff[selectedTask.id]?.size ?? 0) > 0 || openQuestions.length > 0 || !!activeFanouts[selectedTask.id] ? (
                        <div className="space-y-3.5">
                          {visibleMessages.map((msg) => {
                            const ts = new Date(msg.timestamp);
                            // Human-in-the-loop message: distinct style + delivery badge
                            if (msg.staffId === "user") {
                              const isQueued = pendingInterjections[selectedTask.id]?.has(msg.id) ?? false;
                              return (
                                <div key={msg.id} className="rounded-xl border border-primary/30 p-3.5 bg-primary/10 ml-8 shadow-sm">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                                      <UserRound className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs font-bold text-foreground">You</span>
                                    <span
                                      className={cn(
                                        "text-[9px] px-1.5 py-0.5 rounded font-semibold border",
                                        isQueued
                                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                      )}
                                    >
                                      {isQueued ? "Waiting for next staff…" : "Added to staff context"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
                                      {isNaN(ts.getTime()) ? msg.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                </div>
                              );
                            }
                            const staff = staffById.get(msg.staffId);
                            return (
                              <div key={msg.id} className="rounded-xl border border-border/40 p-3.5 bg-card/45 hover:bg-muted/10 transition-colors shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <StaffAvatar
                                    staff={staff || { avatar: "?" }}
                                    className={`w-6.5 h-6.5 rounded-md text-[9px] shadow-sm shrink-0 ${staff?.avatar_color ? "" : getStaffRoleColor(staff?.role || "")}`}
                                    iconClassName="w-3 h-3"
                                  />
                                  <span className="text-xs font-bold text-foreground">{staff?.name ?? msg.staffId}</span>
                                  <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
                                    {isNaN(ts.getTime()) ? msg.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                  </span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-foreground/80 leading-relaxed [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            );
                          })}

                          {/* ask_user tool: staff question cards — the staff is
                              blocked until the user answers (or times out) */}
                          {openQuestions.map((request) => {
                            const staff = request.staffId ? staffById.get(request.staffId) : undefined;
                            const draft = userRequestDrafts[request.requestId] ?? "";
                            const isResponding = respondingRequestIds.has(request.requestId);
                            return (
                              <div key={request.requestId} className="rounded-xl border border-violet-500/35 p-3.5 bg-violet-500/5 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <StaffAvatar
                                    staff={staff || { avatar: "?", avatar_icon: "circle-help" }}
                                    className={`w-6.5 h-6.5 rounded-md text-[9px] shadow-sm shrink-0 ${staff?.avatar_color ? "" : getStaffRoleColor(staff?.role || "")}`}
                                    iconClassName="w-3 h-3"
                                  />
                                  <span className="text-xs font-bold text-foreground">
                                    {staff?.name ?? request.staffName ?? "Staff"}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold border bg-violet-500/10 text-violet-400 border-violet-500/25 flex items-center gap-1">
                                    <HelpCircle className="w-2.5 h-2.5" /> needs your input
                                  </span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap mb-2.5">
                                  {request.question}
                                </p>
                                {request.options.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {request.options.map((opt) => (
                                      <Button
                                        key={opt}
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2.5 text-[11px] font-semibold border-violet-500/30 hover:bg-violet-500/10"
                                        onClick={() => void respondToStaffQuestion(selectedTask, request, opt)}
                                        disabled={isResponding}
                                      >
                                        {opt}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                                {request.allowFreeText && (
                                  <div className="flex items-end gap-2">
                                    <Input
                                      value={draft}
                                      onChange={(e) =>
                                        setUserRequestDrafts((prev) => ({ ...prev, [request.requestId]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          void respondToStaffQuestion(selectedTask, request, draft);
                                        }
                                      }}
                                      placeholder="Type your answer… (Enter to send)"
                                      disabled={isResponding}
                                      className="h-8 text-xs flex-1"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 px-2.5 shrink-0"
                                      onClick={() => void respondToStaffQuestion(selectedTask, request, draft)}
                                      disabled={!draft.trim() || isResponding}
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Parallel fan-out banner: shown while a coordinator's
                              wave of staff runs concurrently. */}
                          {activeFanouts[selectedTask.id] && (
                            <div className="rounded-xl border border-amber-500/30 p-3 bg-amber-500/5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                  Parallel wave — running concurrently:
                                </span>
                                {(activeFanouts[selectedTask.id]?.targets ?? []).map((t) => (
                                  <span
                                    key={`fanout-${t}`}
                                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                                  >
                                    {staffById.get(t)?.name ?? t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Thinking indicators */}
                          {(thinkingStaff[selectedTask.id]?.size ?? 0) > 0 && (
                            Array.from(thinkingStaff[selectedTask.id] ?? []).map((staffId) => {
                              const staff = staffById.get(staffId);
                              return (
                                <div key={`thinking-${staffId}`} className="rounded-xl border border-primary/20 p-3.5 bg-primary/5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.4s" }} />
                                    </div>
                                    <span className="text-xs font-semibold text-primary/95">
                                      {staff?.name ?? staffId} is processing...
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">No messages yet for this task.</p>
                      )}
                    </div>

                    {/* Human-in-the-loop composer: chat with the staff mid-run.
                        Messages are queued on the backend and injected into the
                        context of the next staff turn. Interrupt holds the run
                        at the turn boundary; Resume releases it.
                        Hidden for shared default tasks — they are view-only for
                        regular users (running them requires the admin account). */}
                    {canEditItem(selectedTask) && (
                    <div className="border-t border-border/40 p-3 flex-shrink-0 bg-muted/5">
                      {selectedTask.status === "in-progress" && (
                        heldTaskIds.has(selectedTask.id) ? (
                          <div className="flex items-center justify-between gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                            <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1.5">
                              <Hand className="w-3 h-3" />
                              Staff are holding — send your guidance, then resume.
                            </span>
                            <Button
                              size="sm"
                              className="h-6 px-2.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => void toggleHoldTask(selectedTask, false)}
                              disabled={holdTogglingTaskIds.has(selectedTask.id)}
                            >
                              <Play className="w-3 h-3 mr-1 fill-current" /> Resume
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end mb-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2.5 text-[10px] font-semibold text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600"
                              onClick={() => void toggleHoldTask(selectedTask, true)}
                              disabled={holdTogglingTaskIds.has(selectedTask.id)}
                            >
                              <Hand className="w-3 h-3 mr-1" /> Interrupt to chat
                            </Button>
                          </div>
                        )
                      )}
                      {interjectErrors[selectedTask.id] && (
                        <p className="text-[10px] text-rose-500 mb-1.5 font-medium">
                          {interjectErrors[selectedTask.id]}
                        </p>
                      )}
                      <div className="mb-2">
                        <MeetingFiles taskId={selectedTask.id} companyId={scope.company?.id ?? null} />
                      </div>
                      <div className="flex items-end gap-2">
                        <Textarea
                          value={humanInputs[selectedTask.id] ?? ""}
                          onChange={(e) =>
                            setHumanInputs((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleComposerSend(selectedTask);
                            }
                          }}
                          placeholder={
                            !composerEnabled
                              ? "Start the task to chat with the staff"
                              : canFollowUp
                                ? "Task finished — send a follow-up to continue the work with full context… (Enter to send)"
                                : heldTaskIds.has(selectedTask.id)
                                  ? "Run is holding — discuss freely, then press Resume… (Enter to send)"
                                  : "Guide the staff — your message becomes context for the next staff turn… (Enter to send)"
                          }
                          disabled={!composerEnabled || composerBusy}
                          className="min-h-[38px] max-h-[110px] text-xs resize-none flex-1 py-2"
                          rows={1}
                        />
                        <Button
                          size="sm"
                          className="h-9 px-3 shrink-0"
                          onClick={() => handleComposerSend(selectedTask)}
                          disabled={
                            !composerEnabled ||
                            !(humanInputs[selectedTask.id] ?? "").trim() ||
                            composerBusy
                          }
                        >
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
