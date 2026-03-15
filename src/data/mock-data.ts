export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: "active" | "idle" | "thinking";
  avatar: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  agents: string[]; // agent ids
  activeTasks: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  teamId: string;
  status: "pending" | "in-progress" | "completed";
  progress: number;
  assignedAgents: string[];
}

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: string;
  taskId?: string;
}

export interface Analytics {
  tasksCompleted: number;
  avgCompletionTime: string;
  teamEfficiency: number;
  agentProductivity: Record<string, number>;
}

export const agents: Agent[] = [
  { id: "a1", name: "Sarah", role: "Project Manager", description: "Coordinates agents, assigns subtasks, and ensures timely delivery.", status: "active", avatar: "S" },
  { id: "a2", name: "Cortex", role: "Research Agent", description: "Collects data, analyzes competitors, and surfaces insights.", status: "active", avatar: "C" },
  { id: "a3", name: "Unit 7", role: "Developer Agent", description: "Implements technical solutions and builds structures.", status: "idle", avatar: "U" },
  { id: "a4", name: "Echo", role: "Marketing Agent", description: "Creates copy, campaigns, and high-conversion content.", status: "idle", avatar: "E" },
  { id: "a5", name: "Sigma", role: "Reviewer Agent", description: "Evaluates output quality and suggests improvements.", status: "idle", avatar: "Σ" },
];

export const teams: Team[] = [
  { id: "t1", name: "Launch Squad Alpha", description: "Full-stack product launch team for rapid MVPs.", agents: ["a1", "a2", "a3", "a4", "a5"], activeTasks: 3 },
  { id: "t2", name: "Content Ops", description: "Content strategy and production pipeline.", agents: ["a1", "a2", "a4"], activeTasks: 2 },
  { id: "t3", name: "Code Review Cell", description: "Automated code quality and architecture review.", agents: ["a3", "a5"], activeTasks: 1 },
];

export const tasks: Task[] = [
  { id: "task1", title: "Create landing page for AI startup", description: "Design and build a high-conversion landing page.", teamId: "t1", status: "in-progress", progress: 65, assignedAgents: ["a1", "a2", "a3", "a4", "a5"] },
  { id: "task2", title: "Competitive analysis report", description: "Research top 10 competitors in the AI agent space.", teamId: "t1", status: "completed", progress: 100, assignedAgents: ["a2", "a1"] },
  { id: "task3", title: "Write product documentation", description: "Create comprehensive docs for the API.", teamId: "t2", status: "pending", progress: 0, assignedAgents: ["a4", "a5"] },
  { id: "task4", title: "Refactor authentication module", description: "Improve security and code quality of auth.", teamId: "t3", status: "in-progress", progress: 40, assignedAgents: ["a3", "a5"] },
  { id: "task5", title: "Design marketing campaign", description: "Q1 launch campaign across channels.", teamId: "t2", status: "in-progress", progress: 30, assignedAgents: ["a4", "a1"] },
];

export const conversations: Message[] = [
  { id: "m1", agentId: "a1", content: "I've broken down the landing page task into 4 subtasks. Assigning now.", timestamp: "10:02:14", taskId: "task1" },
  { id: "m2", agentId: "a2", content: "Analyzing 5 competitor landing pages for structure and messaging patterns.", timestamp: "10:02:28", taskId: "task1" },
  { id: "m3", agentId: "a3", content: "Scaffolding the component architecture. Using a hero + features + CTA layout.", timestamp: "10:03:01", taskId: "task1" },
  { id: "m4", agentId: "a4", content: "Drafting headline variants: 'Deploy AI Teams in Seconds' scored highest.", timestamp: "10:03:45", taskId: "task1" },
  { id: "m5", agentId: "a5", content: "Review: Headline is strong. Suggest adding social proof above the fold.", timestamp: "10:04:12", taskId: "task1" },
  { id: "m6", agentId: "a1", content: "Good catch, Sigma. Echo, add a testimonial section. Unit 7, make room in the layout.", timestamp: "10:04:30", taskId: "task1" },
];

export const activityFeed = [
  { id: "f1", agentId: "a2", action: "collected competitor data", time: "2 min ago" },
  { id: "f2", agentId: "a3", action: "generated UI structure", time: "4 min ago" },
  { id: "f3", agentId: "a4", action: "created product description", time: "6 min ago" },
  { id: "f4", agentId: "a5", action: "approved output quality", time: "8 min ago" },
  { id: "f5", agentId: "a1", action: "assigned new subtasks", time: "10 min ago" },
];

export const analyticsData: Analytics = {
  tasksCompleted: 42,
  avgCompletionTime: "3.8 min",
  teamEfficiency: 92,
  agentProductivity: { a1: 95, a2: 88, a3: 91, a4: 85, a5: 98 },
};

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
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
