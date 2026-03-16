import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, CheckCircle2, Clock, Circle, Pause, Play, Square, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { api, type Agent, type Message, type Team, type Task } from "@/lib/api";
import { getAgentRoleColor } from "@/lib/agent-role-ui";

const statusIcons = {
  "pending": Circle,
  "in-progress": Clock,
  "paused": Pause,
  "stopped": Square,
  "completed": CheckCircle2,
};

const statusColors: Record<string, string> = {
  "pending": "text-muted-foreground",
  "in-progress": "text-primary",
  "paused": "text-amber-500",
  "stopped": "text-rose-500",
  "completed": "text-agent-dev",
};

export default function TaskManager() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [teamId, setTeamId] = useState("");
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskConversations, setTaskConversations] = useState<Record<string, Message[]>>({});
  const [loadingConversationTaskIds, setLoadingConversationTaskIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const loadTaskConversation = async (taskId: string) => {
    setLoadingConversationTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    try {
      const messages = await api.listConversations(taskId);
      setTaskConversations((prev) => ({ ...prev, [taskId]: messages }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConversationTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const loadTaskConversations = async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    try {
      const results = await Promise.all(
        taskIds.map(async (id) => ({ id, messages: await api.listConversations(id) }))
      );
      setTaskConversations((prev) => {
        const next = { ...prev };
        for (const item of results) {
          if (item.messages.length > 0) {
            next[item.id] = item.messages;
          }
        }
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tasks, teams, agents] = await Promise.all([api.listTasks(), api.listTeams(), api.listAgents()]);
        if (cancelled) return;
        setTaskList(tasks);
        setTeamList(teams);
        setAgentList(agents);
        await loadTaskConversations(tasks.map((t) => t.id));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const streamTaskIds = taskList.filter((t) => t.status === "in-progress").map((t) => t.id);
    if (streamTaskIds.length === 0) return;

    let cancelled = false;
    const loadConversations = async () => {
      setLoadingConversationTaskIds((prev) => {
        const next = new Set(prev);
        streamTaskIds.forEach((id) => next.add(id));
        return next;
      });
      try {
        const results = await Promise.all(
          streamTaskIds.map(async (id) => ({ id, messages: await api.listConversations(id) }))
        );
        if (cancelled) return;
        setTaskConversations((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.id] = item.messages;
          }
          return next;
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoadingConversationTaskIds((prev) => {
            const next = new Set(prev);
            streamTaskIds.forEach((id) => next.delete(id));
            return next;
          });
        }
      }
    };

    loadConversations();
    const interval = setInterval(loadConversations, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskList]);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agentList.forEach((a) => map.set(a.id, a));
    return map;
  }, [agentList]);

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle("");
    setDesc("");
    setTeamId("");
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDesc(task.description ?? "");
    setTeamId(task.teamId);
    setOpen(true);
  };

  const saveTask = async () => {
    if (!title.trim() || !teamId) return;
    const existing = editingTaskId ? taskList.find((t) => t.id === editingTaskId) : undefined;
    const team = teamList.find((t) => t.id === teamId);
    try {
      const saved = await api.upsertTask({
        id: editingTaskId ?? undefined,
        title: title.trim(),
        description: desc,
        teamId,
        status: existing?.status ?? "pending",
        progress: existing?.progress ?? 0,
        assignedAgents: team?.agents || [],
      });
      setTaskList((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      resetForm();
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskStatus = async (task: Task, status: Task["status"]) => {
    if (updatingTaskIds.has(task.id) || task.status === status) return;
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = await api.upsertTask({
        ...task,
        status,
      });
      setTaskList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      await loadTaskConversation(updated.id);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const deleteTask = async (id: string) => {
    if (updatingTaskIds.has(id)) return;
    setUpdatingTaskIds((prev) => new Set(prev).add(id));
    try {
      await api.deleteTask(id);
      setTaskList((prev) => prev.filter((t) => t.id !== id));
      setTaskConversations((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (editingTaskId === id) {
        resetForm();
        setOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track team assignments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTaskId ? "Edit Task" : "Create Task"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Assign to team" /></SelectTrigger>
                <SelectContent>
                  {teamList.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={saveTask} className="w-full" disabled={!title.trim() || !teamId}>
                {editingTaskId ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="space-y-4">
        {taskList.map((task, i) => {
          const Icon = statusIcons[task.status] ?? Circle;
          const team = teamList.find((t) => t.id === task.teamId);
          const isUpdating = updatingTaskIds.has(task.id);
          const canStart = task.status === "pending" || task.status === "paused" || task.status === "stopped" || task.status === "completed";
          const canPause = task.status === "in-progress";
          const canStop = task.status === "in-progress" || task.status === "paused";
          const messages = taskConversations[task.id] ?? [];
          const isConversationLoading = loadingConversationTaskIds.has(task.id);
          const visibleMessages = messages.slice(-8);
          const isRestart = task.status === "completed";
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${statusColors[task.status]}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold">{task.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
                    <div className="mt-3 flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(task)} disabled={isUpdating}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id)} disabled={isUpdating}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-muted-foreground font-mono">{team?.name}</span>
                      <div className="flex -space-x-1">
                        {task.assignedAgents.slice(0, 4).map((aid) => {
                          const agent = agentById.get(aid);
                          return agent ? (
                            <div key={aid} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold border-2 border-card">
                              {agent.avatar}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={task.status === "in-progress" ? "default" : "outline"}
                        onClick={() => updateTaskStatus(task, "in-progress")}
                        disabled={!canStart || isUpdating}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        {isRestart ? "Restart" : "Start"}
                      </Button>
                      <Button
                        size="sm"
                        variant={task.status === "paused" ? "default" : "outline"}
                        onClick={() => updateTaskStatus(task, "paused")}
                        disabled={!canPause || isUpdating}
                      >
                        <Pause className="w-3.5 h-3.5 mr-1" />
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant={task.status === "stopped" ? "destructive" : "outline"}
                        onClick={() => updateTaskStatus(task, "stopped")}
                        disabled={!canStop || isUpdating}
                      >
                        <Square className="w-3.5 h-3.5 mr-1" />
                        Stop
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="w-32 flex-shrink-0">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground capitalize">{task.status}</span>
                    <span className="font-bold">{task.progress}%</span>
                  </div>
                  <Progress value={task.progress} className="h-1.5" />
                </div>
              </div>

              {(task.status === "in-progress" || messages.length > 0) && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conversation Stream
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {task.status === "in-progress" && <span className="w-1.5 h-1.5 rounded-full bg-agent-dev animate-pulse" />}
                      <span>{task.status === "in-progress" ? "Live" : "Recent"}</span>
                    </div>
                  </div>

                  {isConversationLoading && messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Loading conversation...</p>
                  ) : visibleMessages.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {visibleMessages.map((msg) => {
                        const agent = agentById.get(msg.agentId);
                        const ts = new Date(msg.timestamp);
                        return (
                          <div key={msg.id} className="rounded-md border border-border/60 p-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${getAgentRoleColor(agent?.role || "")}`}
                              >
                                {agent?.avatar ?? "?"}
                              </div>
                              <span className="text-xs font-semibold">{agent?.name ?? msg.agentId}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {isNaN(ts.getTime()) ? msg.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{msg.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No conversation yet for this task.</p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
