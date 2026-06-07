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
  subagent_enabled?: boolean;
  owner_id?: string;
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
  owner_id?: string;
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

export type GoogleSheetOAuthStartResponse = {
  authorize_url: string;
  state: string;
  expires_in_seconds: number;
  redirect_uri?: string;
};

export type GoogleSheetOAuthStatusResponse = {
  state: string;
  status: "pending" | "authorized" | "error";
  authorized: boolean;
  email: string;
  token_path: string;
  error: string;
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
  mode?: "mesh" | "sequential" | "ring" | "supervisor" | "tree";
  maxSteps?: number;
  owner_id?: string;
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
  owner_id?: string;
};

export type Message = {
  id: string;
  agentId: string;
  content: string;
  timestamp: string;
  taskId?: string | null;
};

export type GraphContextNode = {
  id: string;
  type: string;
  value: string;
  aliases: string[];
  source_message_ids: string[];
  chunk_ids: string[];
  created_at: string;
  updated_at: string;
  confidence: number;
  salience_score: number;
};

export type GraphContextEdge = {
  id: string;
  src: string;
  dst: string;
  relation: string;
  weight: number;
  source_message_ids: string[];
  chunk_ids: string[];
  created_at: string;
  updated_at: string;
};

export type GraphContextSnapshot = {
  conversation_id: string;
  version: number;
  schema_version: number;
  last_message_index: number;
  config: Record<string, unknown>;
  nodes: GraphContextNode[];
  edges: GraphContextEdge[];
  chunks: Record<string, string>;
  message_ids: string[];
  updated_at: string | null;
};

export type PlatformHook = {
  id: string;
  platform: string;
  name: string;
  config: Record<string, unknown>;
  description: string;
  enabled: boolean;
};

export type Workspace = {
  id: string;
  name: string;
  description: string;
  teamIds: string[];
  primaryTeamId: string;
  platformHooks: PlatformHook[];
  createdAt: string;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  owner_id?: string;
};

export type ThirdPartyConnection = {
  id: string;
  platform: string;
  name: string;
  config: Record<string, string>;
  description: string;
  createdAt: string;
};

export type PlatformConfigField = {
  key: string;
  label: string;
  input: "text" | "textarea" | "select" | "boolean";
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  options?: string[];
};

