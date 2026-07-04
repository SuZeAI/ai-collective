import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, type GraphContextSnapshot, type Message, type Task } from "@/lib/api";

// ask_user tool: an agent is blocked waiting for the user's answer.
export type UserInputRequest = {
  requestId: string;
  agentId?: string;
  agentName?: string;
  question: string;
  options: string[];
  allowFreeText: boolean;
};

export type GraphHighlight = {
  nodeIds: string[];
  edgeIds: string[];
  chunkIds: string[];
  agentId?: string;
  agentName?: string;
  updatedAt: string;
};

// Stream events are raw parsed JSON from the SSE generator — loosely typed.
type RunStreamEvent = Record<string, any>;

// A synthetic event emitted once a run loop ends, so animation-driven consumers
// (VirtualOffice) can reset their state without inferring it from task status.
export type RunEndedEvent = { type: "run_ended"; taskId: string; reason: "completed" | "stopped" | "aborted" | "error" };

type EngineEvent = RunStreamEvent | RunEndedEvent;
type EventListener = (event: EngineEvent) => void;

// Team config the caller passes at start time — the engine is team-agnostic.
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
  conversations: Record<string, Message[]>;
  thinkingAgents: Record<string, Set<string>>;
  activeFanouts: Record<string, { coordinator?: string; targets: string[] }>;
  graphSnapshots: Record<string, GraphContextSnapshot>;
  graphHighlights: Record<string, GraphHighlight>;
  loadingGraphTaskIds: Set<string>;
  heldTaskIds: Set<string>;
  pendingInterjections: Record<string, Set<string>>;
  userInputRequests: Record<string, UserInputRequest[]>;
  loadingConversationTaskIds: Set<string>;
  updatingTaskIds: Set<string>;
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
  ingestConversations: (taskId: string, messages: Message[]) => void;

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
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [thinkingAgents, setThinkingAgents] = useState<Record<string, Set<string>>>({});
  const [activeFanouts, setActiveFanouts] = useState<Record<string, { coordinator?: string; targets: string[] }>>({});
  const [graphSnapshots, setGraphSnapshots] = useState<Record<string, GraphContextSnapshot>>({});
  const [graphHighlights, setGraphHighlights] = useState<Record<string, GraphHighlight>>({});
  const [loadingGraphTaskIds, setLoadingGraphTaskIds] = useState<Set<string>>(new Set());
  const [heldTaskIds, setHeldTaskIds] = useState<Set<string>>(new Set());
  const [pendingInterjections, setPendingInterjections] = useState<Record<string, Set<string>>>({});
  const [userInputRequests, setUserInputRequests] = useState<Record<string, UserInputRequest[]>>({});
  const [loadingConversationTaskIds, setLoadingConversationTaskIds] = useState<Set<string>>(new Set());
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());
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
    setConversations((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setGraphSnapshots((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setGraphHighlights((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setPendingInterjections((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setHeldTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
    setUserInputRequests((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
    setActiveFanouts((prev) => { const next = { ...prev }; delete next[taskId]; return next; });
  }, []);

  // Restart housekeeping: reset transient interaction state but KEEP the
  // transcript (and graph) so a re-run continues the long conversation instead
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
    setThinkingAgents((prev) => {
      const next = { ...prev };
      delete next[updated.id];
      return next;
    });
    setLoadingConversationTaskIds((prev) => new Set(prev).add(updated.id));

    let endReason: RunEndedEvent["reason"] = "completed";

    try {
      const messages: Message[] = [];
      for await (const event of api.runAgentGraphStream({
        user_input: formattedInput,
        agents: updated.assignedAgents,
        max_rounds: opts.maxSteps ?? 6,
        mode: opts.mode ?? "sequential",
        custom_graph: opts.customGraph,
        conversation_id: updated.id,
        team_id: updated.teamId,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) { endReason = "aborted"; break; }
        if (event.type === "cancelled") { endReason = "stopped"; break; }
        if (event.error) {
          console.error(event.error);
          endReason = "error";
          break;
        }

        const eventType = event.type;
        const agentId = event.agent_id || event.agentId || event.agent_name || event.agentName;

        if (eventType === "llm_request_start") {
          if (agentId) {
            setThinkingAgents((prev) => ({
              ...prev,
              [updated.id]: new Set([...(prev[updated.id] ?? []), agentId]),
            }));
          }
        } else if (eventType === "subagent_start") {
          if (agentId) {
            setThinkingAgents((prev) => ({
              ...prev,
              [updated.id]: new Set([...(prev[updated.id] ?? []), agentId]),
            }));
          }
          console.debug("subagent_start", event.subagent_type, event.description);
        } else if (eventType === "subagent_complete") {
          console.debug("subagent_complete", event.subagent_type, event.error);
        } else if (eventType === "fanout_start") {
          const targets = Array.isArray(event.targets) ? event.targets.map(String) : [];
          setActiveFanouts((prev) => ({
            ...prev,
            [updated.id]: {
              coordinator: event.agent_name ? String(event.agent_name) : (agentId ? String(agentId) : undefined),
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
                    agentId: agentId ? String(agentId) : undefined,
                    agentName: event.agent_name ? String(event.agent_name) : undefined,
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
              agentId: agentId ? String(agentId) : undefined,
              agentName: event.agent_name ? String(event.agent_name) : agentId ? String(agentId) : undefined,
              updatedAt: new Date().toISOString(),
            },
          }));
        } else if (eventType === "message_ingested" || eventType === "graph_context") {
          refreshGraph(updated.id);
          if (eventType === "graph_context") {
            setGraphHighlights((prev) => ({
              ...prev,
              [updated.id]: {
                nodeIds: Array.isArray(event.node_ids) ? event.node_ids.map(String) : [],
                edgeIds: Array.isArray(event.edge_ids) ? event.edge_ids.map(String) : [],
                chunkIds: Array.isArray(event.chunk_ids) ? event.chunk_ids.map(String) : [],
                agentId: agentId ? String(agentId) : undefined,
                agentName: event.agent_name ? String(event.agent_name) : agentId ? String(agentId) : undefined,
                updatedAt: new Date().toISOString(),
              },
            }));
          }
        } else if (eventType === "llm_response_complete") {
          if (agentId) {
            setThinkingAgents((prev) => {
              const next = { ...prev };
              if (next[updated.id]) {
                const newSet = new Set(next[updated.id]);
                newSet.delete(agentId);
                if (newSet.size > 0) next[updated.id] = newSet;
                else delete next[updated.id];
              }
              return next;
            });
          }
        } else if (eventType === "turn_complete" && event.turn) {
          const turn = event.turn;
          const turnAgentId = turn.agent_id || turn.agentId || turn.agent_name || turn.agentName;
          if (turnAgentId) {
            const message: Message = {
              id: `${Date.now()}-${turnAgentId}-${turn.turn}`,
              agentId: turnAgentId,
              content: turn.content || "",
              timestamp: new Date().toISOString(),
              taskId: updated.id,
            };
            setThinkingAgents((prev) => {
              const next = { ...prev };
              if (next[updated.id]) {
                const newSet = new Set(next[updated.id]);
                newSet.delete(turnAgentId);
                if (newSet.size > 0) next[updated.id] = newSet;
                else delete next[updated.id];
              }
              return next;
            });
            messages.push(message);
            setConversations((prev) => ({
              ...prev,
              [updated.id]: [...(prev[updated.id] ?? []), message],
            }));
            refreshGraph(updated.id);
            try {
              await api.addConversation({
                agentId: message.agentId,
                content: message.content,
                taskId: message.taskId,
              });
            } catch (e) {
              console.error("Failed to save message:", e);
            }
          }
        } else if (event.content && !eventType) {
          // Fallback for old-style turn objects (not wrapped in turn_complete).
          if (agentId) {
            const message: Message = {
              id: `${Date.now()}-${agentId}-${event.turn}`,
              agentId,
              content: event.content || "",
              timestamp: new Date().toISOString(),
              taskId: updated.id,
            };
            messages.push(message);
            setConversations((prev) => ({
              ...prev,
              [updated.id]: [...(prev[updated.id] ?? []), message],
            }));
            refreshGraph(updated.id);
            try {
              await api.addConversation({
                agentId: message.agentId,
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

      // Auto-complete only when the stream finished naturally (not cancelled,
      // stopped, aborted, or errored). Do not gate on messages.length: a run
      // that only calls tools/subagents without a final turn_complete message
      // still finishes naturally and must transition out of "in-progress".
      if (endReason === "completed" && !controller.signal.aborted) {
        const completed = await api.upsertTask({ ...updated, status: "completed", progress: 100 });
        applyTask(completed);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error("Stream error:", e);
        endReason = "error";
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
      setThinkingAgents((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setActiveFanouts((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setPendingInterjections((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setHeldTaskIds((prev) => { const next = new Set(prev); next.delete(updated.id); return next; });
      setUserInputRequests((prev) => { const next = { ...prev }; delete next[updated.id]; return next; });
      setLoadingConversationTaskIds((prev) => { const next = new Set(prev); next.delete(updated.id); return next; });
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
    const controller = new AbortController();
    controllersRef.current.set(task.id, controller);
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = await api.upsertTask({ ...task, status: "in-progress" });
      applyTask(updated);
      if (updated.assignedAgents.length > 0) {
        // On restart from completed/stopped, keep the transcript (long-running
        // conversation) and only reset transient interaction state. Use the
        // explicit "Clear history" action for a full wipe.
        if (task.status === "completed" || task.status === "stopped") {
          clearTransientRunState(updated.id);
        }
        const formattedInput =
          opts.formattedInput ??
          `Task title: ${updated.title}; description: ${updated.description || "Execute this task."}`;
        await runStream(updated, formattedInput, opts, controller);
      } else {
        controllersRef.current.delete(task.id);
      }
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
    if (task.assignedAgents.length === 0) return;
    // Reserve synchronously (see startTask's comment — same race applies here).
    const controller = new AbortController();
    controllersRef.current.set(task.id, controller);
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    setInterjectErrors((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
    try {
      const message: Message = {
        id: `${Date.now()}-followup`,
        agentId: "user",
        content,
        timestamp: new Date().toISOString(),
        taskId: task.id,
      };
      setConversations((prev) => ({ ...prev, [task.id]: [...(prev[task.id] ?? []), message] }));
      try {
        await api.addConversation({ agentId: "user", content, taskId: task.id });
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
        (transcriptTail ? `\n\n[Recent conversation from the previous run, for context]:\n${transcriptTail}` : "");
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
      const res = await api.interjectAgentGraph({ conversation_id: task.id, content });
      const messageId = res.message_id ?? `${Date.now()}-user`;
      const message: Message = {
        id: messageId,
        agentId: "user",
        content,
        timestamp: new Date().toISOString(),
        taskId: task.id,
      };
      setConversations((prev) => ({ ...prev, [task.id]: [...(prev[task.id] ?? []), message] }));
      setPendingInterjections((prev) => ({
        ...prev,
        [task.id]: new Set([...(prev[task.id] ?? []), messageId]),
      }));
      try {
        await api.addConversation({ agentId: "user", content, taskId: task.id });
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
      await api.respondAgentGraph({ conversation_id: task.id, request_id: request.requestId, response: content });
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
        agentId: "user",
        content,
        timestamp: new Date().toISOString(),
        taskId: task.id,
      };
      setConversations((prev) => ({ ...prev, [task.id]: [...(prev[task.id] ?? []), message] }));
      try {
        await api.addConversation({ agentId: "user", content, taskId: task.id });
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
        await api.pauseAgentGraph({ conversation_id: task.id });
        setHeldTaskIds((prev) => new Set(prev).add(task.id));
      } else {
        await api.resumeAgentGraph({ conversation_id: task.id });
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

  const ingestConversations = useCallback((taskId: string, messages: Message[]) => {
    // Seed only when the engine has no live transcript — never overwrite a run
    // in progress (its optimistic messages would duplicate against backend ids).
    setConversations((prev) => {
      if (prev[taskId] && prev[taskId].length > 0) return prev;
      if (messages.length === 0) return prev;
      return { ...prev, [taskId]: messages };
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
      conversations,
      thinkingAgents,
      activeFanouts,
      graphSnapshots,
      graphHighlights,
      loadingGraphTaskIds,
      heldTaskIds,
      pendingInterjections,
      userInputRequests,
      loadingConversationTaskIds,
      updatingTaskIds,
      sendingInterjectTaskIds,
      holdTogglingTaskIds,
      respondingRequestIds,
      interjectErrors,
      isStreaming,
      upsertTask,
      removeTask,
      ingestTasks,
      ingestConversations,
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
      conversations,
      thinkingAgents,
      activeFanouts,
      graphSnapshots,
      graphHighlights,
      loadingGraphTaskIds,
      heldTaskIds,
      pendingInterjections,
      userInputRequests,
      loadingConversationTaskIds,
      updatingTaskIds,
      sendingInterjectTaskIds,
      holdTogglingTaskIds,
      respondingRequestIds,
      interjectErrors,
      isStreaming,
      upsertTask,
      removeTask,
      ingestTasks,
      ingestConversations,
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
