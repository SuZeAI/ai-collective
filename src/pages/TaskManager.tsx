import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, CheckCircle2, Clock, Circle, Pause, Play, Square, Pencil, Trash2, ChevronDown, ChevronUp, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AgentAvatar } from "@/components/AgentAvatar";
import { api, type Agent, type GraphContextSnapshot, type Message, type Team, type Task } from "@/lib/api";
import { getAgentRoleColor } from "@/lib/agent-role-ui";
import { cn } from "@/lib/utils";

const statusIcons = {
  "pending": Circle,
  "in-progress": Clock,
  "paused": Pause,
  "stopped": Square,
  "completed": CheckCircle2,
};

const statusColors: Record<string, string> = {
  "pending": "text-muted-foreground",
  "in-progress": "text-primary",
  "paused": "text-amber-500",
  "stopped": "text-rose-500",
  "completed": "text-agent-dev",
};

const parseTaskDate = (value?: string | null) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const formatDuration = (ms: number) => {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatTaskDateTime = (date: Date) => {
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

type GraphHighlight = {
  nodeIds: string[];
  edgeIds: string[];
  chunkIds: string[];
  agentId?: string;
  agentName?: string;
  updatedAt: string;
};

type GraphViewport = {
  scale: number;
  panX: number;
  panY: number;
};

type GraphNodePosition = {
  x: number;
  y: number;
};

const GRAPH_VIEWBOX_WIDTH = 560;
const GRAPH_VIEWBOX_HEIGHT = 300;
const GRAPH_MIN_SCALE = 0.6;
const GRAPH_MAX_SCALE = 2.5;

const ellipsis = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getSvgPoint = (event: { clientX: number; clientY: number }, element: SVGSVGElement | null) => {
  if (!element) return { x: 0, y: 0 };
  const rect = element.getBoundingClientRect();
  const viewBox = element.viewBox.baseVal;
  const vbWidth = viewBox?.width || GRAPH_VIEWBOX_WIDTH;
  const vbHeight = viewBox?.height || GRAPH_VIEWBOX_HEIGHT;
  const viewAspect = vbWidth / vbHeight;
  const rectAspect = rect.width / rect.height;

  let renderedWidth = rect.width;
  let renderedHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (rectAspect > viewAspect) {
    renderedWidth = rect.height * viewAspect;
    offsetX = (rect.width - renderedWidth) / 2;
  } else {
    renderedHeight = rect.width / viewAspect;
    offsetY = (rect.height - renderedHeight) / 2;
  }

  return {
    x: ((event.clientX - rect.left - offsetX) / renderedWidth) * vbWidth,
    y: ((event.clientY - rect.top - offsetY) / renderedHeight) * vbHeight,
  };
};

const createDefaultViewport = (): GraphViewport => ({
  scale: 1,
  panX: 0,
  panY: 0,
});

const createNodePositionMap = (nodes: GraphContextSnapshot["nodes"], width: number, height: number) => {
  const layout = getGraphLayout(nodes, width, height);
  return Object.fromEntries(layout.map((entry) => [entry.node.id, { x: entry.x, y: entry.y }])) as Record<string, GraphNodePosition>;
};

const getGraphDisplayNodes = (
  snapshot: GraphContextSnapshot | undefined,
  highlight: GraphHighlight | undefined,
  maxNodes = 18,
) => {
  if (!snapshot) return [];
  const activeIds = new Set(highlight?.nodeIds ?? []);
  const prioritized = [
    ...snapshot.nodes.filter((node) => activeIds.has(node.id)).sort((a, b) => b.salience_score - a.salience_score),
    ...snapshot.nodes
      .filter((node) => !activeIds.has(node.id))
      .sort((a, b) => b.salience_score - a.salience_score || b.updated_at.localeCompare(a.updated_at)),
  ];
  return uniqueById(prioritized).slice(0, maxNodes);
};

const getGraphLayout = (nodes: GraphContextSnapshot["nodes"], width: number, height: number) => {
  if (nodes.length === 0) return [];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(80, Math.min(width, height) * 0.36);
  return nodes.map((node, index) => {
    const angle = nodes.length === 1 ? -Math.PI / 2 : (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    return { node, x, y };
  });
};

export default function TaskManager() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [teamId, setTeamId] = useState("");
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskConversations, setTaskConversations] = useState<Record<string, Message[]>>({});
  const [loadingConversationTaskIds, setLoadingConversationTaskIds] = useState<Set<string>>(new Set());
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [thinkingAgents, setThinkingAgents] = useState<Record<string, Set<string>>>({});
  const [taskGraphSnapshots, setTaskGraphSnapshots] = useState<Record<string, GraphContextSnapshot>>({});
  const [taskGraphHighlights, setTaskGraphHighlights] = useState<Record<string, GraphHighlight>>({});
  const [loadingGraphTaskIds, setLoadingGraphTaskIds] = useState<Set<string>>(new Set());
  const [taskGraphViewports, setTaskGraphViewports] = useState<Record<string, GraphViewport>>({});
  const [taskGraphPositions, setTaskGraphPositions] = useState<Record<string, Record<string, GraphNodePosition>>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "pending">("all");
  const [open, setOpen] = useState(false);
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [graphPanelVisible, setGraphPanelVisible] = useState(false);
  const [graphActivityCollapsed, setGraphActivityCollapsed] = useState(false);
  const graphSvgRef = useRef<SVGSVGElement | null>(null);
  const graphDragRef = useRef<{
    taskId: string;
    pointerId: number;
    startPoint: { x: number; y: number };
    startViewport: GraphViewport;
  } | null>(null);
  const graphNodeDragRef = useRef<{
    taskId: string;
    nodeId: string;
    pointerId: number;
    startPoint: { x: number; y: number };
    startPositions: Record<string, GraphNodePosition>;
  } | null>(null);
  // Track active SSE stream controllers so stop/pause can cancel them immediately
  const activeStreamsRef = useRef<Map<string, AbortController>>(new Map());



  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tasks, teams, agents] = await Promise.all([api.listTasks(), api.listTeams(), api.listAgents()]);
        if (cancelled) return;
        setTaskList(tasks);
        setTeamList(teams);
        setAgentList(agents);

        // Load conversations for all tasks
        if (tasks.length > 0) {
          try {
            const results = await Promise.all(
              tasks.map(async (task) => ({ id: task.id, messages: await api.listConversations(task.id) }))
            );
            if (!cancelled) {
              setTaskConversations((prev) => {
                const next = { ...prev };
                for (const item of results) {
                  if (item.messages.length > 0) {
                    next[item.id] = item.messages;
                  }
                }
                return next;
              });
            }
          } catch (e) {
            console.error("Failed to load conversations:", e);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agentList.forEach((a) => map.set(a.id, a));
    return map;
  }, [agentList]);

  const filteredTasks = useMemo(() => {
    return taskList.filter((task) => {
      const team = teamList.find((t) => t.id === task.teamId);
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "active") {
        return task.status === "in-progress" || task.status === "paused";
      }
      if (statusFilter === "completed") {
        return task.status === "completed";
      }
      if (statusFilter === "pending") {
        return task.status === "pending" || task.status === "stopped";
      }
      return true;
    });
  }, [taskList, teamList, searchQuery, statusFilter]);

  const taskIdParam = searchParams.get("id");

  useEffect(() => {
    if (taskIdParam && taskList.length > 0) {
      const taskExists = taskList.some((t) => t.id === taskIdParam);
      if (taskExists) {
        setViewTaskId(taskIdParam);
        setTaskGraphViewports((prev) => prev[taskIdParam] ? prev : { ...prev, [taskIdParam]: createDefaultViewport() });
        void loadTaskGraphContext(taskIdParam);
      }
    } else if (!taskIdParam && taskList.length > 0 && !viewTaskId) {
      setViewTaskId(taskList[0].id);
      setTaskGraphViewports((prev) => prev[taskList[0].id] ? prev : { ...prev, [taskList[0].id]: createDefaultViewport() });
      void loadTaskGraphContext(taskList[0].id);
    }
  }, [taskIdParam, taskList, viewTaskId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [taskConversations, viewTaskId]);

  const handleSelectTask = (taskId: string) => {
    setSearchParams({ id: taskId });
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle("");
    setDesc("");
    setTeamId("");
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDesc(task.description ?? "");
    setTeamId(task.teamId);
    setOpen(true);
  };

  const openTaskView = (taskId: string) => {
    setViewTaskId(taskId);
    setTaskGraphViewports((prev) => prev[taskId] ? prev : { ...prev, [taskId]: createDefaultViewport() });
    void loadTaskGraphContext(taskId);
  };

  const syncTaskGraphPositions = (taskId: string, snapshot?: GraphContextSnapshot) => {
    setTaskGraphPositions((prev) => {
      const graph = snapshot ?? taskGraphSnapshots[taskId];
      if (!graph) return prev;
      const existing = prev[taskId] ?? {};
      const base = createNodePositionMap(graph.nodes, GRAPH_VIEWBOX_WIDTH, GRAPH_VIEWBOX_HEIGHT);
      const next: Record<string, GraphNodePosition> = {};
      for (const node of graph.nodes) {
        next[node.id] = existing[node.id] ?? base[node.id] ?? { x: GRAPH_VIEWBOX_WIDTH / 2, y: GRAPH_VIEWBOX_HEIGHT / 2 };
      }
      return {
        ...prev,
        [taskId]: next,
      };
    });
  };

  const loadTaskGraphContext = async (taskId: string) => {
    setLoadingGraphTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    try {
      const snapshot = await api.getTaskGraphContext(taskId);
      setTaskGraphSnapshots((prev) => ({
        ...prev,
        [taskId]: snapshot,
      }));
      syncTaskGraphPositions(taskId, snapshot);
    } catch (e) {
      console.error("Failed to load task graph context:", e);
    } finally {
      setLoadingGraphTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const refreshTaskGraphContext = (taskId: string) => {
    void loadTaskGraphContext(taskId);
  };

  const updateGraphViewport = (taskId: string, updater: (current: GraphViewport) => GraphViewport) => {
    setTaskGraphViewports((prev) => {
      const current = prev[taskId] ?? createDefaultViewport();
      return {
        ...prev,
        [taskId]: updater(current),
      };
    });
  };

  const startGraphDrag = (taskId: string, event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const viewport = taskGraphViewports[taskId] ?? createDefaultViewport();
    const point = getSvgPoint(event.nativeEvent, graphSvgRef.current);
    graphDragRef.current = {
      taskId,
      pointerId: event.pointerId,
      startPoint: point,
      startViewport: viewport,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGraphDrag = (taskId: string, event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = graphDragRef.current;
    if (!drag || drag.taskId !== taskId || drag.pointerId !== event.pointerId) return;
    const point = getSvgPoint(event.nativeEvent, graphSvgRef.current);
    const deltaX = point.x - drag.startPoint.x;
    const deltaY = point.y - drag.startPoint.y;
    setTaskGraphViewports((prev) => ({
      ...prev,
      [taskId]: {
        ...drag.startViewport,
        panX: drag.startViewport.panX + deltaX,
        panY: drag.startViewport.panY + deltaY,
      },
    }));
  };

  const endGraphDrag = (taskId: string, event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = graphDragRef.current;
    if (!drag || drag.taskId !== taskId || drag.pointerId !== event.pointerId) return;
    graphDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const wheelGraph = (taskId: string, event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = getSvgPoint(event.nativeEvent, graphSvgRef.current);
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
    updateGraphViewport(taskId, (current) => {
      const nextScale = clamp(current.scale * zoomFactor, GRAPH_MIN_SCALE, GRAPH_MAX_SCALE);
      const worldX = (point.x - current.panX) / current.scale;
      const worldY = (point.y - current.panY) / current.scale;
      return {
        scale: nextScale,
        panX: point.x - worldX * nextScale,
        panY: point.y - worldY * nextScale,
      };
    });
  };

  const startNodeDrag = (taskId: string, nodeId: string, event: ReactPointerEvent<SVGGElement>) => {
    if (event.button !== 0) return;
    const snapshot = taskGraphSnapshots[taskId];
    const currentPositions = taskGraphPositions[taskId] ?? createNodePositionMap(snapshot?.nodes ?? [], GRAPH_VIEWBOX_WIDTH, GRAPH_VIEWBOX_HEIGHT);
    const point = getSvgPoint(event.nativeEvent, graphSvgRef.current);
    graphNodeDragRef.current = {
      taskId,
      nodeId,
      pointerId: event.pointerId,
      startPoint: point,
      startPositions: currentPositions,
    };
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveNodeDrag = (taskId: string, event: ReactPointerEvent<SVGElement>) => {
    const drag = graphNodeDragRef.current;
    if (!drag || drag.taskId !== taskId || drag.pointerId !== event.pointerId) return;
    const snapshot = taskGraphSnapshots[taskId];
    if (!snapshot) return;
    const point = getSvgPoint(event.nativeEvent, graphSvgRef.current);
    const deltaX = point.x - drag.startPoint.x;
    const deltaY = point.y - drag.startPoint.y;
    const graph = snapshot;
    const edgeNeighbors = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      if (!edgeNeighbors.has(edge.src)) edgeNeighbors.set(edge.src, new Set());
      if (!edgeNeighbors.has(edge.dst)) edgeNeighbors.set(edge.dst, new Set());
      edgeNeighbors.get(edge.src)?.add(edge.dst);
      edgeNeighbors.get(edge.dst)?.add(edge.src);
    }

    setTaskGraphPositions((prev) => {
      const basePositions = drag.startPositions;
      const next: Record<string, GraphNodePosition> = { ...basePositions };
      const draggedStart = basePositions[drag.nodeId] ?? { x: GRAPH_VIEWBOX_WIDTH / 2, y: GRAPH_VIEWBOX_HEIGHT / 2 };
      next[drag.nodeId] = {
        x: draggedStart.x + deltaX,
        y: draggedStart.y + deltaY,
      };

      const directNeighbors = edgeNeighbors.get(drag.nodeId) ?? new Set<string>();
      for (const neighborId of directNeighbors) {
        if (neighborId === drag.nodeId) continue;
        const neighborStart = basePositions[neighborId];
        if (!neighborStart) continue;
        next[neighborId] = {
          x: neighborStart.x + deltaX * 0.28,
          y: neighborStart.y + deltaY * 0.28,
        };
      }

      return {
        ...prev,
        [taskId]: next,
      };
    });
  };

  const endNodeDrag = (taskId: string, event: ReactPointerEvent<SVGElement>) => {
    const drag = graphNodeDragRef.current;
    if (!drag || drag.taskId !== taskId || drag.pointerId !== event.pointerId) return;
    graphNodeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const saveTask = async () => {
    if (!title.trim() || !teamId) return;
    const existing = editingTaskId ? taskList.find((t) => t.id === editingTaskId) : undefined;
    const team = teamList.find((t) => t.id === teamId);
    try {
      const saved = await api.upsertTask({
        id: editingTaskId ?? undefined,
        title: title.trim(),
        description: desc,
        teamId,
        status: existing?.status ?? "pending",
        progress: existing?.progress ?? 0,
        assignedAgents: team?.agents || [],
      });
      setTaskList((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      resetForm();
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const updateTaskStatus = async (task: Task, status: Task["status"]) => {
    if (task.status === status) return;

    // Stop/pause: cancel the active stream immediately before anything else
    if (status === "stopped" || status === "paused") {
      const controller = activeStreamsRef.current.get(task.id);
      if (controller) {
        controller.abort();
        activeStreamsRef.current.delete(task.id);
      }
    } else if (updatingTaskIds.has(task.id)) {
      // For other transitions, prevent concurrent updates
      return;
    }

    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = await api.upsertTask({
        ...task,
        status,
      });
      setTaskList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      // If starting the task, stream agent responses
      if (status === "in-progress" && updated.assignedAgents.length > 0) {
        const controller = new AbortController();
        activeStreamsRef.current.set(updated.id, controller);

        openTaskView(updated.id);

        // Reset thinking state for a fresh start/restart.
        setThinkingAgents((prev) => {
          const next = { ...prev };
          delete next[updated.id];
          return next;
        });

        // Clear old conversations only when restarting from completed/stopped (not from paused)
        if (task.status === "completed" || task.status === "stopped") {
          setTaskConversations((prev) => {
            const next = { ...prev };
            delete next[updated.id];
            return next;
          });
          setTaskGraphSnapshots((prev) => {
            const next = { ...prev };
            delete next[updated.id];
            return next;
          });
          setTaskGraphHighlights((prev) => {
            const next = { ...prev };
            delete next[updated.id];
            return next;
          });
          setTaskGraphPositions((prev) => {
            const next = { ...prev };
            delete next[updated.id];
            return next;
          });
        }
        // paused → in-progress: keep existing conversations so progress is visible

        setLoadingConversationTaskIds((prev) => {
          const next = new Set(prev);
          next.add(updated.id);
          return next;
        });

        try {
          const messages: Message[] = [];
          const team = teamList.find((t) => t.id === updated.teamId);
          const teamMode = team?.mode ?? "sequential";
          const teamMaxSteps = team?.maxSteps ?? 6;
          const formattedInput = `Task title: ${updated.title}; description: ${updated.description || "Execute this task."}`;

          for await (const event of api.runAgentGraphStream({
            user_input: formattedInput,
            agents: updated.assignedAgents,
            max_rounds: teamMaxSteps,
            mode: teamMode,
            conversation_id: updated.id,
            signal: controller.signal,
          })) {
            // Stream was aborted (stop/pause from user)
            if (controller.signal.aborted) break;

            // Backend signalled cancellation (stop/pause arrived via status update)
            if (event.type === "cancelled") break;

            if (event.error) {
              console.error(event.error);
              break;
            }

            // Handle different event types
            const eventType = event.type;
            const agentId = event.agent_id || event.agentId || event.agent_name || event.agentName;

            // Handle thinking state (LLM request start)
            if (eventType === "llm_request_start") {
              if (!agentId) continue;
              setThinkingAgents((prev) => ({
                ...prev,
                [updated.id]: new Set([...(prev[updated.id] ?? []), agentId]),
              }));
            }
            // Subagent (Agent Mode) delegation: keep the parent agent's
            // thinking indicator active while its subagent runs.
            else if (eventType === "subagent_start") {
              if (agentId) {
                setThinkingAgents((prev) => ({
                  ...prev,
                  [updated.id]: new Set([...(prev[updated.id] ?? []), agentId]),
                }));
              }
              console.debug("subagent_start", event.subagent_type, event.description);
            }
            else if (eventType === "subagent_complete") {
              console.debug("subagent_complete", event.subagent_type, event.error);
            }
            // Highlight the graph context that was retrieved for this agent turn.
            else if (eventType === "context_retrieved") {
              setTaskGraphHighlights((prev) => ({
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
            else if (eventType === "message_ingested" || eventType === "graph_context") {
              refreshTaskGraphContext(updated.id);
              if (eventType === "graph_context") {
                setTaskGraphHighlights((prev) => ({
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
            }
            // Remove thinking state (LLM response complete)
            else if (eventType === "llm_response_complete") {
              if (!agentId) continue;
              setThinkingAgents((prev) => {
                const next = { ...prev };
                if (next[updated.id]) {
                  const newSet = new Set(next[updated.id]);
                  newSet.delete(agentId);
                  if (newSet.size > 0) {
                    next[updated.id] = newSet;
                  } else {
                    delete next[updated.id];
                  }
                }
                return next;
              });
            }
            // Only add message when turn is complete
            else if (eventType === "turn_complete" && event.turn) {
              const turn = event.turn;
              const turnAgentId = turn.agent_id || turn.agentId || turn.agent_name || turn.agentName;
              if (!turnAgentId) continue;
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
              setTaskConversations((prev) => ({
                ...prev,
                [updated.id]: [...(prev[updated.id] ?? []), message],
              }));
              refreshTaskGraphContext(updated.id);
              // Save message to backend
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
            // Fallback for old-style turn objects (if not wrapped in turn_complete event)
            else if (event.content && !eventType) {
              if (!agentId) continue;
              const message: Message = {
                id: `${Date.now()}-${agentId}-${event.turn}`,
                agentId: agentId,
                content: event.content || "",
                timestamp: new Date().toISOString(),
                taskId: updated.id,
              };
              messages.push(message);
              setTaskConversations((prev) => ({
                ...prev,
                [updated.id]: [...(prev[updated.id] ?? []), message],
              }));
              refreshTaskGraphContext(updated.id);
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

          // Auto-complete only when stream finished naturally (not cancelled by stop/pause)
          if (messages.length > 0 && !controller.signal.aborted) {
            const completed = await api.upsertTask({
              ...updated,
              status: "completed",
              progress: 100,
            });
            setTaskList((prev) => prev.map((item) => (item.id === completed.id ? completed : item)));
          }
        } catch (e) {
          // AbortError is expected when stop/pause cancels the stream
          if (!(e instanceof DOMException && e.name === "AbortError")) {
            console.error("Stream error:", e);
          }
        } finally {
          activeStreamsRef.current.delete(updated.id);
          setThinkingAgents((prev) => {
            const next = { ...prev };
            delete next[updated.id];
            return next;
          });
          setLoadingConversationTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(updated.id);
            return next;
          });
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error(e);
      }
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const deleteTask = async (id: string) => {
    if (updatingTaskIds.has(id)) return;
    setUpdatingTaskIds((prev) => new Set(prev).add(id));
    try {
      await api.deleteTask(id);
      setTaskList((prev) => prev.filter((t) => t.id !== id));
      setTaskConversations((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTaskGraphSnapshots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTaskGraphHighlights((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (editingTaskId === id) {
        resetForm();
        setOpen(false);
      }
      if (viewTaskId === id) {
        setViewTaskId(null);
        graphDragRef.current = null;
        graphNodeDragRef.current = null;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };  return (
    <div className="h-full w-full flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border bg-background overflow-hidden select-none">
      {/* LEFT SIDEBAR PANEL: Task list (360px wide) */}
      <div className="lg:w-[380px] w-full flex flex-col flex-shrink-0 bg-muted/5 h-full overflow-hidden">
        {/* Left header */}
        <div className="p-4 border-b border-border flex flex-col gap-3 flex-shrink-0 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Projects & Tasks</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Manage AI department tasks</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreateDialog} className="h-8 gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingTaskId ? "Edit Task" : "Create Task"}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <Textarea
                    placeholder="Description"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="min-h-[140px] max-h-[220px] overflow-y-auto resize-none"
                  />
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger><SelectValue placeholder="Assign to department" /></SelectTrigger>
                    <SelectContent>
                      {teamList.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={saveTask} className="w-full" disabled={!title.trim() || !teamId}>
                    {editingTaskId ? "Save Changes" : "Create Task"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search box */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 pr-3"
            />
            <svg
              className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/75"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Status filtering tabs */}
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-muted/65 rounded-lg text-[10px] font-semibold">
            {(["all", "active", "completed", "pending"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  "py-1 px-1 rounded-md text-center transition-all capitalize",
                  statusFilter === tab
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground/90"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No tasks found
            </div>
          ) : (
            filteredTasks.map((task, i) => {
              const Icon = statusIcons[task.status] ?? Circle;
              const isSelected = viewTaskId === task.id;
              const team = teamList.find((t) => t.id === task.teamId);
              const messages = taskConversations[task.id] ?? [];
              const progress = task.status === "completed" ? 100 : Math.min(Math.round((messages.length / (team?.maxSteps ?? 6)) * 100), 99);
              return (
                <div
                  key={task.id}
                  onClick={() => handleSelectTask(task.id)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all duration-150 relative overflow-hidden group select-none",
                    isSelected
                      ? "bg-accent/40 border-accent-foreground/20 shadow-sm"
                      : "bg-card/50 border-border/40 hover:bg-muted/35 hover:border-border/80"
                  )}
                >
                  {/* Status Indicator Bar */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-[3px]",
                      task.status === "in-progress" ? "bg-primary animate-pulse" : "",
                      task.status === "completed" ? "bg-emerald-500" : "",
                      task.status === "paused" ? "bg-amber-500" : "",
                      task.status === "stopped" ? "bg-rose-500" : "",
                      task.status === "pending" ? "bg-muted-foreground/30" : ""
                    )}
                  />
                  <div className="pl-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={cn("text-xs font-bold truncate flex-1", isSelected ? "text-foreground" : "text-foreground/80")}>
                        {task.title}
                      </h4>
                      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", statusColors[task.status])} />
                    </div>
                    {task.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/20">
                      <div className="flex items-center gap-1 min-w-0">
                        <AgentAvatar
                          agent={team || { avatar: "T", avatar_icon: "users" }}
                          className="w-3.5 h-3.5 rounded-md text-[8px] shrink-0"
                          iconClassName="w-2 h-2"
                        />
                        <span className="text-[9px] text-muted-foreground truncate">{team?.name || "No department"}</span>
                      </div>
                      <span className="text-[9px] font-semibold text-foreground/75 shrink-0">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT WORKSPACE PANEL: Task detail + convo + graph */}
      <div className="flex-1 h-full flex flex-col overflow-hidden bg-background">
        {(() => {
          if (!viewTaskId) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/5">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4 border border-border/40 shadow-sm">
                  <CheckCircle2 className="w-7 h-7 text-muted-foreground/45" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">No Task Selected</h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  Select a task from the list on the left to view its execution details, live agent conversations, and knowledge graphs.
                </p>
              </div>
            );
          }

          const selectedTask = taskList.find((task) => task.id === viewTaskId);
          if (!selectedTask) {
            return (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-muted-foreground">
                Task not found
              </div>
            );
          }

          const team = teamList.find((t) => t.id === selectedTask.teamId);
          const messages = taskConversations[selectedTask.id] ?? [];
          const visibleMessages = messages.slice(-50);
          const maxRounds = team?.maxSteps ?? 6;
          const calculatedProgress = selectedTask.status === "completed" ? 100 : Math.min(Math.round((messages.length / maxRounds) * 100), 99);
          const startDate = parseTaskDate(selectedTask.startTime);
          const endDate = parseTaskDate(selectedTask.endTime);
          const completionDuration =
            selectedTask.status === "completed" && startDate && endDate
              ? formatDuration(endDate.getTime() - startDate.getTime())
              : null;
          const completionSummary = !startDate
            ? "(No start time yet)"
            : completionDuration ?? "(Not completed yet)";
          const canStart = selectedTask.status === "pending" || selectedTask.status === "paused" || selectedTask.status === "stopped" || selectedTask.status === "completed";
          const canPause = selectedTask.status === "in-progress";
          const canStop = selectedTask.status === "in-progress" || selectedTask.status === "paused";
          const isUpdating = updatingTaskIds.has(selectedTask.id);
          const isConversationLoading = loadingConversationTaskIds.has(selectedTask.id);
          const isRestart = selectedTask.status === "completed";
          const Icon = statusIcons[selectedTask.status] ?? Circle;
          const graphSnapshot = taskGraphSnapshots[selectedTask.id];
          const graphHighlight = taskGraphHighlights[selectedTask.id];
          const graphLoading = loadingGraphTaskIds.has(selectedTask.id);
          const graphNodes = getGraphDisplayNodes(graphSnapshot, graphHighlight);
          const graphLayout = getGraphLayout(graphNodes, 560, 300);
          const graphLayoutById = new Map(graphLayout.map((entry) => [entry.node.id, entry]));
          const graphPositions = taskGraphPositions[selectedTask.id] ?? createNodePositionMap(graphNodes, GRAPH_VIEWBOX_WIDTH, GRAPH_VIEWBOX_HEIGHT);
          const activeNodeIds = new Set(graphHighlight?.nodeIds ?? []);
          const activeEdgeIds = new Set(graphHighlight?.edgeIds ?? []);
          const activeChunkIds = new Set(graphHighlight?.chunkIds ?? []);
          const graphEdges = (graphSnapshot?.edges ?? [])
            .filter((edge) => graphLayoutById.has(edge.src) && graphLayoutById.has(edge.dst))
            .sort((left, right) => {
              const leftActive = activeEdgeIds.has(left.id) ? 1 : 0;
              const rightActive = activeEdgeIds.has(right.id) ? 1 : 0;
              return rightActive - leftActive || right.weight - left.weight;
            })
            .slice(0, 24);
          const graphNodeById = new Map((graphSnapshot?.nodes ?? []).map((node) => [node.id, node]));
          const activeNodeLabels = Array.from(activeNodeIds)
            .map((nodeId) => graphNodeById.get(nodeId)?.value || nodeId)
            .slice(0, 6);
          const viewport = taskGraphViewports[selectedTask.id] ?? createDefaultViewport();

          return (
            <div className="flex-1 h-full min-h-0 flex flex-col bg-background select-text">
              {/* Detail Header bar */}
              <div className="px-5 py-3 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn("w-4.5 h-4.5 shrink-0", statusColors[selectedTask.status])} />
                  <h2 className="font-bold text-sm truncate text-foreground leading-none">{selectedTask.title}</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-3"
                    onClick={() => openEditDialog(selectedTask)}
                    disabled={isUpdating}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs px-3 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    onClick={() => deleteTask(selectedTask.id)}
                    disabled={isUpdating}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>

              {/* Detail columns workspace */}
              {/* Tạm thời đổi layout sang 2 cột để mở rộng Live Chat khi ẩn Graph
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr_minmax(0,1.2fr)] divide-x divide-border">
              */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] divide-x divide-border">
                {/* Panel 1: Settings / Metadata */}
                <div className="h-full overflow-y-auto p-4 space-y-5 bg-muted/5 flex-shrink-0 scrollbar-thin">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Progress</span>
                      <span className="font-bold text-foreground">{calculatedProgress}%</span>
                    </div>
                    <Progress value={calculatedProgress} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs font-semibold"
                      variant={selectedTask.status === "in-progress" ? "default" : "outline"}
                      onClick={() => updateTaskStatus(selectedTask, "in-progress")}
                      disabled={!canStart || isUpdating}
                    >
                      <Play className="w-3 h-3 mr-1.5 fill-current" />
                      {isRestart ? "Restart" : "Start"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 px-2.5"
                      variant="outline"
                      onClick={() => updateTaskStatus(selectedTask, "paused")}
                      disabled={!canPause}
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 px-2.5 hover:bg-rose-500/10 hover:border-rose-500/20"
                      variant="outline"
                      onClick={() => updateTaskStatus(selectedTask, "stopped")}
                      disabled={!canStop}
                    >
                      <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Description</label>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedTask.description || "(No description)"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Department</label>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-semibold">
                      <AgentAvatar
                        agent={team || { avatar: "D", avatar_icon: "users" }}
                        className="w-4 h-4 rounded-md text-[9px]"
                        iconClassName="w-2.5 h-2.5"
                      />
                      {team?.name || "(No team)"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Personnel</label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.assignedAgents.map((aid) => {
                        const agent = agentById.get(aid);
                        return agent ? (
                          <span key={aid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background text-[11px] font-medium border border-border/60 shadow-sm">
                            <AgentAvatar
                              agent={agent}
                              className="w-4 h-4 rounded-md text-[8px]"
                              iconClassName="w-2.5 h-2.5"
                            />
                            {agent.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-border/40">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Duration</label>
                    <p className="text-xs font-semibold text-foreground">{completionSummary}</p>
                    {startDate && (
                      <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                        <p>Started: {formatTaskDateTime(startDate)}</p>
                        {endDate && <p>Ended: {formatTaskDateTime(endDate)}</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Live Chat/Conversation */}
                <div className="h-full flex flex-col overflow-hidden bg-background">
                  <div className="px-4 py-2 border-b border-border/40 bg-muted/5 flex items-center justify-between flex-shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Live Chat Logs
                    </span>
                    {/* Tạm thời ẩn nút toggle Graph nhưng giữ lại code để sử dụng sau
                    <button
                      onClick={() => setGraphPanelVisible(v => !v)}
                      className="text-[10px] flex items-center gap-1 px-2.5 py-1 rounded bg-muted/65 hover:bg-muted text-muted-foreground transition-colors font-semibold border border-border/40"
                    >
                      {graphPanelVisible ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3 text-teal-450" />}
                      {graphPanelVisible ? "Hide Graph" : "Show Graph"}
                    </button>
                    */}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                    {isConversationLoading && messages.length === 0 && (thinkingAgents[selectedTask.id]?.size ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground animate-pulse">Loading conversation...</p>
                    ) : visibleMessages.length > 0 || (thinkingAgents[selectedTask.id]?.size ?? 0) > 0 ? (
                      <div className="space-y-3.5">
                        {visibleMessages.map((msg) => {
                          const agent = agentById.get(msg.agentId);
                          const ts = new Date(msg.timestamp);
                          return (
                            <div key={msg.id} className="rounded-xl border border-border/40 p-3.5 bg-card/45 hover:bg-muted/10 transition-colors shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <AgentAvatar
                                  agent={agent || { avatar: "?" }}
                                  className={`w-6.5 h-6.5 rounded-md text-[9px] shadow-sm shrink-0 ${agent?.avatar_color ? "" : getAgentRoleColor(agent?.role || "")}`}
                                  iconClassName="w-3 h-3"
                                />
                                <span className="text-xs font-bold text-foreground">{agent?.name ?? msg.agentId}</span>
                                <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
                                  {isNaN(ts.getTime()) ? msg.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                              </div>
                              <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-foreground/80 leading-relaxed [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          );
                        })}

                        {/* Thinking indicators */}
                        {(thinkingAgents[selectedTask.id]?.size ?? 0) > 0 && (
                          Array.from(thinkingAgents[selectedTask.id] ?? []).map((agentId) => {
                            const agent = agentById.get(agentId);
                            return (
                              <div key={`thinking-${agentId}`} className="rounded-xl border border-primary/20 p-3.5 bg-primary/5">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.4s" }} />
                                  </div>
                                  <span className="text-xs font-semibold text-primary/95">
                                    {agent?.name ?? agentId} is processing...
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">No messages yet for this task.</p>
                    )}
                  </div>
                </div>

                {/* Panel 3: Knowledge Graph */}
                {/* Tạm thời ẩn đi phần hiển thị Graph nhưng giữ lại code để sử dụng sau
                graphPanelVisible && (
                  <div className="h-full flex flex-col overflow-hidden bg-background">
                    <div className="px-4 py-2 border-b border-border/40 bg-muted/5 flex items-center justify-between flex-shrink-0">
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Knowledge Graph</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {graphNodes.length} nodes · {graphEdges.length} edges
                      </span>
                    </div>
                    <div className="flex-1 p-3 flex flex-col min-h-0 bg-muted/5">
                      {graphLoading && !graphSnapshot ? (
                        <div className="flex h-full items-center justify-center rounded-xl border border-border/40 bg-muted/20 text-xs text-muted-foreground animate-pulse">
                          Loading graph context...
                        </div>
                      ) : graphNodes.length > 0 ? (
                        <div className="flex-1 flex flex-col gap-3 min-h-0">
                          <div className="relative flex-1 overflow-hidden rounded-xl border border-border/40 bg-muted/10">
                            <svg
                              ref={graphSvgRef}
                              viewBox={`0 0 ${GRAPH_VIEWBOX_WIDTH} ${GRAPH_VIEWBOX_HEIGHT}`}
                              className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
                              preserveAspectRatio="xMidYMid meet"
                              onWheel={(event) => wheelGraph(selectedTask.id, event)}
                              onPointerDown={(event) => startGraphDrag(selectedTask.id, event)}
                              onPointerMove={(event) => moveGraphDrag(selectedTask.id, event)}
                              onPointerUp={(event) => endGraphDrag(selectedTask.id, event)}
                              onPointerCancel={(event) => endGraphDrag(selectedTask.id, event)}
                            >
                              <defs>
                                <filter id="graphGlow" x="-40%" y="-40%" width="180%" height="180%">
                                  <feGaussianBlur stdDeviation="6" result="blur" />
                                  <feColorMatrix
                                    in="blur"
                                    type="matrix"
                                    values="1 0 0 0 0.2 0 1 0 0 0.55 0 0 1 0 0.95 0 0 0 0.85 0"
                                  />
                                  <feMerge>
                                    <feMergeNode />
                                    <feMergeNode in="SourceGraphic" />
                                  </feMerge>
                                </filter>
                              </defs>

                              <g transform={`translate(${viewport.panX} ${viewport.panY}) scale(${viewport.scale})`} transformOrigin="280 150">
                                {graphEdges.map((edge) => {
                                  const source = graphPositions[edge.src] ?? graphLayoutById.get(edge.src);
                                  const target = graphPositions[edge.dst] ?? graphLayoutById.get(edge.dst);
                                  if (!source || !target) return null;
                                  const isActive = activeEdgeIds.has(edge.id) || (activeNodeIds.has(edge.src) && activeNodeIds.has(edge.dst));
                                  return (
                                    <line
                                      key={edge.id}
                                      x1={source.x}
                                      y1={source.y}
                                      x2={target.x}
                                      y2={target.y}
                                      stroke={isActive ? "rgba(20, 184, 166, 0.95)" : "rgba(148, 163, 184, 0.2)"}
                                      strokeWidth={isActive ? 2.5 : 1.25}
                                      strokeLinecap="round"
                                    />
                                  );
                                })}

                                {graphLayout.map((entry) => {
                                  const isActive = activeNodeIds.has(entry.node.id);
                                  const position = graphPositions[entry.node.id] ?? entry;
                                  const nodeFill = isActive ? "rgba(20, 184, 166, 0.95)" : "rgba(15, 23, 42, 0.9)";
                                  const nodeStroke = isActive ? "rgba(20, 184, 166, 0.3)" : "rgba(148, 163, 184, 0.3)";
                                  return (
                                    <g
                                      key={entry.node.id}
                                      filter={isActive ? "url(#graphGlow)" : undefined}
                                      style={{ cursor: "grab" }}
                                      onPointerDown={(event) => startNodeDrag(selectedTask.id, entry.node.id, event)}
                                      onPointerMove={(event) => moveNodeDrag(selectedTask.id, event)}
                                      onPointerUp={(event) => endNodeDrag(selectedTask.id, event)}
                                      onPointerCancel={(event) => endNodeDrag(selectedTask.id, event)}
                                    >
                                      <circle cx={position.x} cy={position.y} r={isActive ? 16 : 12} fill={nodeFill} stroke={nodeStroke} strokeWidth={isActive ? 3 : 1.5} />
                                      <circle cx={position.x} cy={position.y} r={isActive ? 24 : 18} fill={isActive ? "rgba(20, 184, 166, 0.12)" : "rgba(148, 163, 184, 0.08)"} />
                                      <text
                                        x={position.x}
                                        y={position.y + 34}
                                        textAnchor="middle"
                                        fill="hsl(var(--foreground) / 0.9)"
                                        fontSize="10"
                                        fontWeight={600}
                                        pointerEvents="none"
                                        className="select-none font-sans"
                                      >
                                        {ellipsis(entry.node.value, 18)}
                                      </text>
                                      <text
                                        x={position.x}
                                        y={position.y + 47}
                                        textAnchor="middle"
                                        fill="hsl(var(--muted-foreground))"
                                        fontSize="8"
                                        letterSpacing="0.08em"
                                        pointerEvents="none"
                                        className="select-none font-sans"
                                      >
                                        {entry.node.type}
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            </svg>
                          </div>
                          {activeNodeLabels.length > 0 && (
                            <div className="p-2.5 rounded-xl border border-border/40 bg-card/30 flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto">
                              {activeNodeLabels.map((lbl, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] font-semibold">
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl p-4">
                          No knowledge entities extracted yet
                        </div>
                      )}
                    </div>
                  </div>
                )
                */}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
