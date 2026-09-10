import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, type GraphContextSnapshot, type Message, type Task } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

// Upper bound on messages retained per task in memory. RunEngineProvider sits
// above the router so this state outlives navigation for the whole session —
// without a cap, a long-running/many-turn task would grow its transcript
// array unbounded for as long as the tab stays open.
const MAX_MESSAGES_PER_TASK = 200;

function appendCappedMessage(list: Message[] | undefined, message: Message): Message[] {
  const next = [...(list ?? []), message];
  return next.length > MAX_MESSAGES_PER_TASK ? next.slice(-MAX_MESSAGES_PER_TASK) : next;
}

function capMessages(messages: Message[]): Message[] {
  return messages.length > MAX_MESSAGES_PER_TASK ? messages.slice(-MAX_MESSAGES_PER_TASK) : messages;
}

// ask_user tool: an staff is blocked waiting for the user's answer.
export type UserInputRequest = {
  requestId: string;
  staffId?: string;
  staffName?: string;
  question: string;
  options: string[];
  allowFreeText: boolean;
};

export type GraphHighlight = {
  nodeIds: string[];
  edgeIds: string[];
  chunkIds: string[];
  staffId?: string;
  staffName?: string;
  updatedAt: string;
};

// One staff turn, as embedded in a "turn_complete" event's `turn` field
// (server/api/schemas/staff_graph.py GraphTurnSchema) — field names come from
// the backend's JSON, not the frontend's camelCase convention.
export type StaffTurnPayload = {
  turn: number;
  agent_id?: string;
  agent_name?: string;
  staffId?: string;
  staffName?: string;
  content: string;
};

// Known event `type` values emitted by /llm/staff-graph/run-stream, mirroring
// server/domain/event/schema.py's EventType plus a couple of stream-only
// synthetic types ("cancelled" — see llm.py's event_generator).
export type KnownStreamEventType =
  | "agent_start"
  | "agent_turn_start"
  | "context_building"
  | "context_retrieved"
  | "llm_request_start"
  | "llm_response_complete"
  | "message_ingested"
  | "subagent_start"
  | "subagent_complete"
  | "fanout_start"
  | "fanout_complete"
  | "turn_complete"
  | "user_message_injected"
  | "run_paused"
  | "run_resumed"
  | "user_input_request"
  | "user_input_received"
  | "cancelled";

// Stream events are raw parsed JSON from the SSE generator. This is not a
// strict discriminated union — a couple of terminal messages (`error`,
// `graph_context`) carry no `type` field at all on the wire — but every field
// any consumer actually reads is declared here, so a backend field rename
// (this has happened: agent_name vs staff_name) is a compile error instead of
// a silent runtime no-op.
export type RunStreamEvent = {
  type?: KnownStreamEventType;
  agent_id?: string;
  agent_name?: string;
  staffId?: string;
  staffName?: string;
  error?: string;
  subagent_type?: string;
  description?: string;
  targets?: unknown[];
  request_id?: string;
  question?: string;
  options?: unknown[];
  allow_free_text?: boolean;
  message_ids?: unknown[];
  node_ids?: unknown[];
  edge_ids?: unknown[];
  chunk_ids?: unknown[];
  turn?: StaffTurnPayload;
  content?: string;
  task_id?: string;
  taskId?: string;
  graph_context?: {
    text: string;
    node_ids: string[];
    edge_ids: string[];
    chunk_ids: string[];
    method?: string;
  };
};

// A synthetic event emitted once a run loop ends, so animation-driven consumers
// (VirtualOffice) can reset their state without inferring it from task status.
export type RunEndedEvent = { type: "run_ended"; taskId: string; reason: "completed" | "stopped" | "aborted" | "error" };

export type EngineEvent = RunStreamEvent | RunEndedEvent;
export type EventListener = (event: EngineEvent) => void;

// Department config the caller passes at start time — the engine is department-agnostic.
type RunOpts = {
  mode?: "mesh" | "sequential" | "ring" | "supervisor" | "tree" | "custom";
  maxSteps?: number;
  formattedInput?: string;
  // User-drawn flow for custom mode (built via buildCustomGraphPayload).
  customGraph?: { edges: { source: string; target: string }[] };
};