export type PlatformDef = {
  platform: string;
  label: string;
  config_fields: PlatformConfigField[];
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

// ─── Office Builder (chat to create office → departments → humans → skills) ──

export type OfficeSkillPlan = {
  name: string;
  description: string;
  tool_name?: string | null;
};

export type OfficeHumanPlan = {
  name: string;
  role: string;
  description: string;
  skills: OfficeSkillPlan[];
};

export type OfficeDepartmentPlan = {
  name: string;
  description: string;
  mode: "sequential" | "mesh" | "ring" | "supervisor" | "tree" | string;
  humans: OfficeHumanPlan[];
};

export type OfficePlan = {
  name: string;
  description: string;
  departments: OfficeDepartmentPlan[];
};

export type OfficeChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OfficeBuilderChatResponse = {
  reply: string;
  plan: OfficePlan | null;
};

export type OfficeBuilderStreamEvent =
  | { type: "delta"; text: string }
  | { type: "plan"; plan: OfficePlan }
  | { type: "done"; reply: string }
  | { type: "error"; detail: string };

export type ApplyOfficePlanResponse = {
  workspace: Workspace;
  team_ids: string[];
  agent_ids: string[];
  skill_ids: string[];
  reused_skill_ids: string[];
};

export type OfficeBuilderSession = {
  id: string;
  title: string;
  messages: OfficeChatMessage[];
  plan: OfficePlan | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  owner_id?: string;
};

export type OfficeBuilderSessionSummary = {
  id: string;
  title: string;
  messageCount: number;
  hasPlan: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  owner_id?: string;
};

// ─── Ownership helpers ───────────────────────────────────────────────────────
// Items owned by "default" are shared with everyone; only the default (admin)
// account may delete them. Other users/guests can only delete their own items.
export const DEFAULT_OWNER_ID = "default";

export function getCurrentUserId(): string {
  try {
    const raw = localStorage.getItem("ai-collective-user");
    const u = raw ? (JSON.parse(raw) as { id?: string; role?: string } | null) : null;
    // Admins act in the shared "default" scope (mirrors the backend rule).
    if (u?.role === "admin" || u?.role === "system") return DEFAULT_OWNER_ID;
    return u?.id || "guest";
  } catch {
    return "guest";
  }
}

/** True when the current user may delete this item (matches backend can_delete rule). */
export function canDeleteItem(item: { owner_id?: string }): boolean {
  return (item.owner_id ?? DEFAULT_OWNER_ID) === getCurrentUserId();
}

/** Editing shared items follows the same ownership rule — only the owner sees the edit button. */
export const canEditItem = canDeleteItem;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  joinedAt?: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

type ApiOptions = RequestInit & { timeoutMs?: number };

function getApiBase(): string {
  // Default matches backend README.
  return ((import.meta as any).env?.VITE_API_BASE_URL as string) || "http://localhost:8000/api/v1";
}

// Backend Swagger docs URL, derived from the API base (strip /api/vN, append /docs).
export const API_DOCS_URL = `${getApiBase().replace(/\/$/, "").replace(/\/api\/v\d+$/, "")}/docs`;

function getAuthHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem("ai-collective-token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // ignore
  }
  return {};
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
        ...getAuthHeader(),
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
  startSheetOAuth: (payload: { email_hint?: string; tool_name?: string }) =>
    apiFetch<GoogleSheetOAuthStartResponse>("/auth/oauth/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSheetOAuthStatus: (state: string) =>
    apiFetch<GoogleSheetOAuthStatusResponse>(`/auth/oauth/status?state=${encodeURIComponent(state)}`),
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
  getTaskGraphContext: (taskId: string) => apiFetch<GraphContextSnapshot>(`/tasks/${encodeURIComponent(taskId)}/graph-context`),
  addConversation: (payload: { agentId: string; content: string; taskId?: string | null }) =>
    apiFetch<Message>("/conversations", { method: "POST", body: JSON.stringify(payload) }),
  // Human-in-the-loop: queue a user message for an actively streaming run.
  // The next agent turn picks it up and injects it into its context.
  interjectAgentGraph: (payload: { conversation_id: string; content: string }) =>
    apiFetch<{ queued: boolean; message_id: string | null }>("/llm/agent-graph/interject", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Interrupt an active run: current agent finishes its turn, then the run
  // holds at the turn boundary so the user can chat before resuming.
  pauseAgentGraph: (payload: { conversation_id: string }) =>
    apiFetch<{ paused: boolean }>("/llm/agent-graph/pause", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resumeAgentGraph: (payload: { conversation_id: string }) =>
    apiFetch<{ resumed: boolean }>("/llm/agent-graph/resume", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Answer an agent's ask_user question (the agent is blocked waiting on it).
  respondAgentGraph: (payload: { conversation_id: string; request_id: string; response: string }) =>
    apiFetch<{ delivered: boolean }>("/llm/agent-graph/respond", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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
    mode?: "mesh" | "sequential" | "ring" | "supervisor" | "tree";
    conversation_id?: string;
    signal?: AbortSignal;
    graph_config?: {
      build_method?: "rule" | "embedding" | "ie";
      entity_method?: "keyword" | "capitalized" | "hybrid";
      relation_method?: "pattern" | "cooccurrence" | "dependency";
      retrieve_method?: "lexical" | "embedding" | "hybrid";
      expand_hops?: number;
      top_k_nodes?: number;
      top_k_edges?: number;
      min_score_threshold?: number;
      recency_weight?: number;
      similarity_weight?: number;
      edge_weight?: number;
      persist_mode?: "snapshot" | "snapshot_plus_log";
    };
  }) {
    const base = getApiBase().replace(/\/$/, "");
    const url = `${base}/llm/agent-graph/run-stream`;
    const body = JSON.stringify({
      user_input: payload.user_input,
      agents: payload.agents,
      max_rounds: payload.max_rounds ?? 6,
      mode: payload.mode ?? "sequential",
      conversation_id: payload.conversation_id,
      graph_config: payload.graph_config,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: payload.signal,
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

    // Cancel the reader when the abort signal fires so reader.read() resolves immediately
    const abortHandler = () => reader.cancel();
    payload.signal?.addEventListener("abort", abortHandler);

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
      payload.signal?.removeEventListener("abort", abortHandler);
      reader.releaseLock();
    }
  },

  // Office Builder: iterative plan generation + one-shot creation.
  officeBuilderChat: (payload: { messages: OfficeChatMessage[]; plan?: OfficePlan | null }) =>
    apiFetch<OfficeBuilderChatResponse>("/office-builder/plan", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 300000,
    }),
  applyOfficePlan: (payload: { plan: OfficePlan }) =>
    apiFetch<ApplyOfficePlanResponse>("/office-builder/apply", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 300000,
    }),
  // Streaming variant of officeBuilderChat — yields delta/plan/done/error events.
  officeBuilderChatStream: async function* (payload: {
    messages: OfficeChatMessage[];
    plan?: OfficePlan | null;
    signal?: AbortSignal;
  }): AsyncGenerator<OfficeBuilderStreamEvent> {
    const base = getApiBase().replace(/\/$/, "");
    const res = await fetch(`${base}/office-builder/plan-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ messages: payload.messages, plan: payload.plan ?? null }),
      signal: payload.signal,
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

    const abortHandler = () => reader.cancel();
    payload.signal?.addEventListener("abort", abortHandler);

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
              yield JSON.parse(line.slice(6)) as OfficeBuilderStreamEvent;
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } finally {
      payload.signal?.removeEventListener("abort", abortHandler);
      reader.releaseLock();
    }
  },

  listOfficeBuilderSessions: () =>
    apiFetch<OfficeBuilderSessionSummary[]>("/office-builder/sessions"),
  getOfficeBuilderSession: (id: string) =>
    apiFetch<OfficeBuilderSession>(`/office-builder/sessions/${encodeURIComponent(id)}`),
  upsertOfficeBuilderSession: (payload: {
    id?: string | null;
    title?: string;
    messages: OfficeChatMessage[];
    plan?: OfficePlan | null;
    workspaceId?: string;
  }) =>
    apiFetch<OfficeBuilderSession>("/office-builder/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteOfficeBuilderSession: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/office-builder/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  getAnalytics: () => apiFetch<Analytics>("/analytics"),
  listActivityFeed: () => apiFetch<ActivityFeedItem[]>("/activity-feed"),

  listWorkspaces: () => apiFetch<Workspace[]>("/workspaces"),
  getWorkspace: (id: string) => apiFetch<Workspace>(`/workspaces/${id}`),
  upsertWorkspace: (payload: Partial<Workspace> & Pick<Workspace, "name">) =>
    apiFetch<Workspace>("/workspaces", { method: "POST", body: JSON.stringify(payload) }),
  deleteWorkspace: (id: string) => apiFetch<{ deleted: boolean }>(`/workspaces/${id}`, { method: "DELETE" }),
  listPlatforms: () => apiFetch<PlatformDef[]>("/workspaces/platforms"),

  listConnections: () => apiFetch<ThirdPartyConnection[]>("/connections"),
  upsertConnection: (payload: Partial<ThirdPartyConnection> & Pick<ThirdPartyConnection, "platform" | "name">) =>
    apiFetch<ThirdPartyConnection>("/connections", { method: "POST", body: JSON.stringify(payload) }),
  deleteConnection: (id: string) => apiFetch<{ deleted: boolean }>(`/connections/${id}`, { method: "DELETE" }),

  // Auth
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    apiFetch<LoginResponse>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  getCurrentUser: () => apiFetch<AuthUser>("/auth/me"),
  updateProfile: (payload: { name?: string; email?: string; avatar?: string | null }) =>
    apiFetch<AuthUser>("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<void>("/auth/password", { method: "PATCH", body: JSON.stringify({ current_password, new_password }) }),
  uploadAvatar: async (file: File): Promise<AuthUser> => {
    const base = getApiBase().replace(/\/$/, "");
    const url = `${base}/auth/avatar`;
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("ai-collective-token");
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data?.detail) detail = String(data.detail);
      } catch { /* ignore */ }
      throw new Error(detail);
    }
    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar ?? undefined,
      role: data.role,
      joinedAt: data.joined_at ?? undefined,
    };
  },
};
