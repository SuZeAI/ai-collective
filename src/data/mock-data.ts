// NOTE: mock lists were removed. Frontend now fetches real data from backend.

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: "active" | "idle" | "thinking" | string;
  avatar: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  agents: string[];
  activeTasks: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  teamId: string;
  status: "pending" | "in-progress" | "completed" | string;
  progress: number;
  assignedAgents: string[];
}

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: string;
  taskId?: string | null;
}

export interface Analytics {
  tasksCompleted: number;
  avgCompletionTime: string;
  teamEfficiency: number;
  agentProductivity: Record<string, number>;
}

export function getAgentRoleColor(role: string): string {
  if (role.includes("Manager")) return "bg-agent-pm/15 text-agent-pm";
  if (role.includes("Developer")) return "bg-agent-dev/15 text-agent-dev";
  if (role.includes("Research")) return "bg-agent-research/15 text-agent-research";
  if (role.includes("Marketing")) return "bg-agent-marketing/15 text-agent-marketing";
  if (role.includes("Review")) return "bg-agent-reviewer/15 text-agent-reviewer";
  return "bg-muted text-muted-foreground";
}

export function getAgentDotColor(role: string): string {
  if (role.includes("Manager")) return "bg-agent-pm";
  if (role.includes("Developer")) return "bg-agent-dev";
  if (role.includes("Research")) return "bg-agent-research";
  if (role.includes("Marketing")) return "bg-agent-marketing";
  if (role.includes("Review")) return "bg-agent-reviewer";
  return "bg-muted-foreground";
}