export type RunEngineValue = {
  // Authoritative shared state (keyed by taskId where applicable)
  tasks: Task[];
  meetings: Record<string, Message[]>;
  thinkingStaff: Record<string, Set<string>>;
  activeFanouts: Record<string, { coordinator?: string; targets: string[] }>;
  graphSnapshots: Record<string, GraphContextSnapshot>;
  graphHighlights: Record<string, GraphHighlight>;
  loadingGraphTaskIds: Set<string>;
  heldTaskIds: Set<string>;
  pendingInterjections: Record<string, Set<string>>;
  userInputRequests: Record<string, UserInputRequest[]>;
  loadingMeetingTaskIds: Set<string>;
  updatingTaskIds: Set<string>;
  statusChangePendingIds: Set<string>;
  sendingInterjectTaskIds: Set<string>;
  holdTogglingTaskIds: Set<string>;
  respondingRequestIds: Set<string>;
  interjectErrors: Record<string, string>;

  // Helpers
  isStreaming: (taskId: string) => boolean;

  // Task CRUD (engine owns the authoritative list so run-status survives navigation)
  upsertTask: (payload: Partial<Task> & Pick<Task, "title">) => Promise<Task>;
  removeTask: (id: string) => Promise<void>;
  ingestTasks: (tasks: Task[]) => void;
  ingestMeetings: (taskId: string, messages: Message[]) => void;

  // Run lifecycle
  startTask: (task: Task, opts?: RunOpts) => Promise<void>;
  stopTask: (task: Task) => Promise<void>;
  pauseTask: (task: Task) => Promise<void>;
  // Generic status setter (aborts any live stream first). Used by the Kanban
  // board for drag-to-column transitions that aren't start/stop/pause.
  setStatus: (task: Task, status: Task["status"]) => Promise<void>;
  continueTask: (task: Task, content: string, opts: RunOpts & { transcriptTail?: string }) => Promise<void>;
  interject: (task: Task, content: string) => Promise<boolean>;
  respond: (task: Task, request: UserInputRequest, response: string) => Promise<boolean>;
  hold: (task: Task, hold: boolean) => Promise<void>;
  clearRunState: (taskId: string) => void;
  clearHistory: (taskId: string) => Promise<void>;

  // Knowledge-graph context
  loadGraph: (taskId: string) => Promise<void>;
  refreshGraph: (taskId: string) => void;

  // Event bus for edge-triggered consumers (VirtualOffice animations)
  subscribe: (taskId: string | "*", listener: EventListener) => () => void;
};

const RunEngineContext = createContext<RunEngineValue | null>(null);

