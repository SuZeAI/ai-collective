import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentAvatar } from "@/components/AgentAvatar";
import { api, type Agent, type Message, type Task, type Team } from "@/lib/api";
import { getAgentRoleColor } from "@/lib/agent-role-ui";

export default function Conversations() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [msgs, ags, tks, tms] = await Promise.all([
          api.listConversations(),
          api.listAgents(),
          api.listTasks(),
          api.listTeams(),
        ]);
        if (cancelled) return;
        setMessages(msgs);
        setAgents(ags);
        setTasks(tks);
        setTeams(tms);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("Error loading conversations:", errorMsg);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const teamById = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((tm) => map.set(tm.id, tm));
    return map;
  }, [teams]);

  // Filter messages based on selected filters
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (selectedAgentId && msg.agentId !== selectedAgentId) return false;
      if (selectedTaskId && msg.taskId !== selectedTaskId) return false;
      if (selectedTeamId) {
        const task = taskById.get(msg.taskId || "");
        if (!task || task.teamId !== selectedTeamId) return false;
      }
      return true;
    });
  }, [messages, selectedAgentId, selectedTaskId, selectedTeamId, taskById]);

  const messageCount = filteredMessages.length;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 mb-4 px-1">
        <h1 className="text-4xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground mt-2">Browse and filter all agent communications across teams and tasks.</p>
      </header>

      {loading && (
        <div className="glass-card p-12 text-center flex-1 flex items-center justify-center">
          <div>
            <p className="text-muted-foreground text-lg">Loading conversations...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-6 border-2 border-destructive/50 rounded-lg mb-6 bg-destructive/8">
          <p className="text-destructive font-bold text-lg">Error loading conversations</p>
          <p className="text-destructive/80 text-sm mt-2">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="glass-card overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Filters Section - Fixed, No Scroll */}
          <div className="flex-shrink-0 p-6 border-b border-border bg-gradient-to-r from-background to-muted/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Filter Conversations</p>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {messageCount} {messageCount === 1 ? "message" : "messages"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-2 uppercase tracking-wide">Team</label>
                  <Select value={selectedTeamId === "" ? "__all__" : selectedTeamId} onValueChange={(val) => {
                    setSelectedTeamId(val === "__all__" ? "" : val);
                    setSelectedTaskId("");
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All teams</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-2 uppercase tracking-wide">Task</label>
                  <Select value={selectedTaskId === "" ? "__all__" : selectedTaskId} onValueChange={(val) => {
                    setSelectedTaskId(val === "__all__" ? "" : val);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All tasks</SelectItem>
                      {tasks
                        .filter((t) => !selectedTeamId || t.teamId === selectedTeamId)
                        .map((task) => (
                          <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-2 uppercase tracking-wide">Agent</label>
                  <Select value={selectedAgentId === "" ? "__all__" : selectedAgentId} onValueChange={(val) => {
                    setSelectedAgentId(val === "__all__" ? "" : val);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All agents</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Conversations Display */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((msg, i) => {
                const agent = agentById.get(msg.agentId);
                const task = taskById.get(msg.taskId || "");
                const team = task ? teamById.get(task.teamId) : null;
                const agentName = agent?.name || "Unknown Agent";
                const agentRole = agent?.role || "unknown";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border border-border/50 rounded-lg p-5 bg-card/50 hover:bg-card/80 transition-all duration-200 hover:shadow-md hover:border-border"
                  >
                    <div className="flex gap-4 items-start mb-3">
                      <AgentAvatar
                        agent={agent || { avatar: "?" }}
                        className={`mt-1 w-10 h-10 flex-shrink-0 shadow-sm ${agent ? (agent.avatar_color ? "" : getAgentRoleColor(agentRole)) : "bg-muted text-muted-foreground"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap mb-2">
                          <span className="text-sm font-bold text-foreground">{agentName}</span>
                          <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                            {agentRole}
                          </span>
                          {team && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                              Team: {team.name}
                            </span>
                          )}
                          {task && (
                            <span className="text-xs bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded border border-violet-500/20">
                              Task: {task.title}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono ml-auto">
                            {(() => {
                              const d = new Date(msg.timestamp);
                              return isNaN(d.getTime())
                                ? msg.timestamp
                                : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:text-muted-foreground [&>p]:leading-relaxed [&>p:last-child]:mb-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground font-medium">No conversations found</p>
                  <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters to see messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
