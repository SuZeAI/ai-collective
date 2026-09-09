import { type RefObject } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Circle, Pause, Play, Square, Pencil, Trash2, X, Send, UserRound, Hand, HelpCircle, Zap, Flag, CalendarClock, Tag, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StaffAvatar } from "@/components/StaffAvatar";
import { MeetingFiles } from "@/components/MeetingFiles";
import {
  statusIcons, statusColors, ISSUE_TYPE_GLYPH, PRIORITY_CONFIG,
  priorityOf, parseTaskDate, isOverdue, formatDueDate, formatDuration, formatTaskDateTime,
} from "@/components/task-manager/KanbanBoard";
import { canDeleteItem, canEditItem, type Staff, type Message, type Department, type Task, type Project, type Sprint, type Epic } from "@/lib/api";
import { type UserInputRequest } from "@/contexts/RunEngineContext";
import { getStaffRoleColor } from "@/lib/staff-role-ui";
import { cn } from "@/lib/utils";

interface TaskDetailDialogProps {
  viewTaskId: string | null;
  selectedTask: Task | undefined;
  closeTaskView: () => void;
  departmentList: Department[];
  staffById: Map<string, Staff>;
  taskConversations: Record<string, Message[]>;
  userInputRequests: Record<string, UserInputRequest[]>;
  projectList: Project[];
  epicList: Epic[];
  sprintList: Sprint[];
  companyId: string | null;
  sendingInterjectTaskIds: Set<string>;
  updatingTaskIds: Set<string>;
  statusChangePendingIds: Set<string>;
  loadingConversationTaskIds: Set<string>;
  isStreaming: (taskId: string) => boolean;
  thinkingStaff: Record<string, Set<string>>;
  activeFanouts: Record<string, { coordinator?: string; targets: string[] }>;
  pendingInterjections: Record<string, Set<string>>;
  heldTaskIds: Set<string>;
  holdTogglingTaskIds: Set<string>;
  interjectErrors: Record<string, string>;
  commentDrafts: Record<string, string>;
  setCommentDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  userRequestDrafts: Record<string, string>;
  setUserRequestDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  respondingRequestIds: Set<string>;
  humanInputs: Record<string, string>;
  setHumanInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
  openEditDialog: (task: Task) => void;
  clearHistory: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTaskStatus: (task: Task, status: Task["status"]) => void;
  addComment: (task: Task) => void;
  respondToStaffQuestion: (task: Task, request: UserInputRequest, response: string) => void;
  toggleHoldTask: (task: Task, hold: boolean) => void;
  handleComposerSend: (task: Task) => void;
}

export function TaskDetailDialog({
  viewTaskId, selectedTask, closeTaskView, departmentList, staffById, taskConversations,
  userInputRequests, projectList, epicList, sprintList, companyId,
  sendingInterjectTaskIds, updatingTaskIds, statusChangePendingIds, loadingConversationTaskIds,
  isStreaming, thinkingStaff, activeFanouts, pendingInterjections, heldTaskIds, holdTogglingTaskIds,
  interjectErrors, commentDrafts, setCommentDrafts, userRequestDrafts, setUserRequestDrafts,
  respondingRequestIds, humanInputs, setHumanInputs, chatEndRef, openEditDialog, clearHistory,
  deleteTask, updateTaskStatus, addComment, respondToStaffQuestion, toggleHoldTask, handleComposerSend,
}: TaskDetailDialogProps) {
  return (
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
            // A task can be left stuck showing "in-progress" with nothing actually
            // streaming — e.g. the tab that started it was closed/reloaded, which
            // drops the SSE connection the run is entirely driven by (see
            // RunEngineContext's runStream/llm.py event_generator) without ever
            // flipping the task's DB status back. Detect that so the user has a
            // way to get the run going again instead of a permanently dead task.
            const isOrphaned = selectedTask.status === "in-progress" && !isStreaming(selectedTask.id);
            const canStart = selectedTask.status === "pending" || selectedTask.status === "paused" || selectedTask.status === "stopped" || selectedTask.status === "completed" || isOrphaned;
            const canPause = selectedTask.status === "in-progress";
            const canStop = selectedTask.status === "in-progress" || selectedTask.status === "paused";
            const isUpdating = updatingTaskIds.has(selectedTask.id);
            const isStatusChangePending = statusChangePendingIds.has(selectedTask.id);
            const isConversationLoading = loadingConversationTaskIds.has(selectedTask.id);
            const isRestart = selectedTask.status === "completed" || isOrphaned;
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
                          disabled={!canPause || isStatusChangePending}
                        >
                          {isStatusChangePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-2.5 hover:bg-rose-500/10 hover:border-rose-500/20"
                          variant="outline"
                          onClick={() => updateTaskStatus(selectedTask, "stopped")}
                          disabled={!canStop || isStatusChangePending}
                        >
                          {isStatusChangePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />}
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
                        <MeetingFiles taskId={selectedTask.id} companyId={companyId} />
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
  );
}
