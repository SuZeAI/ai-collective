import { AUTH_TOKEN_KEY, AUTH_USER_KEY, getApiBase, parseErrorDetail } from "@/lib/api-base";

export type Staff = {
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
  instruction?: string;
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

export type DepartmentMode = "mesh" | "sequential" | "ring" | "supervisor" | "tree" | "custom";

// For mode === "custom": the user-drawn flow graph. Node ids equal staff ids
// (one node per staff); positions are kept so the editor can restore the layout.
export type CustomFlowNode = { id: string; position: { x: number; y: number } };
export type CustomFlowEdge = { id: string; source: string; target: string };
export type CustomFlow = {
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
};

export type Department = {
  id: string;
  name: string;
  description: string;
  staff: string[];
  activeTasks: number;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  mode?: DepartmentMode;
  maxSteps?: number;
  owner_id?: string;
  flow?: CustomFlow | null;
};

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type IssueType = "epic" | "story" | "task" | "bug" | "subtask";

export type SprintStatus = "planned" | "active" | "completed";

export type TaskComment = {
  id: string;
  author_id: string;
  content: string;
  created_at?: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  status: "pending" | "in-progress" | "in-review" | "paused" | "stopped" | "completed" | string;
  progress: number;
  assignedStaff: string[];
  startTime?: string | null;
  endTime?: string | null;
  owner_id?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  labels?: string[];
  assigneeId?: string | null;
  comments?: TaskComment[];
  projectId?: string;
  issueType?: IssueType;
  issueKey?: string;
  epicId?: string | null;
  sprintId?: string | null;
  storyPoints?: number | null;
};

export type Project = {
  id: string;
  key: string;
  name: string;
  description?: string;
  leadId?: string;
  plannerStaffId?: string;
  plannerSystemPrompt?: string;
  issueCounter?: number;
  createdAt?: string | null;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  owner_id?: string;
};

export type Epic = {
  id: string;
  projectId: string;
  key?: string;
  title: string;
  description?: string;
  status?: string;
  color?: string;
  startDate?: string | null;
  dueDate?: string | null;
  owner_id?: string;
};

export type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  status?: SprintStatus;
  startDate?: string | null;
  endDate?: string | null;
  owner_id?: string;
};

export type DraftIssue = {
  title: string;
  type: IssueType;
  description?: string;
  storyPoints?: number | null;
  epicHint?: string;
};

