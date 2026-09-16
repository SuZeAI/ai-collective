import { memo, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CalendarClock, CheckCircle2, Circle, Clock, Eye, Pause, Square, Tag } from "lucide-react";
import { StaffAvatar } from "@/components/StaffAvatar";
import { type Staff, type Department, type Task, type TaskPriority } from "@/lib/api";
import { cn } from "@/lib/utils";

export const statusIcons = {
  "pending": Circle,
  "in-progress": Clock,
  "in-review": Eye,
  "paused": Pause,
  "stopped": Square,
  "completed": CheckCircle2,
};

export const statusColors: Record<string, string> = {
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
export const BOARD_COLUMNS: { status: Task["status"]; label: string; accent: string }[] = [
  { status: "pending", label: "To Do", accent: "bg-muted-foreground/30" },
  { status: "in-progress", label: "In Progress", accent: "bg-primary" },
  { status: "in-review", label: "In Review", accent: "bg-violet-500" },
  { status: "paused", label: "Paused", accent: "bg-amber-500" },
  { status: "stopped", label: "Stopped", accent: "bg-rose-500" },
  { status: "completed", label: "Done", accent: "bg-emerald-500" },
];

// Issue-type → short glyph for board/backlog cards.
export const ISSUE_TYPE_GLYPH: Record<string, { label: string; cls: string }> = {
  epic: { label: "Epic", cls: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  story: { label: "Story", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  task: { label: "Task", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  bug: { label: "Bug", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  subtask: { label: "Sub", cls: "bg-muted text-muted-foreground border-border" },
};

// Priority presentation. `order` drives sorting (urgent first) inside columns.
export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string; dot: string; order: number }> = {
  urgent: { label: "Urgent", badge: "bg-rose-500/15 text-rose-500 border-rose-500/30", dot: "bg-rose-500", order: 0 },
  high: { label: "High", badge: "bg-orange-500/15 text-orange-500 border-orange-500/30", dot: "bg-orange-500", order: 1 },
  medium: { label: "Medium", badge: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500", order: 2 },
  low: { label: "Low", badge: "bg-sky-500/15 text-sky-500 border-sky-500/30", dot: "bg-sky-500", order: 3 },
};

export const priorityOf = (task: Task): TaskPriority => (task.priority && PRIORITY_CONFIG[task.priority] ? task.priority : "medium");

export const parseTaskDate = (value?: string | null) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export const isOverdue = (dueDate?: string | null, status?: string) => {
  if (status === "completed") return false;
  const d = parseTaskDate(dueDate);
  return d ? d.getTime() < Date.now() : false;
};

export const formatDueDate = (date: Date) =>
  date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

export const formatDuration = (ms: number) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export const formatTaskDateTime = (date: Date) => {
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
export function KanbanCardBody({ task, department, assignee, progress, isRunning }: KanbanCardBodyProps) {
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

export const KanbanCard = memo(function KanbanCard({ task, department, assignee, progress, isSelected, isRunning, onOpen }: KanbanCardProps) {
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
  children: ReactNode;
};

export function KanbanColumn({ status, label, accent, count, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col min-w-0 h-full">
      <div className="flex items-center gap-1.5 px-2 py-2 mb-1 min-w-0">
        <span className={cn("w-2 h-2 rounded-full shrink-0", accent)} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
        <span className="text-[10px] font-semibold text-muted-foreground/70 bg-muted rounded-full px-1.5 py-0.5 ml-auto shrink-0">{count}</span>
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
