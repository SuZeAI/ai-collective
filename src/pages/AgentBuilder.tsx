import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { api, type Agent, type Skill } from "@/lib/api";
import { getAgentDotColor, getAgentRoleColor } from "@/lib/agent-role-ui";

const roles = [
  "Project Manager",
  "Research Agent",
  "Developer Agent",
  "Marketing Agent",
  "Reviewer Agent",
  "Support Agent",
  "Community Agent",
  "Sales Agent",
  "HR Agent",
  "Ops Agent",
  "Finance Agent",
] as const;

type Role = (typeof roles)[number];

export default function AgentBuilder() {
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [desc, setDesc] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agents, skills] = await Promise.all([api.listAgents(), api.listSkills()]);
        if (cancelled) return;
        setAgentList(agents);
        setSkillCatalog(skills);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSkills = useMemo(() => {
    const byId = new Map(skillCatalog.map((s) => [s.id, s] as const));
    return selectedSkillIds.map((id) => byId.get(id)).filter(Boolean) as Skill[];
  }, [skillCatalog, selectedSkillIds]);

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeSelectedSkill = (id: string) => {
    setSelectedSkillIds((prev) => prev.filter((x) => x !== id));
  };

  const addAgent = async () => {
    if (!name.trim() || !role) return;
    try {
      const saved = await api.upsertAgent({
        name: name.trim(),
        role,
        description: desc,
        skills: selectedSkills,
        status: "idle",
        avatar: name.trim()[0]?.toUpperCase(),
      });
      setAgentList((prev) => [...prev, saved]);
      setName("");
      setRole("");
      setDesc("");
      setSelectedSkillIds([]);
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
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
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Agent</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />

              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />

              <div className="space-y-2">
                <div className="text-sm font-medium">Skills</div>

                {skillCatalog.length ? (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Select skills to assign</div>
                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                      {skillCatalog.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedSkillIds.includes(s.id)}
                            onCheckedChange={() => toggleSkill(s.id)}
                          />
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({s.kind}
                            {s.third_party ? ` • ${s.third_party}` : ""})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No skills yet. Create skills in the Skills page.</p>
                )}

                {selectedSkills.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedSkills.map((s) => (
                      <Badge key={s.id} variant="secondary" className="inline-flex items-center gap-1">
                        <span className="truncate max-w-[180px]">{s.name}</span>
                        {s.third_party ? <span className="text-muted-foreground">({s.third_party})</span> : null}
                        <button
                          type="button"
                          onClick={() => removeSelectedSkill(s.id)}
                          className="ml-1 inline-flex items-center justify-center"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No skills selected yet.</p>
                )}
              </div>

              <Button onClick={addAgent} className="w-full" disabled={!name.trim() || !role}>
                Create Agent
              </Button>
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
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${getAgentRoleColor(
                  agent.role
                )}`}
              >
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold truncate">{agent.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.status === "active" ? "bg-agent-dev animate-pulse" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{agent.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getAgentDotColor(agent.role)}`} />
                  <span className="text-xs text-muted-foreground">{agent.role}</span>
                </div>

                {agent.skills?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {agent.skills.slice(0, 3).map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-[10px]">
                        {s.name}
                      </Badge>
                    ))}
                    {agent.skills.length > 3 ? (
                      <span className="text-[10px] text-muted-foreground">+{agent.skills.length - 3}</span>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{agent.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