export function RunEngineProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Record<string, Message[]>>({});
  const [thinkingStaff, setThinkingStaff] = useState<Record<string, Set<string>>>({});
  const [activeFanouts, setActiveFanouts] = useState<Record<string, { coordinator?: string; targets: string[] }>>({});
  const [graphSnapshots, setGraphSnapshots] = useState<Record<string, GraphContextSnapshot>>({});
  const [graphHighlights, setGraphHighlights] = useState<Record<string, GraphHighlight>>({});
  const [loadingGraphTaskIds, setLoadingGraphTaskIds] = useState<Set<string>>(new Set());
  const [heldTaskIds, setHeldTaskIds] = useState<Set<string>>(new Set());
  const [pendingInterjections, setPendingInterjections] = useState<Record<string, Set<string>>>({});
  const [userInputRequests, setUserInputRequests] = useState<Record<string, UserInputRequest[]>>({});
  const [loadingMeetingTaskIds, setLoadingMeetingTaskIds] = useState<Set<string>>(new Set());
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());
  // Short-lived: true only while a setStatus() PUT is actually in flight (a few
  // hundred ms), unlike updatingTaskIds which startTask keeps true for the
  // *entire* run — using that one to gate the Pause/Stop spinner made them
  // spin for the whole run instead of just while the click was processing.
  const [statusChangePendingIds, setStatusChangePendingIds] = useState<Set<string>>(new Set());
  const [sendingInterjectTaskIds, setSendingInterjectTaskIds] = useState<Set<string>>(new Set());
  const [holdTogglingTaskIds, setHoldTogglingTaskIds] = useState<Set<string>>(new Set());
  const [respondingRequestIds, setRespondingRequestIds] = useState<Set<string>>(new Set());
  const [interjectErrors, setInterjectErrors] = useState<Record<string, string>>({});
  // Reactive mirror of the active streams so consumers re-render on start/stop.
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());

  // Active SSE controllers, kept in a ref so stop/pause can abort instantly and
  // the loop survives any consumer unmounting (the provider lives above the router).
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // Per-task event listeners plus a "*" wildcard bucket.
  const listenersRef = useRef<Map<string, Set<EventListener>>>(new Map());

  const isStreaming = useCallback((taskId: string) => streamingIds.has(taskId), [streamingIds]);

  const subscribe = useCallback((taskId: string | "*", listener: EventListener) => {
    const map = listenersRef.current;
    let set = map.get(taskId);
    if (!set) {
      set = new Set();
      map.set(taskId, set);
    }
    set.add(listener);
    return () => {
      const current = listenersRef.current.get(taskId);
      if (current) {
        current.delete(listener);
        if (current.size === 0) listenersRef.current.delete(taskId);
      }
    };
  }, []);

  const emit = useCallback((taskId: string, event: EngineEvent) => {
    listenersRef.current.get(taskId)?.forEach((fn) => {
      try {
        fn(event);
      } catch (e) {
        console.error("Run engine listener error:", e);
      }
    });
    listenersRef.current.get("*")?.forEach((fn) => {
      try {
        fn(event);
      } catch (e) {
        console.error("Run engine listener error:", e);
      }
    });
  }, []);

  const applyTask = useCallback((task: Task) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [...prev, task];
      const next = [...prev];
      next[idx] = task;
      return next;
    });
  }, []);

  // ---- Knowledge-graph context ------------------------------------------------

  const loadGraph = useCallback(async (taskId: string) => {
    setLoadingGraphTaskIds((prev) => new Set(prev).add(taskId));
    try {
      const snapshot = await api.getTaskGraphContext(taskId);
      setGraphSnapshots((prev) => ({ ...prev, [taskId]: snapshot }));
    } catch (e) {
      console.error("Failed to load task graph context:", e);
    } finally {
      setLoadingGraphTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, []);

  const refreshGraph = useCallback((taskId: string) => {
    void loadGraph(taskId);
  }, [loadGraph]);

  // ---- Run-state housekeeping -------------------------------------------------

  const clearRunState = useCallback((taskId: string) => {
    setMeetings((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setGraphSnapshots((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setGraphHighlights((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setPendingInterjections((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setHeldTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
    setUserInputRequests((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setActiveFanouts((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
  }, []);

  // Restart housekeeping: reset transient interaction state but KEEP the
  // transcript (and graph) so a re-run continues the long meeting instead
  // of wiping it. Use clearRunState (full wipe) only for an explicit reset.
  const clearTransientRunState = useCallback((taskId: string) => {
    setGraphHighlights((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setPendingInterjections((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setHeldTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
    setUserInputRequests((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setActiveFanouts((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
  }, []);

  // ---- The streaming loop -----------------------------------------------------
  // Opens the SSE run stream for a task and feeds every event into shared state.
  // Lives in the provider so it keeps running regardless of which page is mounted.
  // `controller` is created and registered in controllersRef by the caller
  // (startTask/continueTask) synchronously, before any await — see the
  // comment on those functions for why that ordering matters.
  const runStream = useCallback(async (updated: Task, formattedInput: string, opts: RunOpts, controller: AbortController) => {
    setStreamingIds((prev) => new Set(prev).add(updated.id));

    // Reset thinking state for a fresh start/restart.
    setThinkingStaff((prev) => {
      const next = { ...prev };
      delete next[updated.id];
      return next;
    });
    setLoadingMeetingTaskIds((prev) => new Set(prev).add(updated.id));

    let endReason: RunEndedEvent["reason"] = "completed";

    try {
      const messages: Message[] = [];
      for await (const event of api.runStaffGraphStream({
        user_input: formattedInput,
        staff: updated.assignedStaff,
        max_rounds: opts.maxSteps ?? 6,
        mode: opts.mode ?? "sequential",
        custom_graph: opts.customGraph,
        conversation_id: updated.id,
        department_id: updated.departmentId,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) { endReason = "aborted"; break; }
        if (event.type === "cancelled") { endReason = "stopped"; break; }
        if (event.error) {
          console.error(event.error);
          endReason = "error";
          const description = event.error.length > 200 ? `${event.error.slice(0, 200)}…` : event.error;
          toast({ title: `"${updated.title}" stopped early`, description, variant: "destructive" });
          break;
        }

        const eventType = event.type;
        const staffId = event.agent_id || event.staffId || event.agent_name || event.staffName;

        if (eventType === "llm_request_start") {
          if (staffId) {
            setThinkingStaff((prev) => ({
              ...prev,
              [updated.id]: new Set([...(prev[updated.id] ?? []), staffId]),
            }));
          }
        } else if (eventType === "subagent_start") {
          if (staffId) {
            setThinkingStaff((prev) => ({
              ...prev,
              [updated.id]: new Set([...(prev[updated.id] ?? []), staffId]),
            }));
          }
        } else if (eventType === "fanout_start") {
          const targets = Array.isArray(event.targets) ? event.targets.map(String) : [];
          setActiveFanouts((prev) => ({
            ...prev,
            [updated.id]: {
              coordinator: event.agent_name ? String(event.agent_name) : (staffId ? String(staffId) : undefined),
              targets,
            },
          }));
        } else if (eventType === "fanout_complete") {
          setActiveFanouts((prev) => {
            const next = { ...prev };
            delete next[updated.id];
            return next;
          });
        } else if (eventType === "user_input_request") {
          const requestId = String(event.request_id ?? "");
          if (requestId) {
            setUserInputRequests((prev) => {
              const list = prev[updated.id] ?? [];
              if (list.some((r) => r.requestId === requestId)) return prev;
              return {
                ...prev,
                [updated.id]: [
                  ...list,
                  {
                    requestId,
                    staffId: staffId ? String(staffId) : undefined,
                    staffName: event.agent_name ? String(event.agent_name) : undefined,
                    question: String(event.question ?? ""),
                    options: Array.isArray(event.options) ? event.options.map(String) : [],
                    allowFreeText: event.allow_free_text !== false,
                  },
                ],
              };
            });
          }
        } else if (eventType === "user_input_received") {
          const requestId = String(event.request_id ?? "");
          setUserInputRequests((prev) => {
            const list = prev[updated.id];
            if (!list) return prev;
            const nextList = list.filter((r) => r.requestId !== requestId);
            const next = { ...prev };
            if (nextList.length > 0) next[updated.id] = nextList;
            else delete next[updated.id];
            return next;
          });
        } else if (eventType === "run_paused") {
          setHeldTaskIds((prev) => new Set(prev).add(updated.id));
        } else if (eventType === "run_resumed") {
          setHeldTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(updated.id);
            return next;
          });
        } else if (eventType === "user_message_injected") {
          const injectedIds = Array.isArray(event.message_ids) ? event.message_ids.map(String) : [];
          setPendingInterjections((prev) => {
            const current = prev[updated.id];
            if (!current) return prev;
            const nextSet = new Set(current);
            injectedIds.forEach((id: string) => nextSet.delete(id));
            const next = { ...prev };
            if (nextSet.size > 0) next[updated.id] = nextSet;
            else delete next[updated.id];
            return next;
          });
        } else if (eventType === "context_retrieved") {
          setGraphHighlights((prev) => ({
            ...prev,
            [updated.id]: {
              nodeIds: Array.isArray(event.node_ids) ? event.node_ids.map(String) : [],
              edgeIds: Array.isArray(event.edge_ids) ? event.edge_ids.map(String) : [],
              chunkIds: Array.isArray(event.chunk_ids) ? event.chunk_ids.map(String) : [],
              staffId: staffId ? String(staffId) : undefined,
              staffName: event.agent_name ? String(event.agent_name) : staffId ? String(staffId) : undefined,
              updatedAt: new Date().toISOString(),
            },
          }));
        } else if (eventType === "message_ingested") {
          refreshGraph(updated.id);
        } else if (event.graph_context) {
          // This terminal message carries no `type` field on the wire (see
          // llm.py's event_generator) — it's identified by the presence of
          // `graph_context` instead, nested under that key (not at the top
          // level like context_retrieved's node_ids/edge_ids/chunk_ids).
          const pack = event.graph_context;
          refreshGraph(updated.id);
          setGraphHighlights((prev) => ({
            ...prev,
            [updated.id]: {
              nodeIds: pack.node_ids ?? [],
              edgeIds: pack.edge_ids ?? [],
              chunkIds: pack.chunk_ids ?? [],
              staffId: staffId ? String(staffId) : undefined,
              staffName: event.agent_name ? String(event.agent_name) : staffId ? String(staffId) : undefined,
              updatedAt: new Date().toISOString(),
            },
          }));
        } else if (eventType === "llm_response_complete") {
          if (staffId) {
            setThinkingStaff((prev) => {
              const next = { ...prev };
              if (next[updated.id]) {
                const newSet = new Set(next[updated.id]);
                newSet.delete(staffId);
                if (newSet.size > 0) next[updated.id] = newSet;
                else delete next[updated.id];
              }
              return next;
            });
          }
        } else if (eventType === "turn_complete" && event.turn) {
          const turn = event.turn;
          const turnStaffId = turn.agent_id || turn.staffId || turn.agent_name || turn.staffName;
          if (turnStaffId) {
            const message: Message = {
              id: `${Date.now()}-${turnStaffId}-${turn.turn}`,
              staffId: turnStaffId,
              content: turn.content || "",
              timestamp: new Date().toISOString(),
              taskId: updated.id,
            };
            setThinkingStaff((prev) => {
              const next = { ...prev };
              if (next[updated.id]) {
                const newSet = new Set(next[updated.id]);
                newSet.delete(turnStaffId);
                if (newSet.size > 0) next[updated.id] = newSet;
                else delete next[updated.id];
              }
              return next;
            });
            messages.push(message);
            setMeetings((prev) => ({
              ...prev,
              [updated.id]: appendCappedMessage(prev[updated.id], message),
            }));
            refreshGraph(updated.id);
            try {
              await api.addMeeting({
                staffId: message.staffId,
                content: message.content,
                taskId: message.taskId,
              });
            } catch (e) {
              console.error("Failed to save message:", e);
            }
          }
        } else if (event.content && !eventType) {
          // Fallback for old-style turn objects (not wrapped in turn_complete).
          if (staffId) {
            const message: Message = {
              id: `${Date.now()}-${staffId}-${event.turn}`,
              staffId,
              content: event.content || "",
              timestamp: new Date().toISOString(),
              taskId: updated.id,
            };
            messages.push(message);
            setMeetings((prev) => ({
              ...prev,
              [updated.id]: appendCappedMessage(prev[updated.id], message),
            }));
            refreshGraph(updated.id);
            try {
              await api.addMeeting({
                staffId: message.staffId,
                content: message.content,
                taskId: message.taskId,
              });
            } catch (e) {
              console.error("Failed to save message:", e);
            }
          }
        }

        // Notify edge-triggered consumers (VirtualOffice animations).
        emit(updated.id, event);
      }

      // A Pause/Stop click cancels the reader (see api.runStaffGraphStream),
      // which makes reader.read() resolve with done:true instead of throwing —
      // the for-await loop then exits normally without ever re-checking
      // controller.signal.aborted inside its body, so endReason would
      // otherwise be silently left at its "completed" default even though
      // the run was aborted. Correct it here before deciding what to do next.
      if (controller.signal.aborted && endReason === "completed") {
        endReason = "aborted";
      }

      // Auto-complete only when the stream finished naturally (not cancelled,
      // stopped, aborted, or errored). Do not gate on messages.length: a run
      // that only calls tools/subagents without a final turn_complete message
      // still finishes naturally and must transition out of "in-progress".
      if (endReason === "completed") {
        const completed = await api.upsertTask({ ...updated, status: "completed", progress: 100 });
        applyTask(completed);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error("Stream error:", e);
        endReason = "error";
        // Surface this — without it the task just silently sits at "in-progress"
        // with an empty transcript and no indication anything went wrong. Full
        // detail is still in the console/server logs; the toast gets a capped
        // summary so long backend exception chains don't blow up the popup.
        const rawMessage = e instanceof Error ? e.message : String(e);
        const description = rawMessage.length > 200 ? `${rawMessage.slice(0, 200)}…` : rawMessage;
        toast({
          title: `"${updated.title}" failed to start`,
          description,
          variant: "destructive",
        });
      } else {
        endReason = "aborted";
      }
    } finally {
      // Only clear the map entry if it's still this run's controller — a
      // stale delete here could wipe out a newer, still-live run's entry.
      if (controllersRef.current.get(updated.id) === controller) {
        controllersRef.current.delete(updated.id);
      }
      setStreamingIds((prev) => {
        const next = new Set(prev);
        next.delete(updated.id);
        return next;
      });
      setThinkingStaff((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setActiveFanouts((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setPendingInterjections((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setHeldTaskIds((prev) => { const next = new Set(prev); next.delete(updated.id); return next; });
      setUserInputRequests((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setLoadingMeetingTaskIds((prev) => { const next = new Set(prev); next.delete(updated.id); return next; });
      emit(updated.id, { type: "run_ended", taskId: updated.id, reason: endReason });
    }
  }, [applyTask, emit, refreshGraph]);

  // ---- Run lifecycle ----------------------------------------------------------

  const startTask = useCallback(async (task: Task, opts: RunOpts = {}) => {
    // Check-and-reserve must happen synchronously, in one go, with no await in
    // between — otherwise two rapid calls both pass the check before either
    // registers a controller (registration used to happen inside runStream,
    // after the upsertTask await below), letting the second call's stream
    // silently overwrite/orphan the first's.
    if (controllersRef.current.has(task.id)) return;
    // Nothing assigned to run this task — bail before touching its status so it
    // doesn't get stuck showing "in-progress" with no stream behind it.
    if (task.assignedStaff.length === 0) {
      toast({
        title: `"${task.title}" isn't ready to run`,
        description: "Assign a department or staff member to this task first.",
        variant: "destructive",
      });
      return;
    }
    const controller = new AbortController();
    controllersRef.current.set(task.id, controller);
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = await api.upsertTask({ ...task, status: "in-progress" });
      applyTask(updated);
      // On restart from completed/stopped, keep the transcript (long-running
      // meeting) and only reset transient interaction state. Use the explicit
      // "Clear history" action for a full wipe.
      if (task.status === "completed" || task.status === "stopped") {
        clearTransientRunState(updated.id);
      }
      const formattedInput =
        opts.formattedInput ??
        `Task title: ${updated.title}; description: ${updated.description || "Execute this task."}`;
      await runStream(updated, formattedInput, opts, controller);
    } catch (e) {
      controllersRef.current.delete(task.id);
      if (!(e instanceof DOMException && e.name === "AbortError")) console.error(e);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, [applyTask, clearTransientRunState, runStream]);

  const abortStream = useCallback((taskId: string) => {
    const controller = controllersRef.current.get(taskId);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(taskId);
    }
  }, []);

  const setStatus = useCallback(async (task: Task, status: Task["status"]) => {
    abortStream(task.id);
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    setStatusChangePendingIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = await api.upsertTask({ ...task, status });
      applyTask(updated);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) console.error(e);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setStatusChangePendingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, [abortStream, applyTask]);

  const stopTask = useCallback((task: Task) => setStatus(task, "stopped"), [setStatus]);
  const pauseTask = useCallback((task: Task) => setStatus(task, "paused"), [setStatus]);

  const continueTask = useCallback(async (
    task: Task,
    content: string,
    opts: RunOpts & { transcriptTail?: string },
  ) => {
    if (!content || controllersRef.current.has(task.id)) return;
    if (task.assignedStaff.length === 0) return;
    // Reserve synchronously (see startTask's comment — same race applies here).
    const controller = new AbortController();
    controllersRef.current.set(task.id, controller);
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
    try {
      const message: Message = {
        id: `${Date.now()}-followup`,
        staffId: "user",
        content,
        timestamp: new Date().toISOString(),
        taskId: task.id,
      };
      setMeetings((prev) => ({ ...prev, [task.id]: appendCappedMessage(prev[task.id], message) }));
      try {
        await api.addMeeting({ staffId: "user", content, taskId: task.id });
      } catch (e) {
        console.error("Failed to save follow-up message:", e);
      }

      const updated = await api.upsertTask({ ...task, status: "in-progress" });
      applyTask(updated);

      // Instruction first; transcript last (the token budget truncates the tail).
      const transcriptTail = opts.transcriptTail ?? "";
      const formattedInput =
        `Task title: ${updated.title}; description: ${updated.description || "Execute this task."}\n\n` +
        `[User follow-up after reviewing the previous result — continue the task accordingly, ` +
        `building on the work already done instead of starting over]: ${content}` +
        (transcriptTail ? `\n\n[Recent meeting from the previous run, for context]:\n${transcriptTail}` : "");
      await runStream(updated, formattedInput, opts, controller);
    } catch (e) {
      controllersRef.current.delete(task.id);
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error(e);
        setInterjectErrors((prev) => ({
          ...prev,
          [task.id]: e instanceof Error ? e.message : "Failed to continue task",
        }));
      }
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, [applyTask, runStream]);

  const interject = useCallback(async (task: Task, content: string): Promise<boolean> => {
    if (!content || sendingInterjectTaskIds.has(task.id)) return false;
    let ok = true;
    setSendingInterjectTaskIds((prev) => new Set(prev).add(task.id));
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
    try {
      const res = await api.interjectStaffGraph({ conversation_id: task.id, content });
      const messageId = res.message_id ?? `${Date.now()}-user`;
      const message: Message = {
        id: messageId,
        staffId: "user",
        content,
        timestamp: new Date().toISOString(),
        taskId: task.id,
      };
      setMeetings((prev) => ({ ...prev, [task.id]: appendCappedMessage(prev[task.id], message) }));
      setPendingInterjections((prev) => ({
        ...prev,
        [task.id]: new Set([...(prev[task.id] ?? []), messageId]),
      }));
      try {
        await api.addMeeting({ staffId: "user", content, taskId: task.id });
      } catch (e) {
        console.error("Failed to save user message:", e);
      }
    } catch (e) {
      ok = false;
      setInterjectErrors((prev) => ({
        ...prev,
        [task.id]: e instanceof Error ? e.message : "Failed to send message",
      }));
    } finally {
      setSendingInterjectTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
    return ok;
  }, [sendingInterjectTaskIds]);

  const respond = useCallback(async (task: Task, request: UserInputRequest, response: string): Promise<boolean> => {
    const content = response.trim();
    if (!content || respondingRequestIds.has(request.requestId)) return false;
    let ok = true;
    setRespondingRequestIds((prev) => new Set(prev).add(request.requestId));
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
    try {
      await api.respondStaffGraph({ conversation_id: task.id, request_id: request.requestId, response: content });
      setUserInputRequests((prev) => {
        const list = prev[task.id];
        if (!list) return prev;
        const nextList = list.filter((r) => r.requestId !== request.requestId);
        const next = { ...prev };
        if (nextList.length > 0) next[task.id] = nextList;
        else delete next[task.id];
        return next;
      });
      const message: Message = {
        id: `${Date.now()}-answer-${request.requestId}`,
        staffId: "user",
        content,
        timestamp: new Date().toISOString(),
        taskId: task.id,
      };
      setMeetings((prev) => ({ ...prev, [task.id]: appendCappedMessage(prev[task.id], message) }));
      try {
        await api.addMeeting({ staffId: "user", content, taskId: task.id });
      } catch (e) {
        console.error("Failed to save user answer:", e);
      }
    } catch (e) {
      ok = false;
      setInterjectErrors((prev) => ({
        ...prev,
        [task.id]: e instanceof Error ? e.message : "Failed to send answer",
      }));
    } finally {
      setRespondingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(request.requestId);
        return next;
      });
    }
    return ok;
  }, [respondingRequestIds]);

  const hold = useCallback(async (task: Task, holdRun: boolean) => {
    if (holdTogglingTaskIds.has(task.id)) return;
    setHoldTogglingTaskIds((prev) => new Set(prev).add(task.id));
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
    try {
      if (holdRun) {
        await api.pauseStaffGraph({ conversation_id: task.id });
        setHeldTaskIds((prev) => new Set(prev).add(task.id));
      } else {
        await api.resumeStaffGraph({ conversation_id: task.id });
        setHeldTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    } catch (e) {
      setInterjectErrors((prev) => ({
        ...prev,
        [task.id]: e instanceof Error ? e.message : "Failed to update run state",
      }));
    } finally {
      setHoldTogglingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, [holdTogglingTaskIds]);

  // ---- Task CRUD --------------------------------------------------------------

  const upsertTask = useCallback(async (payload: Partial<Task> & Pick<Task, "title">) => {
    const saved = await api.upsertTask(payload);
    applyTask(saved);
    return saved;
  }, [applyTask]);

  const removeTask = useCallback(async (id: string) => {
    abortStream(id);
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    clearRunState(id);
  }, [abortStream, clearRunState]);

  // Explicit "fresh start": wipe backend history + graph and the local run state.
  const clearHistory = useCallback(async (id: string) => {
    await api.clearTaskHistory(id);
    clearRunState(id);
  }, [clearRunState]);

  // ---- Reconciliation with backend loads (avoid clobbering live state) --------

  const ingestTasks = useCallback((incoming: Task[]) => {
    setTasks((prev) => {
      const prevById = new Map(prev.map((t) => [t.id, t]));
      // For a task we're actively streaming, the engine status leads the DB.
      return incoming.map((t) =>
        controllersRef.current.has(t.id) && prevById.has(t.id) ? prevById.get(t.id)! : t,
      );
    });
  }, []);

  const ingestMeetings = useCallback((taskId: string, messages: Message[]) => {
    // Seed only when the engine has no live transcript — never overwrite a run
    // in progress (its optimistic messages would duplicate against backend ids).
    setMeetings((prev) => {
      if (prev[taskId] && prev[taskId].length > 0) return prev;
      if (messages.length === 0) return prev;
      return { ...prev, [taskId]: capMessages(messages) };
    });
  }, []);

  // Memoized so a re-render of this provider for an unrelated reason (or one
  // where none of these values actually changed) doesn't hand every consumer
  // a brand-new object reference and force them all to re-render too — with
  // this many fields, an unmemoized literal here is a context-wide re-render
  // storm for every screen that reads from useRunEngine().
  const value: RunEngineValue = useMemo(
    () => ({
      tasks,
      meetings,
      thinkingStaff,
      activeFanouts,
      graphSnapshots,
      graphHighlights,
      loadingGraphTaskIds,
      heldTaskIds,
      pendingInterjections,
      userInputRequests,
      loadingMeetingTaskIds,
      updatingTaskIds,
      statusChangePendingIds,
      sendingInterjectTaskIds,
      holdTogglingTaskIds,
      respondingRequestIds,
      interjectErrors,
      isStreaming,
      upsertTask,
      removeTask,
      ingestTasks,
      ingestMeetings,
      startTask,
      stopTask,
      pauseTask,
      setStatus,
      continueTask,
      interject,
      respond,
      hold,
      clearRunState,
      clearHistory,
      loadGraph,
      refreshGraph,
      subscribe,
    }),
    [
      tasks,
      meetings,
      thinkingStaff,
      activeFanouts,
      graphSnapshots,
      graphHighlights,
      loadingGraphTaskIds,
      heldTaskIds,
      pendingInterjections,
      userInputRequests,
      loadingMeetingTaskIds,
      updatingTaskIds,
      statusChangePendingIds,
      sendingInterjectTaskIds,
      holdTogglingTaskIds,
      respondingRequestIds,
      interjectErrors,
      isStreaming,
      upsertTask,
      removeTask,
      ingestTasks,
      ingestMeetings,
      startTask,
      stopTask,
      pauseTask,
      setStatus,
      continueTask,
      interject,
      respond,
      hold,
      clearRunState,
      clearHistory,
      loadGraph,
      refreshGraph,
      subscribe,
    ],
  );

  return <RunEngineContext.Provider value={value}>{children}</RunEngineContext.Provider>;
}

export function useRunEngine(): RunEngineValue {
  const ctx = useContext(RunEngineContext);
  if (!ctx) throw new Error("useRunEngine must be used within a RunEngineProvider");
  return ctx;
}
