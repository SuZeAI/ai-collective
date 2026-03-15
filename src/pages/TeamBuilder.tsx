import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { teams as initialTeams, agents, getAgent, Team } from "@/data/mock-data";

export default function TeamBuilder() {
  const [teamList, setTeamList] = useState<Team[]>(initialTeams);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const addTeam = () => {
    if (!name || selectedAgents.length === 0) return;
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name,
      description: desc || "Custom team",
      agents: selectedAgents,
      activeTasks: 0,
    };
    setTeamList((prev) => [...prev, newTeam]);
    setName(""); setDesc(""); setSelectedAgents([]); setOpen(false);
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">Assemble agent teams for complex tasks.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Team</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Agents</label>
                {agents.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <Checkbox checked={selectedAgents.includes(a.id)} onCheckedChange={() => toggleAgent(a.id)} />
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">({a.role})</span>
                  </label>
                ))}
              </div>
              <Button onClick={addTeam} className="w-full" disabled={!name || selectedAgents.length === 0}>Create Team</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teamList.map((team, i) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold">{team.name}</h3>
                <p className="text-xs text-muted-foreground">{team.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {team.agents.map((agentId) => {
                const agent = getAgent(agentId);
                if (!agent) return null;
                return (
                  <span key={agentId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                    {agent.avatar} {agent.name}
                  </span>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{team.activeTasks} active tasks</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
