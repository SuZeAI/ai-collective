export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  system_prompt?: string;
  skill_ids: string[];
  skills: Skill[];
  status: "active" | "idle" | "thinking" | string;
  avatar: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  third_party: string;
  tool_name?: string | null;
  kind: "integration" | "custom-js" | string;
  config: Record<string, unknown>;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  code?: string | null;
};

export type SkillToolOption = {
  tool_name: string;
};

export type SkillToolConfigField = {
  key: string;
  label: string;
  input: "text" | "textarea" | "select" | "boolean";
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  options?: string[];
  rows?: number | null;
  description?: string;
};

export type SkillToolPreset = {
  tool_name: string;
  label: string;
  third_party: string;
  config_fields: SkillToolConfigField[];
};

export type Team = {
  id: string;
  name: string;
  description: string;
  agents: string[];
  activeTasks: number;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  mode?: "mesh" | "sequential";
  maxSteps?: number;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  teamId: string;
  status: "pending" | "in-progress" | "paused" | "stopped" | "completed" | string;
  progress: number;
  assignedAgents: string[];
  startTime?: string | null;
  endTime?: string | null;
};

export type Message = {
  id: string;
  agentId: string;
  content: string;
  timestamp: string;
  taskId?: string | null;
};

export type Analytics = {
  tasksCompleted: number;
  avgCompletionTime: string;
  teamEfficiency: number;
  agentProductivity: Record<string, number>;
};

export type ActivityFeedItem = {
  id: string;
  agentId: string;
  action: string;
  time: string;
};

export type ChatRequest = {
  prompt: string;
  system?: string;
  agentId?: string;
};

export type ChatResponse = {
  response: string;
};

type ApiOptions = RequestInit & { timeoutMs?: number };

function getApiBase(): string {
  // Default matches backend README.
  return ((import.meta as any).env?.VITE_API_BASE_URL as string) || "http://localhost:8000/api/v1";
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const base = getApiBase().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 180000;
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data?.detail) detail = String(data.detail);
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timeout after ${Math.round(timeout / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

export const api = {
  listAgents: () => apiFetch<Agent[]>("/agents"),
  upsertAgent: (payload: Partial<Agent> & Pick<Agent, "name" | "role">) =>
    apiFetch<Agent>("/agents", { method: "POST", body: JSON.stringify(payload) }),
  deleteAgent: (id: string) => apiFetch<{ deleted: boolean }>(`/agents/${id}`, { method: "DELETE" }),

  listSkills: () => apiFetch<Skill[]>("/skills"),
  listSkillTools: () => apiFetch<string[]>("/skills/tools"),
  listSkillToolPresets: () => apiFetch<SkillToolPreset[]>("/skills/tool-presets"),
  upsertSkill: (payload: Partial<Skill> & Pick<Skill, "name" | "kind">) =>
    apiFetch<Skill>("/skills", { method: "POST", body: JSON.stringify(payload) }),
  deleteSkill: (id: string) => apiFetch<{ deleted: boolean }>(`/skills/${id}`, { method: "DELETE" }),

  listTeams: () => apiFetch<Team[]>("/teams"),
  upsertTeam: (payload: Partial<Team> & Pick<Team, "name" | "agents">) =>
    apiFetch<Team>("/teams", { method: "POST", body: JSON.stringify(payload) }),
  deleteTeam: (id: string) => apiFetch<{ deleted: boolean }>(`/teams/${id}`, { method: "DELETE" }),

  listTasks: () => apiFetch<Task[]>("/tasks"),
  upsertTask: (payload: Partial<Task> & Pick<Task, "title" | "teamId">) =>
    apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  deleteTask: (id: string) => apiFetch<{ deleted: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  listConversations: (taskId?: string) => {
    const qs = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
    return apiFetch<Message[]>(`/conversations${qs}`);
  },
  addConversation: (payload: { agentId: string; content: string; taskId?: string | null }) =>
    apiFetch<Message>("/conversations", { method: "POST", body: JSON.stringify(payload) }),
  chat: (payload: ChatRequest, options?: { timeoutMs?: number }) =>
    apiFetch<ChatResponse>("/llm/chat", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: options?.timeoutMs,
    }),

  runAgentGraphStream: async function* (payload: {
    user_input: string;
    agents: string[];
    max_rounds?: number;
    mode?: "mesh" | "sequential";
  }) {
    const base = getApiBase().replace(/\/$/, "");
    const url = `${base}/llm/agent-graph/run-stream`;
    const body = JSON.stringify({
      user_input: payload.user_input,
      agents: payload.agents,
      max_rounds: payload.max_rounds ?? 6,
      mode: payload.mode ?? "sequential",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data?.detail) detail = String(data.detail);
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);
              yield data;
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  getAnalytics: () => apiFetch<Analytics>("/analytics"),
  listActivityFeed: () => apiFetch<ActivityFeedItem[]>("/activity-feed"),
};
