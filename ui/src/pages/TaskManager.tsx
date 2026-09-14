import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, UserRound, LayoutGrid, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppendFromOverallDialog } from "@/components/AppendFromOverallDialog";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { TaskDetailDialog } from "@/components/task-manager/TaskDetailDialog";
import {
  BOARD_COLUMNS, PRIORITY_CONFIG,
  priorityOf, KanbanCard, KanbanCardBody, KanbanColumn,
} from "@/components/task-manager/KanbanBoard";
import { api, buildCustomGraphPayload, canEditItem, type Staff, type Department, type Task, type TaskPriority, type Project, type Sprint, type Epic } from "@/lib/api";
import { useRunEngine, type UserInputRequest } from "@/contexts/RunEngineContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { useByIdMap } from "@/hooks/use-by-id-map";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function TaskManager() {
  const { t: lang } = useLanguage();
  const scope = useCompanyScope();
  const { toast } = useToast();
  // Shared run engine (lives above the router): owns the streaming loop and all
  // run-state so a task keeps running and stays in sync when navigating away.
  const engine = useRunEngine();
  const {
    tasks: taskList,
    meetings: taskMeetings,
    thinkingStaff,
    activeFanouts,
    heldTaskIds,
    pendingInterjections,
    userInputRequests,
    loadingMeetingTaskIds,
    updatingTaskIds,
    statusChangePendingIds,
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
  // Projects belong to one company (see Project.companyId) — narrow to the
  // active office so another company's projects/issues never leak in here.
  // Legacy projects predating that field (companyId "") stay visible in every
  // office, same as before company-scoping existed.
  const scopedProjectList = useMemo(
    () => (scope.isOverall ? projectList : projectList.filter((p) => !p.companyId || scope.projectIds.has(p.id))),
    [projectList, scope.isOverall, scope.projectIds],
  );
  const activeProject = useMemo(
    () => (projectKeyParam ? scopedProjectList.find((p) => p.key === projectKeyParam) : undefined),
    [projectKeyParam, scopedProjectList],
  );
  // The project actually filtering the board: the URL project when on a
  // project's own board route, otherwise whatever the dropdown picked.
  const projectScope = useMemo(
    () => activeProject ?? (projectFilter !== "all" ? scopedProjectList.find((p) => p.id === projectFilter) : undefined),
    [activeProject, projectFilter, scopedProjectList],
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
  // Prompt shown instead of silently no-oping when starting a task with no
  // department/staff assigned yet (see requestStart).
  const [assignPromptTaskId, setAssignPromptTaskId] = useState<string | null>(null);
  const [assignPromptMode, setAssignPromptMode] = useState<"department" | "staff">("department");
  const [assignPromptDepartmentId, setAssignPromptDepartmentId] = useState("");
  const [assignPromptStaffId, setAssignPromptStaffId] = useState("");
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

  const staffById = useByIdMap(staffList);

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
  // member of a department in scope. A project-linked issue belongs to its
  // project's office (Project.companyId), except legacy projects predating that
  // field (companyId ""), which stay visible everywhere.
  const isTaskInScope = (task: Task) => {
    if (scope.isOverall) return true;
    if (task.projectId) {
      const project = projectList.find((p) => p.id === task.projectId);
      return !project?.companyId || scope.projectIds.has(task.projectId);
    }
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
  }, [taskMeetings, viewTaskId, userInputRequests]);

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
      toast({ title: lang.taskManagerPage.couldNotSaveTask, description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  // Starting a task needs a department or staff behind it. If it has neither
  // yet, prompt for one instead of letting engine.startTask silently no-op.
  const requestStart = (task: Task) => {
    if (task.assignedStaff.length === 0) {
      setAssignPromptTaskId(task.id);
      setAssignPromptMode("department");
      setAssignPromptDepartmentId("");
      setAssignPromptStaffId("");
      return;
    }
    openTaskView(task.id);
    void engine.startTask(task, departmentRunOpts(task));
  };

  const confirmAssignAndRun = async () => {
    const task = taskList.find((t) => t.id === assignPromptTaskId);
    if (!task) return;
    const patch =
      assignPromptMode === "staff"
        ? { ...task, departmentId: "", assigneeId: assignPromptStaffId, assignedStaff: [assignPromptStaffId] }
        : {
            ...task,
            departmentId: assignPromptDepartmentId,
            assigneeId: null,
            assignedStaff: departmentList.find((t) => t.id === assignPromptDepartmentId)?.staff || [],
          };
    try {
      const updated = await engine.upsertTask(patch);
      setAssignPromptTaskId(null);
      openTaskView(updated.id);
      void engine.startTask(updated, departmentRunOpts(updated));
    } catch (e) {
      console.error(e);
      toast({ title: lang.taskManagerPage.couldNotAssignTask, description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  // Drag a card between columns → drive the matching status transition. Moving
  // into "In Progress" auto-runs the staff; the user keeps stop/pause controls.
  const moveTaskToStatus = (task: Task, status: Task["status"]) => {
    // Same-status is normally a no-op, except "in-progress" → "in-progress"
    // while nothing is actually streaming: that's a task orphaned by a lost
    // SSE connection (see `isOrphaned` in the detail panel), and re-dropping
    // it into "In Progress" is how the user restarts it.
    if (task.status === status && !(status === "in-progress" && !engine.isStreaming(task.id))) return;
    if (!canEditItem(task)) return;
    // updatingTaskIds stays true for a task's *entire* active run (see
    // startTask), so gating stop/pause/other on it would block them for as
    // long as the task is running — exactly when you need them. Those use
    // the short-lived statusChangePendingIds instead, to only prevent
    // double-submitting the same click.
    if (status === "in-progress") {
      if (updatingTaskIds.has(task.id)) return;
      requestStart(task);
    } else if (status === "stopped") {
      if (statusChangePendingIds.has(task.id)) return;
      void engine.stopTask(task);
    } else if (status === "paused") {
      if (statusChangePendingIds.has(task.id)) return;
      void engine.pauseTask(task);
    } else {
      // pending | completed — generic setter aborts any live stream first.
      if (statusChangePendingIds.has(task.id)) return;
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
  const updateTaskStatus = (task: Task, status: Task["status"]) => moveTaskToStatus(task, status);

  // Follow-up on a finished task: relaunch in the SAME meeting (graph
  // context preserved) with the message as the steering instruction. The engine
  // owns the run; the page only supplies the department config and transcript tail.
  const continueTaskWithMessage = async (task: Task) => {
    const content = (humanInputs[task.id] ?? "").trim();
    if (!content || updatingTaskIds.has(task.id) || isStreaming(task.id)) return;
    if (task.assignedStaff.length === 0) return;
    // Snapshot the recent transcript BEFORE the follow-up so the new run sees
    // verbatim what was said (the knowledge graph alone is lossy).
    const transcriptTail = (taskMeetings[task.id] ?? [])
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
      toast({ title: lang.taskManagerPage.couldNotAddComment, description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const clearHistory = async (id: string) => {
    if (updatingTaskIds.has(id)) return;
    if (!window.confirm(lang.taskManagerPage.clearHistoryConfirm)) return;
    try {
      await engine.clearHistory(id);
    } catch (e) {
      console.error(e);
      toast({ title: lang.taskManagerPage.couldNotClearHistory, description: String((e as Error).message ?? e), variant: "destructive" });
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
      toast({ title: lang.taskManagerPage.couldNotDeleteTask, description: String((e as Error).message ?? e), variant: "destructive" });
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

  // Shared toolbar controls (epic/sprint filters, search, append, new task) — used
  // both inside the project-scoped subnav and the generic /tasks toolbar below.
  const toolbarControls = (
    <>
      {projectScope && (
        <>
          <Select value={epicFilter} onValueChange={setEpicFilter}>
            <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder={lang.taskManagerPage.allEpics} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang.taskManagerPage.allEpics}</SelectItem>
              {epicList.filter((e) => e.projectId === projectScope.id).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sprintFilter} onValueChange={setSprintFilter}>
            <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder={lang.taskManagerPage.allSprints} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang.taskManagerPage.allSprints}</SelectItem>
              <SelectItem value="__backlog__">{lang.taskManagerPage.backlogNoSprint}</SelectItem>
              {sprintList.filter((s) => s.projectId === projectScope.id).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <div className="relative">
        <Input
          type="text"
          placeholder={lang.taskManagerPage.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 text-xs pl-8 pr-3 w-[220px]"
        />
        <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {scope.company && (
        <AppendFromOverallDialog
          size="sm"
          title={lang.taskManagerPage.appendTasksTitle.replace("{name}", scope.company.name)}
          description={lang.taskManagerPage.appendTasksDesc}
          items={taskList
            .filter((t) => !isTaskInScope(t))
            .map((t) => ({ id: t.id, name: t.title, sub: t.description, badge: t.status }))}
          emptyText={lang.taskManagerPage.appendEmptyText}
          targets={departmentList
            .filter((t) => scope.departmentIds.has(t.id))
            .map((t) => ({ id: t.id, name: t.name }))}
          targetLabel={lang.taskManagerPage.appendTargetLabel}
          noTargetText={lang.taskManagerPage.appendNoTargetText}
          copyLabel={lang.taskManagerPage.appendCopyLabel}
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

      {canCreateTask && (
        <Button size="sm" onClick={openCreateDialog} className="h-9 gap-1 text-xs">
          <Plus className="w-3.5 h-3.5" /> {lang.taskManagerPage.newTaskBtn}
        </Button>
      )}
    </>
  );

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden select-none">
      {/* TOP TOOLBAR */}
      {activeProject ? (
        <ProjectSubnav project={activeProject} projectKey={activeProject.key} active="board">
          <div className="flex items-center gap-2 flex-wrap">{toolbarControls}</div>
        </ProjectSubnav>
      ) : (
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 bg-background/50 backdrop-blur-sm flex-wrap">
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <LayoutGrid className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground leading-none">{lang.taskManagerPage.pageTitle}</h1>
              <p className="text-[10px] text-muted-foreground mt-1">{lang.taskManagerPage.pageSubtitle}</p>
            </div>
          </div>

          {/* On the generic /tasks board (no URL project) let the user scope down
              to a project directly, instead of only via /projects/:key/board. */}
          <Select
            value={projectFilter}
            onValueChange={(v) => { setProjectFilter(v); setEpicFilter("all"); setSprintFilter("all"); }}
          >
            <SelectTrigger className="h-9 text-xs w-[160px]"><SelectValue placeholder={lang.taskManagerPage.allProjects} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang.taskManagerPage.allProjects}</SelectItem>
              {scopedProjectList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.key} · {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {toolbarControls}
        </div>
      )}

      {/* New Task dialog — trigger buttons live in the toolbar above (see toolbarControls) */}
      <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTaskId ? lang.taskManagerPage.editTaskTitle : lang.taskManagerPage.createTaskTitle}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder={lang.taskManagerPage.taskTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea
                placeholder={lang.taskManagerPage.descriptionPlaceholder}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="min-h-[100px] max-h-[180px] overflow-y-auto resize-none"
              />

              {/* Assignment: department OR an individual staff member */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{lang.taskManagerPage.assignToLabel}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignMode("department")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors",
                      assignMode === "department" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5" /> {lang.taskManagerPage.departmentBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignMode("staff")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors",
                      assignMode === "staff" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <UserRound className="w-3.5 h-3.5" /> {lang.taskManagerPage.staffBtn}
                  </button>
                </div>
                {assignMode === "department" ? (
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger><SelectValue placeholder={lang.taskManagerPage.selectDepartmentPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {(scope.isOverall ? departmentList : departmentList.filter((t) => scope.departmentIds.has(t.id)))
                        .map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger><SelectValue placeholder={lang.taskManagerPage.selectStaffPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {scopedStaff.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{lang.taskManagerPage.priorityLabel}</label>
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
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{lang.taskManagerPage.dueDateLabel}</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{lang.taskManagerPage.labelsLabel}</label>
                <Input placeholder={lang.taskManagerPage.labelsPlaceholder} value={labelsInput} onChange={(e) => setLabelsInput(e.target.value)} className="h-9 text-xs" />
              </div>

              <Button
                onClick={saveTask}
                className="w-full"
                disabled={!title.trim() || (assignMode === "department" ? !departmentId : !assigneeId)}
              >
                {editingTaskId ? lang.taskManagerPage.saveChangesBtn : lang.taskManagerPage.createTaskTitle}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shown instead of silently no-oping when starting a task with no
            department/staff behind it yet (see requestStart). */}
        <Dialog open={!!assignPromptTaskId} onOpenChange={(o) => !o && setAssignPromptTaskId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang.taskManagerPage.assignBeforeRunningTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                "{taskList.find((t) => t.id === assignPromptTaskId)?.title}" {lang.taskManagerPage.noAssigneeYetSuffix}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignPromptMode("department")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors",
                    assignPromptMode === "department" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  <Building2 className="w-3.5 h-3.5" /> {lang.taskManagerPage.departmentBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignPromptMode("staff")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-semibold transition-colors",
                    assignPromptMode === "staff" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  <UserRound className="w-3.5 h-3.5" /> {lang.taskManagerPage.staffBtn}
                </button>
              </div>
              {assignPromptMode === "department" ? (
                <Select value={assignPromptDepartmentId} onValueChange={setAssignPromptDepartmentId}>
                  <SelectTrigger><SelectValue placeholder={lang.taskManagerPage.selectDepartmentPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {(scope.isOverall ? departmentList : departmentList.filter((t) => scope.departmentIds.has(t.id)))
                      .map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={assignPromptStaffId} onValueChange={setAssignPromptStaffId}>
                  <SelectTrigger><SelectValue placeholder={lang.taskManagerPage.selectStaffPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {scopedStaff.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={confirmAssignAndRun}
                className="w-full"
                disabled={assignPromptMode === "department" ? !assignPromptDepartmentId : !assignPromptStaffId}
              >
                {lang.taskManagerPage.assignAndRunBtn}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      {/* KANBAN BOARD */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragTaskId(null)}>
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <div className="grid gap-3 h-full" style={{ gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(0, 1fr))` }}>
            {BOARD_COLUMNS.map((col) => {
              const columnTasks = tasksByStatus[col.status] ?? [];
              return (
                <KanbanColumn key={col.status} status={col.status} label={col.label} accent={col.accent} count={columnTasks.length}>
                  {columnTasks.map((task) => {
                    const department = task.departmentId ? departmentList.find((t) => t.id === task.departmentId) : undefined;
                    const assignee = task.assigneeId ? staffById.get(task.assigneeId) : undefined;
                    const messages = taskMeetings[task.id] ?? [];
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
            const messages = taskMeetings[dragTask.id] ?? [];
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
      <TaskDetailDialog
        viewTaskId={viewTaskId}
        selectedTask={selectedTask}
        closeTaskView={closeTaskView}
        departmentList={departmentList}
        staffById={staffById}
        taskMeetings={taskMeetings}
        userInputRequests={userInputRequests}
        projectList={projectList}
        epicList={epicList}
        sprintList={sprintList}
        companyId={scope.company?.id ?? null}
        sendingInterjectTaskIds={sendingInterjectTaskIds}
        updatingTaskIds={updatingTaskIds}
        statusChangePendingIds={statusChangePendingIds}
        loadingMeetingTaskIds={loadingMeetingTaskIds}
        isStreaming={isStreaming}
        thinkingStaff={thinkingStaff}
        activeFanouts={activeFanouts}
        pendingInterjections={pendingInterjections}
        heldTaskIds={heldTaskIds}
        holdTogglingTaskIds={holdTogglingTaskIds}
        interjectErrors={interjectErrors}
        commentDrafts={commentDrafts}
        setCommentDrafts={setCommentDrafts}
        userRequestDrafts={userRequestDrafts}
        setUserRequestDrafts={setUserRequestDrafts}
        respondingRequestIds={respondingRequestIds}
        humanInputs={humanInputs}
        setHumanInputs={setHumanInputs}
        chatEndRef={chatEndRef}
        openEditDialog={openEditDialog}
        clearHistory={clearHistory}
        deleteTask={deleteTask}
        updateTaskStatus={updateTaskStatus}
        addComment={addComment}
        respondToStaffQuestion={respondToStaffQuestion}
        toggleHoldTask={toggleHoldTask}
        handleComposerSend={handleComposerSend}
      />
    </div>
  );
}
