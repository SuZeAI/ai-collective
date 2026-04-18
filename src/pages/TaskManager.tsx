import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, CheckCircle2, Clock, Circle, Pause, Play, Square, Pencil, Trash2, ChevronDown, ChevronUp, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AgentAvatar } from "@/components/AgentAvatar";
import { api, type Agent, type GraphContextSnapshot, type Message, type Team, type Task } from "@/lib/api";
import { getAgentRoleColor } from "@/lib/agent-role-ui";

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
  const [open, setOpen] = useState(false);
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
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
    if (updatingTaskIds.has(task.id) || task.status === status) return;
    setUpdatingTaskIds((prev) => new Set(prev).add(task.id));
    try {
      const updated = await api.upsertTask({
        ...task,
        status,
      });
      setTaskList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      // If starting the task, stream agent responses
      if (status === "in-progress" && updated.assignedAgents.length > 0) {
        openTaskView(updated.id);

        // Reset thinking state for a fresh start/restart.
        setThinkingAgents((prev) => {
          const next = { ...prev };
          delete next[updated.id];
          return next;
        });

        // Clear old conversations if restarting from completed/stopped
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
          })) {
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

          // Stream completed, update task to completed with 100% progress
          if (messages.length > 0) {
            const completed = await api.upsertTask({
              ...updated,
              status: "completed",
              progress: 100,
            });
            setTaskList((prev) => prev.map((item) => (item.id === completed.id ? completed : item)));
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
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
      console.error(e);
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
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track team assignments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> New Task</Button>
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
                <SelectTrigger><SelectValue placeholder="Assign to team" /></SelectTrigger>
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
      </header>

      <Dialog
        open={!!viewTaskId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setViewTaskId(null);
            graphDragRef.current = null;
            graphNodeDragRef.current = null;
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-[1600px] w-[98vw] h-[90vh] p-0 gap-0 overflow-hidden">
          {(() => {
            const selectedTask = taskList.find((task) => task.id === viewTaskId);
            if (!selectedTask) return null;

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
              <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,3fr)]">
                <div className="h-full min-h-0 border-r border-border bg-muted/25 overflow-y-auto p-5 space-y-5">
                  <DialogHeader className="space-y-2 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <DialogTitle className="text-xl leading-tight pr-2">{selectedTask.title}</DialogTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewTaskId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${statusColors[selectedTask.status]}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selectedTask.status}</span>
                    </div>
                  </DialogHeader>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{calculatedProgress}% ({messages.length} / {maxRounds})</span>
                    </div>
                    <Progress value={calculatedProgress} className="h-2" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={selectedTask.status === "in-progress" ? "default" : "outline"}
                      onClick={() => updateTaskStatus(selectedTask, "in-progress")}
                      disabled={!canStart || isUpdating}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      {isRestart ? "Restart" : "Start"}
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedTask.status === "paused" ? "default" : "outline"}
                      onClick={() => updateTaskStatus(selectedTask, "paused")}
                      disabled={!canPause}
                    >
                      <Pause className="w-3.5 h-3.5 mr-1" />
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedTask.status === "stopped" ? "destructive" : "outline"}
                      onClick={() => updateTaskStatus(selectedTask, "stopped")}
                      disabled={!canStop}
                    >
                      <Square className="w-3.5 h-3.5 mr-1" />
                      Stop
                    </Button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTask.description || "(No description)"}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Completion Time</label>
                    <p className={`text-xs ${completionDuration ? "text-agent-dev font-semibold" : "text-muted-foreground"}`}>
                      {completionSummary}
                    </p>
                    {startDate && (
                      <div className="text-xs mt-2 space-y-1 text-foreground/85">
                        <p>Start (UTC+7): {formatTaskDateTime(startDate)}</p>
                        <p>End (UTC+7): {endDate ? formatTaskDateTime(endDate) : "(Not completed yet)"}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2">Assigned Team</label>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background text-xs font-semibold border border-border">
                      <AgentAvatar
                        agent={
                          team
                            ? team
                            : {
                                avatar: "T",
                                avatar_icon: "users",
                              }
                        }
                        className={`w-5 h-5 rounded-md text-[10px] ${team?.avatar_color ? "" : "bg-primary/15 text-primary"}`}
                        iconClassName="w-3 h-3"
                      />
                      {team?.name || selectedTask.teamId || "(No team)"}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2">Assigned Agents</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.assignedAgents.map((aid) => {
                        const agent = agentById.get(aid);
                        return agent ? (
                          <span key={aid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background text-xs font-medium border border-border">
                            <AgentAvatar
                              agent={agent}
                              className={`w-5 h-5 rounded-md text-[10px] ${agent.avatar_color ? "" : getAgentRoleColor(agent.role)}`}
                              iconClassName="w-3 h-3"
                            />
                            {agent.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>

                <div className="h-full min-h-0 p-5 flex flex-col border-r border-border bg-background/80 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Live Conversation
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {selectedTask.status === "in-progress" && <span className="w-2 h-2 rounded-full bg-agent-dev animate-pulse" />}
                      <span>{selectedTask.status === "in-progress" ? "Live" : "Recent"}</span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {isConversationLoading && messages.length === 0 && (thinkingAgents[selectedTask.id]?.size ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground animate-pulse">Loading conversation...</p>
                    ) : visibleMessages.length > 0 || (thinkingAgents[selectedTask.id]?.size ?? 0) > 0 ? (
                      <div className="space-y-3">
                        {visibleMessages.map((msg) => {
                          const agent = agentById.get(msg.agentId);
                          const ts = new Date(msg.timestamp);
                          return (
                            <div key={msg.id} className="rounded-lg border border-border/70 p-3 bg-background hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <AgentAvatar
                                  agent={agent || { avatar: "?" }}
                                  className={`w-7 h-7 rounded-md text-[10px] shadow-sm ${agent?.avatar_color ? "" : getAgentRoleColor(agent?.role || "")}`}
                                  iconClassName="w-3.5 h-3.5"
                                />
                                <span className="text-sm font-semibold">{agent?.name ?? msg.agentId}</span>
                                <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                                  {isNaN(ts.getTime()) ? msg.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                              </div>
                              <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:text-sm [&>p]:text-muted-foreground [&>p]:leading-relaxed [&>p:last-child]:mb-0 [&>*:last-child]:mb-0 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1">
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
                              <div key={`thinking-${agentId}`} className="rounded-lg border border-primary/20 p-3 bg-primary/8">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                                  </div>
                                  <span className="text-sm font-semibold text-primary">
                                    {agent?.name ?? agentId} is thinking...
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No conversation yet for this task.</p>
                    )}
                  </div>
                </div>

                <div className="h-full min-h-0 p-5 flex flex-col overflow-hidden bg-card/80 text-foreground">
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-3 mb-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Graph context</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">Knowledge graph activity</div>
                    </div>
                    <div className="text-right text-[11px] text-foreground/70">
                      <div className="font-medium text-foreground">
                        {graphHighlight?.agentName ?? (selectedTask.status === "in-progress" ? "Waiting for context" : "Idle")}
                      </div>
                      <div>{graphNodes.length} nodes · {graphEdges.length} edges</div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 p-0">
                    {graphLoading && !graphSnapshot ? (
                      <div className="flex h-full items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground animate-pulse">
                        Loading graph context...
                      </div>
                    ) : graphNodes.length > 0 ? (
                      <div className="flex h-full min-h-0 flex-col gap-3">
                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted/10">
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
                                    stroke={isActive ? "rgba(96, 165, 250, 0.92)" : "rgba(148, 163, 184, 0.22)"}
                                    strokeWidth={isActive ? 2.4 : 1.25}
                                    strokeLinecap="round"
                                  />
                                );
                              })}

                              {graphLayout.map((entry) => {
                                const isActive = activeNodeIds.has(entry.node.id);
                                const position = graphPositions[entry.node.id] ?? entry;
                                const nodeFill = isActive ? "rgba(96, 165, 250, 0.95)" : "rgba(15, 23, 42, 0.88)";
                                const stroke = isActive ? "rgba(191, 219, 254, 0.98)" : "rgba(148, 163, 184, 0.4)";
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
                                    <circle cx={position.x} cy={position.y} r={isActive ? 16 : 12} fill={nodeFill} stroke={stroke} strokeWidth={isActive ? 3 : 1.5} />
                                    <circle cx={position.x} cy={position.y} r={isActive ? 24 : 18} fill={isActive ? "rgba(59, 130, 246, 0.12)" : "rgba(148, 163, 184, 0.08)"} />
                                    <text
                                      x={position.x}
                                      y={position.y + 34}
                                      textAnchor="middle"
                                      fill="hsl(var(--foreground) / 0.9)"
                                      fontSize="10"
                                      fontWeight={600}
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
                                    >
                                      {entry.node.type}
                                    </text>
                                  </g>
                                );
                              })}
                            </g>
                          </svg>
                        </div>
                        <div className="grid gap-2 rounded-xl border border-border bg-muted/10 p-3 text-xs text-foreground/80 sm:grid-cols-2">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Active nodes</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {activeNodeLabels.length > 0 ? (
                                activeNodeLabels.map((label) => (
                                  <span key={label} className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[11px] text-primary">
                                    {ellipsis(label, 20)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-muted-foreground">No active highlight yet.</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current update</div>
                            <div className="mt-2 space-y-1 text-foreground/70">
                              <div>{graphHighlight?.agentName ? `${graphHighlight.agentName} is loading context` : "Waiting for the next turn"}</div>
                              <div>{activeChunkIds.size} chunk(s) highlighted</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 px-4 text-center text-sm text-muted-foreground">
                        No graph context yet. Start or restart the task to populate the knowledge graph.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {taskList.map((task, i) => {
          const Icon = statusIcons[task.status] ?? Circle;
          const isUpdating = updatingTaskIds.has(task.id);
          const canStart = task.status === "pending" || task.status === "paused" || task.status === "stopped" || task.status === "completed";
          const canPause = task.status === "in-progress";
          const canStop = task.status === "in-progress" || task.status === "paused";
          const messages = taskConversations[task.id] ?? [];
          const isConversationLoading = loadingConversationTaskIds.has(task.id);
          const visibleMessages = messages.slice(-8);
          const isRestart = task.status === "completed";
          const isExpanded = expandedTaskIds.has(task.id);
          const team = teamList.find((t) => t.id === task.teamId);
          const maxRounds = team?.maxSteps ?? 6;
          const startDate = parseTaskDate(task.startTime);
          const endDate = parseTaskDate(task.endTime);
          const completionDuration =
            task.status === "completed" && startDate && endDate
              ? formatDuration(endDate.getTime() - startDate.getTime())
              : null;
          const completionSummary = !startDate
            ? "(No start time yet)"
            : completionDuration ?? "(Not completed yet)";
          
          // Calculate progress based on messages received
          const calculatedProgress = task.status === "completed" ? 100 : Math.min(Math.round((messages.length / maxRounds) * 100), 99);
          
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-card overflow-hidden"
            >
              {/* Compact View */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${statusColors[task.status]}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{task.title}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                        <AgentAvatar
                          agent={
                            team
                              ? team
                              : {
                                  avatar: "T",
                                  avatar_icon: "users",
                                }
                          }
                          className={`w-4 h-4 rounded-md text-[9px] ${team?.avatar_color ? "" : "bg-primary/15 text-primary"}`}
                          iconClassName="w-2.5 h-2.5"
                        />
                        <p className="text-xs text-muted-foreground truncate">{team?.name || "(No team)"}</p>
                      </div>
                      <p className={`text-[11px] mt-1 ${completionDuration ? "text-agent-dev" : "text-muted-foreground"}`}>
                        Completion time: {completionSummary}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleTaskExpanded(task.id)}
                    className="p-1 h-auto flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Progress Bar - Show when in-progress or has messages */}
                {(task.status === "in-progress" || messages.length > 0) && (
                  <div className="mb-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{task.status}</span>
                      <span className="font-bold">{calculatedProgress}%</span>
                    </div>
                    <Progress value={calculatedProgress} className="h-1.5" />
                  </div>
                )}

                {/* Control Buttons - Always Visible */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={task.status === "in-progress" ? "default" : "outline"}
                    onClick={() => updateTaskStatus(task, "in-progress")}
                    disabled={!canStart || isUpdating}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {isRestart ? "Restart" : "Start"}
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === "paused" ? "default" : "outline"}
                    onClick={() => updateTaskStatus(task, "paused")}
                    disabled={!canPause}
                  >
                    <Pause className="w-3.5 h-3.5 mr-1" />
                    Pause
                  </Button>
                  <Button
                    size="sm"
                    variant={task.status === "stopped" ? "destructive" : "outline"}
                    onClick={() => updateTaskStatus(task, "stopped")}
                    disabled={!canStop}
                  >
                    <Square className="w-3.5 h-3.5 mr-1" />
                    Stop
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openTaskView(task.id)}>
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(task)} disabled={isUpdating}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id)} disabled={isUpdating}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-border bg-muted/30 p-5 space-y-4"
                >
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium capitalize">{task.status}</span>
                      <span className="font-bold">{calculatedProgress}% ({messages.length} / {maxRounds} messages)</span>
                    </div>
                    <Progress value={calculatedProgress} className="h-1.5" />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label>
                    <p className="text-sm text-foreground">{task.description || "(No description)"}</p>
                  </div>

                  {/* Completion Time */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Completion Time (UTC+7)</label>
                    {startDate ? (
                      <div className="text-xs space-y-1 text-foreground/90">
                        <p>Start (UTC+7): {formatTaskDateTime(startDate)}</p>
                        <p>End (UTC+7): {endDate ? formatTaskDateTime(endDate) : "(Not completed yet)"}</p>
                        {completionDuration && <p className="font-semibold text-agent-dev">Duration: {completionDuration}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">(No start time yet)</p>
                    )}
                  </div>

                  {/* Assigned Team */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2">Assigned Team</label>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background text-xs font-semibold border border-border">
                      <AgentAvatar
                        agent={
                          team
                            ? team
                            : {
                                avatar: "T",
                                avatar_icon: "users",
                              }
                        }
                        className={`w-5 h-5 rounded-md text-[10px] ${team?.avatar_color ? "" : "bg-primary/15 text-primary"}`}
                        iconClassName="w-3 h-3"
                      />
                      {team?.name || task.teamId || "(No team)"}
                    </div>
                  </div>

                  {/* Assigned Agents */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2">Assigned Agents</label>
                    <div className="flex flex-wrap gap-2">
                      {task.assignedAgents.map((aid) => {
                        const agent = agentById.get(aid);
                        return agent ? (
                          <span key={aid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background text-xs font-medium border border-border">
                            <AgentAvatar
                              agent={agent}
                              className={`w-5 h-5 rounded-md text-[10px] ${agent.avatar_color ? "" : getAgentRoleColor(agent.role)}`}
                              iconClassName="w-3 h-3"
                            />
                            {agent.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Conversation Stream */}
                  {(task.status === "in-progress" || messages.length > 0) && (
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Conversation Stream
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {task.status === "in-progress" && <span className="w-1.5 h-1.5 rounded-full bg-agent-dev animate-pulse" />}
                          <span>{task.status === "in-progress" ? "Live" : "Recent"}</span>
                        </div>
                      </div>

                      {isConversationLoading && messages.length === 0 && (thinkingAgents[task.id]?.size ?? 0) === 0 ? (
                        <p className="text-xs text-muted-foreground animate-pulse">...</p>
                      ) : visibleMessages.length > 0 || (thinkingAgents[task.id]?.size ?? 0) > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {visibleMessages.map((msg) => {
                            const agent = agentById.get(msg.agentId);
                            const ts = new Date(msg.timestamp);
                            return (
                              <div key={msg.id} className="rounded-md border border-border/60 p-2.5 bg-background hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                      className="flex-shrink-0"
                                  >
                                    <AgentAvatar
                                      agent={agent || { avatar: "?" }}
                                      className={`w-6 h-6 rounded-md text-[10px] shadow-sm ${agent?.avatar_color ? "" : getAgentRoleColor(agent?.role || "")}`}
                                      iconClassName="w-3 h-3"
                                    />
                                  </div>
                                  <span className="text-xs font-semibold">{agent?.name ?? msg.agentId}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                                    {isNaN(ts.getTime()) ? msg.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                  </span>
                                </div>
                                <div className="prose prose-xs dark:prose-invert max-w-none [&>p]:text-xs [&>p]:text-muted-foreground [&>p]:leading-relaxed [&>p:last-child]:mb-0 [&>*:last-child]:mb-0 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Thinking indicators - compact view */}
                          {(thinkingAgents[task.id]?.size ?? 0) > 0 && (
                            Array.from(thinkingAgents[task.id] ?? []).map((agentId) => {
                              const agent = agentById.get(agentId);
                              return (
                                <div key={`thinking-${agentId}`} className="rounded-md border border-primary/20 p-2 bg-primary/8">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-0.5">
                                      <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                      <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                                      <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                                    </div>
                                    <span className="text-xs font-semibold text-primary">
                                      {agent?.name ?? agentId} thinking...
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No conversation yet for this task.</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
