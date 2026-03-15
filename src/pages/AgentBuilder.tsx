import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agents as initialAgents, Agent, getAgentRoleColor, getAgentDotColor } from "@/data/mock-data";

const roles = ["Project Manager", "Research Agent", "Developer Agent", "Marketing Agent", "Reviewer Agent"];

export default function AgentBuilder() {
  const [agentList, setAgentList] = useState<Agent[]>(initialAgents);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [desc, setDesc] = useState("");
  const [open, setOpen] = useState(false);

  const addAgent = () => {
    if (!name || !role) return;
    const newAgent: Agent = {
      id: `a${Date.now()}`,
      name,
      role,
      description: desc || `${role} agent`,
      status: "idle",
      avatar: name[0].toUpperCase(),
    };
    setAgentList((prev) => [...prev, newAgent]);
    setName(""); setRole(""); setDesc(""); setOpen(false);
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground mt-1">Create and manage your AI agent roster.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Agent</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Agent</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Button onClick={addAgent} className="w-full" disabled={!name || !role}>Create Agent</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agentList.map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${getAgentRoleColor(agent.role)}`}>
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold truncate">{agent.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-agent-dev animate-pulse" : "bg-muted-foreground/30"}`} />
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{agent.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getAgentDotColor(agent.role)}`} />
                  <span className="text-xs text-muted-foreground">{agent.role}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{agent.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
