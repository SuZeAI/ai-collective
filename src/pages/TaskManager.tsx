import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, CheckCircle2, Clock, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { tasks as initialTasks, teams, getAgent, Task } from "@/data/mock-data";

const statusIcons = {
  "pending": Circle,
  "in-progress": Clock,
  "completed": CheckCircle2,
};

const statusColors: Record<string, string> = {
  "pending": "text-muted-foreground",
  "in-progress": "text-primary",
  "completed": "text-agent-dev",
};

export default function TaskManager() {
  const [taskList, setTaskList] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [teamId, setTeamId] = useState("");
  const [open, setOpen] = useState(false);

  const addTask = () => {
    if (!title || !teamId) return;
    const team = teams.find((t) => t.id === teamId);
    const newTask: Task = {
      id: `task${Date.now()}`,
      title,
      description: desc,
      teamId,
      status: "pending",
      progress: 0,
      assignedAgents: team?.agents || [],
    };
    setTaskList((prev) => [...prev, newTask]);
    setTitle(""); setDesc(""); setTeamId(""); setOpen(false);
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
            <Button><Plus className="w-4 h-4 mr-2" /> New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Assign to team" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={addTask} className="w-full" disabled={!title || !teamId}>Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="space-y-4">
        {taskList.map((task, i) => {
          const Icon = statusIcons[task.status];
          const team = teams.find((t) => t.id === task.teamId);
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
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-muted-foreground font-mono">{team?.name}</span>
                      <div className="flex -space-x-1">
                        {task.assignedAgents.slice(0, 4).map((aid) => {
                          const agent = getAgent(aid);
                          return agent ? (
                            <div key={aid} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold border-2 border-card">
                              {agent.avatar}
                            </div>
                          ) : null;
                        })}
                      </div>
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