export type Message = {
  id: string;
  staffId: string;
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

// A company's "type" tailors which operational options are *suggested* inside
// it (never hides any — see COMPANY_TYPES). Persisted on the company.
export type CompanyType = "software" | "marketing" | "research" | "general";

export type Company = {
  id: string;
  name: string;
  description: string;
  departmentIds: string[];
  primaryDepartmentId: string;
  // Client-populated from inbound-webhook Connections (not returned by the API).
  platformHooks?: PlatformHook[];
  createdAt: string;
  type?: CompanyType;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  owner_id?: string;
};

// Unified third-party integration (formerly PlatformHook + ThirdPartyConnection).
// `kind: "inbound_webhook"` = a per-company webhook (carries `companyId`);
// `kind: "outbound"` = an account-level connection.
export type Connection = {
  id: string;
  platform: string;
  name: string;
  config: Record<string, unknown>;
  description: string;
  enabled: boolean;
  kind: "inbound_webhook" | "outbound";
  companyId: string;
  // Per-connection routing override (inbound webhooks). Empty → company primary department.
  routingDepartmentId: string;
  routingStaffIds: string[];
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
  departmentEfficiency: number;
  staffProductivity: Record<string, number>;
};

export type ActivityFeedItem = {
  id: string;
  staffId: string;
  action: string;
  time: string;
};

export type ChatRequest = {
  prompt: string;
  system?: string;
  staffId?: string;
  conversationId?: string;
};

export type ChatResponse = {
  response: string;
};

export type SimulationStep = {
  staff: string;
  msg: string;
  delay_ms: number;
  phase?: number | null;
};

export type SimulationPlanResponse = {
  steps: SimulationStep[];
};

// ─── Office Builder (chat to create office → departments → staff → skills) ──

export type OfficeSkillPlan = {
  name: string;
  description: string;
  tool_name?: string | null;
};

export type OfficeStaffPlan = {
  name: string;
  role: string;
  description: string;
  skills: OfficeSkillPlan[];
};

export type OfficeDepartmentPlan = {
  name: string;
  description: string;
  mode: DepartmentMode | string;
  staff: OfficeStaffPlan[];
};

// Build the run-stream custom_graph payload from a department's saved flow. Returns
// undefined unless the department is in custom mode with at least one wired edge, so
// callers can fall back to another mode when the flow was never drawn.
export function buildCustomGraphPayload(
  department: Pick<Department, "mode" | "flow">,
): { edges: { source: string; target: string }[] } | undefined {
  if (department.mode !== "custom" || !department.flow?.edges?.length) return undefined;
  return {
    edges: department.flow.edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

export type OfficePlan = {
  name: string;
  description: string;
  company_type?: CompanyType;
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
  company: Company;
  department_ids: string[];
  staff_ids: string[];
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
  companyId: string;
  owner_id?: string;
};

export type OfficeBuilderSessionSummary = {
  id: string;
  title: string;
  messageCount: number;
  hasPlan: boolean;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  owner_id?: string;
};

// ─── Ownership helpers ───────────────────────────────────────────────────────
// Items owned by "default" are shared with everyone; only the default (admin)
// account may delete them. Other users/guests can only delete their own items.
export const DEFAULT_OWNER_ID = "default";

export function getCurrentUserId(): string {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
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

// Client-side average completion time for office-scoped views (the backend
// analytics endpoint aggregates globally). Shared by Dashboard and AnalyticsPage.
export function avgCompletionOf(tasks: Task[]): string {
  const durations = tasks
    .filter((t) => t.status === "completed" && t.startTime && t.endTime)
    .map((t) => new Date(t.endTime as string).getTime() - new Date(t.startTime as string).getTime())
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  if (durations.length === 0) return "—";
  const minutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ─── Admin monitoring ────────────────────────────────────────────────────────

export type ModelPricing = {
  model: string;
  provider: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
};

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  cost: number;
};

export type ModelUsage = {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
  priced: boolean;
};

export type UserUsage = {
  userId: string;
  name: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
};

export type DailyUsage = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
};

export type UsageSummary = {
  days: number;
  totals: UsageTotals;
  byModel: ModelUsage[];
  byUser: UserUsage[];
  byDay: DailyUsage[];
};

// Per-user cost monitoring: token/cost broken down by department (department),
// staff (staff) and human (user). Served by GET /consumption.
export type DepartmentConsumption = {
  departmentId: string;
  name: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
};

export type StaffConsumption = {
  staffName: string;
  name: string;
  role: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
};

export type Consumption = {
  days: number;
  totals: UsageTotals;
  byDepartment: DepartmentConsumption[];
  byStaff: StaffConsumption[];
  byUser: UserUsage[];
  byDay: DailyUsage[];
};

export type SystemHealth = {
  status: "ok" | "degraded" | string;
  environment: string;
  uptimeSeconds: number;
  requests: {
    totalRequests: number;
    errorRequests: number;
    errorRate: number;
    avgLatencyMs: number;
  };
  storage: { backend: string; ok: boolean; detail: string };
  llm: { provider: string; model: string; configured: boolean };
  taskQueueBackend: string;
  lockBackend: string;
  counts: { users: number; staff: number; departments: number; tasks: number; companies: number };
};

export type FileStorageStats = {
  backend: string;            // "local" | "s3"
  sandboxMode: string;
  companyBase: string;
  minioEnabled: boolean;
  minioConnected: boolean;
  minioEndpoint: string;
  minioBucket: string;
  minioError: string;
  libraryDocCount: number;
  libraryTotalBytes: number;
  sandboxObjectCount: number;
  sandboxTotalBytes: number;
  libraryObjectCount: number;
  libraryObjectBytes: number;
};

export type AdminUserActivity = {
  id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  joinedAt: string;
  staff: number;
  departments: number;
  tasks: number;
  companies: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
};

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

// Backend returns snake_case `joined_at`; normalize every auth response to the
// camelCase `joinedAt` the UI/type expects (previously only uploadAvatar did this).
export function mapAuthUser(raw: any): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    avatar: raw.avatar ?? undefined,
    role: raw.role,
    joinedAt: raw.joinedAt ?? raw.joined_at ?? undefined,
  };
}

export type MeetingFile = {
  id: string;
  conversationId: string;
  filename: string;
  size: number;
  contentType?: string | null;
  relPath: string;
  uploadedBy: string;
  producedByStaff?: string | null;
  createdAt: string;
};

export type LibraryDocument = {
  id: string;
  companyId: string;
  name: string;
  contentType: string;
  size: number;
  relPath: string;
  createdAt: string;
  description: string;
  source: string;
  sourceUrl: string;
  tags: string[];
  owner_id: string;
  uploadedBy: string;
};

type ApiOptions = RequestInit & { timeoutMs?: number };

// Backend Swagger docs URL. nginx maps /api/v1/docs → backend /docs, while bare
// /docs is owned by the frontend, so append /docs to the (possibly relative) base.
export const API_DOCS_URL = `${getApiBase().replace(/\/$/, "")}/docs`;

function getAuthHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
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
      throw new Error(await parseErrorDetail(res));
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

// Longer than apiFetch's default — file transfers legitimately take longer
// than a typical JSON request, but must still fail instead of hanging forever
// on a stalled connection.
const FILE_TRANSFER_TIMEOUT_MS = 300000;

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const base = getApiBase().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FILE_TRANSFER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...getAuthHeader() },
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res));
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Upload timeout after ${Math.round(FILE_TRANSFER_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

async function apiDownload(path: string): Promise<Blob> {
  const base = getApiBase().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FILE_TRANSFER_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { ...getAuthHeader() }, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Download timeout after ${Math.round(FILE_TRANSFER_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

/** Trigger a browser "save as" for a fetched blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  listStaff: () => apiFetch<Staff[]>("/staff"),
  upsertStaff: (payload: Partial<Staff> & Pick<Staff, "name" | "role">) =>
    apiFetch<Staff>("/staff", { method: "POST", body: JSON.stringify(payload) }),
  deleteStaff: (id: string) => apiFetch<{ deleted: boolean }>(`/staff/${id}`, { method: "DELETE" }),

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

  listDepartments: () => apiFetch<Department[]>("/departments"),
  upsertDepartment: (payload: Partial<Department> & Pick<Department, "name" | "staff">) =>
    apiFetch<Department>("/departments", { method: "POST", body: JSON.stringify(payload) }),
  deleteDepartment: (id: string) => apiFetch<{ deleted: boolean }>(`/departments/${id}`, { method: "DELETE" }),

  listTasks: () => apiFetch<Task[]>("/tasks"),
  upsertTask: (payload: Partial<Task> & Pick<Task, "title">) =>
    apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  deleteTask: (id: string) => apiFetch<{ deleted: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  // Explicit "fresh start": wipe a task's meeting history + graph context.
  // (Restart no longer clears messages automatically — it continues the dialogue.)
  clearTaskHistory: (id: string) =>
    apiFetch<{ cleared: boolean }>(`/tasks/${id}/history`, { method: "DELETE" }),

  // Jira-style project management layer.
  listProjects: () => apiFetch<Project[]>("/projects"),
  upsertProject: (payload: Partial<Project> & Pick<Project, "key" | "name">) =>
    apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  deleteProject: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/projects/${id}`, { method: "DELETE" }),

  listEpics: () => apiFetch<Epic[]>("/epics"),
  upsertEpic: (payload: Partial<Epic> & Pick<Epic, "projectId" | "title">) =>
    apiFetch<Epic>("/epics", { method: "POST", body: JSON.stringify(payload) }),
  deleteEpic: (id: string) => apiFetch<{ deleted: boolean }>(`/epics/${id}`, { method: "DELETE" }),

  listSprints: () => apiFetch<Sprint[]>("/sprints"),
  upsertSprint: (payload: Partial<Sprint> & Pick<Sprint, "projectId" | "name">) =>
    apiFetch<Sprint>("/sprints", { method: "POST", body: JSON.stringify(payload) }),
  deleteSprint: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/sprints/${id}`, { method: "DELETE" }),

  plannerDecompose: (payload: {
    projectId: string;
    epicId?: string | null;
    description: string;
    count?: number;
  }) =>
    apiFetch<{ issues: DraftIssue[] }>("/planner/decompose", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  plannerCommit: (payload: {
    projectId: string;
    epicId?: string | null;
    sprintId?: string | null;
    departmentId?: string;
    issues: DraftIssue[];
  }) =>
    apiFetch<Task[]>("/planner/commit", { method: "POST", body: JSON.stringify(payload) }),

  // Recruiting: shared "default" items users can browse and clone into their scope.
  listRecruitingSkills: () => apiFetch<Skill[]>("/recruiting/skills"),
  listRecruitingStaff: () => apiFetch<Staff[]>("/recruiting/staff"),
  listRecruitingDepartments: () => apiFetch<Department[]>("/recruiting/departments"),
  listRecruitingTasks: () => apiFetch<Task[]>("/recruiting/tasks"),
  listRecruitingDocuments: () => apiFetch<LibraryDocument[]>("/recruiting/documents"),
  // `companyId` is required only for documents (the office to copy into).
  copyFromRecruiting: (payload: { type: "skill" | "staff" | "department" | "task" | "document"; id: string; companyId?: string }) =>
    apiFetch<{ type: string; id: string }>("/recruiting/copy", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listMeetings: (taskId?: string) => {
    const qs = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
    return apiFetch<Message[]>(`/meetings${qs}`);
  },
  getTaskGraphContext: (taskId: string) => apiFetch<GraphContextSnapshot>(`/tasks/${encodeURIComponent(taskId)}/graph-context`),
  addMeeting: (payload: { staffId: string; content: string; taskId?: string | null }) =>
    apiFetch<Message>("/meetings", { method: "POST", body: JSON.stringify(payload) }),
  // Human-in-the-loop: queue a user message for an actively streaming run.
  // The next staff turn picks it up and injects it into its context.
  interjectStaffGraph: (payload: { conversation_id: string; content: string }) =>
    apiFetch<{ queued: boolean; message_id: string | null }>("/llm/staff-graph/interject", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Interrupt an active run: current staff finishes its turn, then the run
  // holds at the turn boundary so the user can chat before resuming.
  pauseStaffGraph: (payload: { conversation_id: string }) =>
    apiFetch<{ paused: boolean }>("/llm/staff-graph/pause", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resumeStaffGraph: (payload: { conversation_id: string }) =>
    apiFetch<{ resumed: boolean }>("/llm/staff-graph/resume", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Answer an staff's ask_user question (the staff is blocked waiting on it).
  respondStaffGraph: (payload: { conversation_id: string; request_id: string; response: string }) =>
    apiFetch<{ delivered: boolean }>("/llm/staff-graph/respond", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  chat: (payload: ChatRequest, options?: { timeoutMs?: number }) =>
    apiFetch<ChatResponse>("/llm/chat", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: options?.timeoutMs,
    }),

  runStaffGraphStream: async function* (payload: {
    user_input: string;
    staff: string[];
    max_rounds?: number;
    mode?: DepartmentMode;
    conversation_id?: string;
    // Department/department this run belongs to, for per-department cost attribution.
    department_id?: string;
    signal?: AbortSignal;
    // For mode === "custom": the directed flow over staff ids drawn by the user.
    custom_graph?: {
      edges: { source: string; target: string }[];
      entry?: string[];
    };
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
    const url = `${base}/llm/staff-graph/run-stream`;
    const body = JSON.stringify({
      user_input: payload.user_input,
      staff: payload.staff,
      max_rounds: payload.max_rounds ?? 6,
      mode: payload.mode ?? "sequential",
      conversation_id: payload.conversation_id,
      department_id: payload.department_id,
      custom_graph: payload.custom_graph,
      graph_config: payload.graph_config,
    });

    const res = await fetch(url, {
      method: "POST",
      // Auth header so backend can attribute LLM token usage to the caller.
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body,
      signal: payload.signal,
    });

    if (!res.ok) {
      throw new Error(await parseErrorDetail(res));
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
      throw new Error(await parseErrorDetail(res));
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
    companyId?: string;
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

  listCompanies: () => apiFetch<Company[]>("/companies"),
  getCompany: (id: string) => apiFetch<Company>(`/companies/${id}`),
  upsertCompany: (payload: Partial<Company> & Pick<Company, "name">) =>
    apiFetch<Company>("/companies", { method: "POST", body: JSON.stringify(payload) }),
  deleteCompany: (id: string) => apiFetch<{ deleted: boolean }>(`/companies/${id}`, { method: "DELETE" }),
  listPlatforms: () => apiFetch<PlatformDef[]>("/companies/platforms"),

  listConnections: (companyId?: string, kind?: "inbound_webhook" | "outbound") => {
    const qs = new URLSearchParams();
    if (companyId !== undefined) qs.set("company_id", companyId);
    if (kind) qs.set("kind", kind);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<Connection[]>(`/connections${suffix}`);
  },
  upsertConnection: (payload: Partial<Connection> & Pick<Connection, "platform" | "name">) =>
    apiFetch<Connection>("/connections", { method: "POST", body: JSON.stringify(payload) }),
  deleteConnection: (id: string) => apiFetch<{ deleted: boolean }>(`/connections/${id}`, { method: "DELETE" }),

  // Cost monitoring (per-user; scoped to the caller's own runs)
  getConsumption: (days = 30) => apiFetch<Consumption>(`/consumption?days=${days}`),

  simulatePlan: (taskDescription: string) =>
    apiFetch<SimulationPlanResponse>("/simulations/plan", {
      method: "POST",
      body: JSON.stringify({ task_description: taskDescription }),
    }),

  // Admin monitoring (requires admin role)
  getAdminUsage: (days = 30) => apiFetch<UsageSummary>(`/admin/monitoring/usage?days=${days}`),
  getAdminHealth: () => apiFetch<SystemHealth>("/admin/monitoring/health"),
  getAdminFileStorage: () => apiFetch<FileStorageStats>("/admin/monitoring/file-storage"),
  getAdminUsers: (days = 30) => apiFetch<AdminUserActivity[]>(`/admin/monitoring/users?days=${days}`),
  listModelPricing: () => apiFetch<ModelPricing[]>("/admin/monitoring/pricing"),
  upsertModelPricing: (payload: ModelPricing) =>
    apiFetch<ModelPricing>("/admin/monitoring/pricing", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteModelPricing: (model: string) =>
    apiFetch<{ deleted: boolean }>(
      `/admin/monitoring/pricing?model=${encodeURIComponent(model)}`,
      { method: "DELETE" },
    ),

  // Project (meeting) files
  listMeetingFiles: (taskId: string) =>
    apiFetch<MeetingFile[]>(`/meetings/${encodeURIComponent(taskId)}/files`),
  uploadMeetingFile: (taskId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiUpload<MeetingFile>(`/meetings/${encodeURIComponent(taskId)}/files`, fd);
  },
  downloadConversationFile: (taskId: string, relPath: string) =>
    apiDownload(`/meetings/${encodeURIComponent(taskId)}/files/download?rel_path=${encodeURIComponent(relPath)}`),

  // Document Library (Business Unit scope)
  listDocuments: (companyId?: string) =>
    apiFetch<LibraryDocument[]>(
      `/library/documents${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ""}`,
    ),
  uploadDocument: (companyId: string, file: File, opts?: { description?: string; tags?: string[] }) => {
    const fd = new FormData();
    fd.append("companyId", companyId);
    fd.append("file", file);
    if (opts?.description) fd.append("description", opts.description);
    if (opts?.tags?.length) fd.append("tags", opts.tags.join(","));
    return apiUpload<LibraryDocument>("/library/documents", fd);
  },
  ingestUrl: (payload: { companyId: string; url: string; name?: string; description?: string; tags?: string[] }) =>
    apiFetch<LibraryDocument>("/library/documents/ingest-url", { method: "POST", body: JSON.stringify(payload) }),
  downloadDocument: (id: string) => apiDownload(`/library/documents/${encodeURIComponent(id)}/download`),
  attachDocumentToProject: (id: string, taskId: string) =>
    apiFetch<{ attached: boolean }>(`/library/documents/${encodeURIComponent(id)}/attach`, {
      method: "POST",
      body: JSON.stringify({ taskId }),
    }),
  deleteDocument: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/library/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Auth
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const r = await apiFetch<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    return { ...r, user: mapAuthUser(r.user) };
  },
  register: async (name: string, email: string, password: string): Promise<LoginResponse> => {
    const r = await apiFetch<any>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    return { ...r, user: mapAuthUser(r.user) };
  },
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  getCurrentUser: async (): Promise<AuthUser> => mapAuthUser(await apiFetch<any>("/auth/me")),
  updateProfile: async (payload: { name?: string; email?: string; avatar?: string | null }): Promise<AuthUser> =>
    mapAuthUser(await apiFetch<any>("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) })),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<void>("/auth/password", { method: "PATCH", body: JSON.stringify({ current_password, new_password }) }),
  uploadAvatar: async (file: File): Promise<AuthUser> => {
    const base = getApiBase().replace(/\/$/, "");
    const url = `${base}/auth/avatar`;
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res));
    }
    const data = await res.json();
    return mapAuthUser(data);
  },
};
