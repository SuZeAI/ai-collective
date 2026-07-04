import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  MessageSquare, User, Loader2,
  Building, Send, X,
  Layers
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "next-themes";
import { AgentAvatar } from "@/components/AgentAvatar";
import { ConversationFiles } from "@/components/ConversationFiles";
import { api, buildCustomGraphPayload, type Agent, type Task, type Team } from "@/lib/api";
import { useRunEngine } from "@/contexts/RunEngineContext";
import { useWorkspaceScope } from "@/hooks/use-workspace-scope";

interface AgentState {
  agentId: string;
  status: "idle" | "thinking" | "executing" | "coffee" | "collaborating";
  emote: string;
  message?: string;
}

interface FlyingDocument {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export default function VirtualOffice() {
  const scope = useWorkspaceScope();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // Shared run engine (lives above the router): owns the streaming loop, task
  // list, conversations and thinking-state so runs survive navigation and stay
  // in sync with the Task Manager page.
  const engine = useRunEngine();
  const {
    tasks: taskList,
    conversations: messages,
    thinkingAgents,
    isStreaming,
  } = engine;

  // Data lists
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Forms
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  // Office-map animation layer (presentation only, derived from engine events).
  const [agentRealtimeStates, setAgentRealtimeStates] = useState<Record<string, AgentState>>({});
  
  // Direct chat with individual agent
  const [directChatInput, setDirectChatInput] = useState("");
  const [directChatMessages, setDirectChatMessages] = useState<Record<string, { sender: "user" | "agent"; text: string }[]>>({});
  const [isDirectChatLoading, setIsDirectChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Flying context documents list
  const [flyingDocs, setFlyingDocs] = useState<FlyingDocument[]>([]);
  const lastActiveAgentIdRef = useRef<string | null>(null);

  // Auto-scroll helper
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedTaskId, directChatMessages, selectedAgentId]);

  // Load initial data
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [aData, tData, tasksData] = await Promise.all([
          api.listAgents(),
          api.listTeams(),
          api.listTasks()
        ]);
        if (!active) return;
        setAgents(aData);
        setTeams(tData);
        // Reconcile into the engine — keeps live status for any streaming task.
        engine.ingestTasks(tasksData);
      } catch (err) {
        console.error("Error loading simulation data:", err);
      }
    };
    loadData();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.workspace?.id]);

  // Filter agents and teams by workspace scope
  const filteredAgents = useMemo(() => {
    if (scope.isOverall) return agents;
    return agents.filter((a) => scope.agentIds.has(a.id));
  }, [agents, scope]);

  const filteredTeams = useMemo(() => {
    if (scope.isOverall) return teams;
    return teams.filter((t) => scope.teamIds.has(t.id));
  }, [teams, scope]);

  const filteredTasks = useMemo(() => {
    if (scope.isOverall) return taskList;
    return taskList.filter((t) => {
      const team = teams.find((teamItem) => teamItem.id === t.teamId);
      return team && scope.teamIds.has(team.id);
    });
  }, [taskList, teams, scope]);

  // Selected Task
  const selectedTask = useMemo(() => {
    return taskList.find((t) => t.id === selectedTaskId) || null;
  }, [taskList, selectedTaskId]);

  // Auto-select first task if none selected
  useEffect(() => {
    if (filteredTasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(filteredTasks[0].id);
    }
  }, [filteredTasks, selectedTaskId]);

  // Fetch past messages for selected task — seed the engine only if it has no
  // live transcript (never clobber a run in progress).
  useEffect(() => {
    if (!selectedTaskId) return;
    let active = true;
    api.listConversations(selectedTaskId)
      .then((data) => {
        if (!active) return;
        engine.ingestConversations(selectedTaskId, data);
      })
      .catch((e) => console.error("Error listing conversations:", e));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  // FILTER AGENTS SHOWN ON MAP: If a task is selected, ONLY show the department (team) of that task!
  const visibleAgents = useMemo(() => {
    if (!selectedTask) return filteredAgents;
    const activeTeam = teams.find((t) => t.id === selectedTask.teamId);
    if (!activeTeam) return filteredAgents;
    const assignedIds = new Set(activeTeam.agents);
    return filteredAgents.filter((a) => assignedIds.has(a.id));
  }, [filteredAgents, selectedTask, teams]);

  // Setup initial status
  useEffect(() => {
    if (filteredAgents.length === 0) return;
    const nextStates: Record<string, AgentState> = {};
    filteredAgents.forEach((a) => {
      nextStates[a.id] = {
        agentId: a.id,
        status: "idle",
        emote: "💤",
        message: ""
      };
    });
    setAgentRealtimeStates((prev) => ({
      ...nextStates,
      ...prev
    }));
  }, [filteredAgents]);

  // Wandering cycle for idle agents (makes pantry/coffee active)
  useEffect(() => {
    const interval = setInterval(() => {
      const activeIds = visibleAgents.map((a) => a.id);
      if (activeIds.length === 0) return;

      const randomId = activeIds[Math.floor(Math.random() * activeIds.length)];
      const current = agentRealtimeStates[randomId];
      if (!current) return;

      // Don't wander if actively running task
      const isTaskActive = Object.values(thinkingAgents).some((set) => set.has(randomId));
      if (isTaskActive || current.status === "thinking" || current.status === "executing") return;

      setAgentRealtimeStates((prev) => {
        const ag = prev[randomId];
        if (!ag) return prev;

        const next = { ...prev };
        if (ag.status === "coffee") {
          next[randomId] = {
            ...ag,
            status: "idle",
            emote: "💤",
            message: ""
          };
        } else {
          next[randomId] = {
            ...ag,
            status: "coffee",
            emote: "☕",
            message: "Grabbing a fresh espresso"
          };
        }
        return next;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [agentRealtimeStates, thinkingAgents, visibleAgents]);

  // Calculate coordinates on the full 2D grid canvas
  const agentCanvasPositions = useMemo(() => {
    const positions: Record<string, { left: number; top: number; status: string; emote: string; message: string }> = {};

    const DESKS = [
      { x: 400, y: 380 },
      { x: 400, y: 500 },
      { x: 400, y: 620 },
      { x: 580, y: 440 },
      { x: 580, y: 560 }
    ];

    visibleAgents.forEach((a, index) => {
      const isThinking = thinkingAgents[selectedTaskId ?? ""]?.has(a.id);
      const rtState = agentRealtimeStates[a.id];

      let status = "idle";
      let emote = "💤";
      let message = "";
      
      if (isThinking) {
        status = "thinking";
        emote = "💭";
        message = "Developing software solutions...";
      } else if (rtState) {
        status = rtState.status;
        emote = rtState.emote;
        message = rtState.message || "";
      }

      // Default Desk position (centered exactly over the workstation chair)
      const desk = DESKS[index % DESKS.length];
      let left = desk.x + 28;
      let top = desk.y + 54;

      if (status === "thinking") {
        // Meeting room coordinates (absolute on canvas: Meeting room at left 380, top 80)
        const seatIndex = index % 8;
        if (seatIndex < 4) {
          left = 380 + 85 + (seatIndex * 44) + 12; // Top row of chairs
          top = 80 + 52 + 12;
        } else {
          left = 380 + 85 + ((seatIndex - 4) * 44) + 12; // Bottom row of chairs
          top = 80 + 172 + 12;
        }
      } else if (status === "coffee") {
        // Coffee room coordinates (absolute on canvas: Coffee room at left 780, top 400)
        const seatIndex = index % 4;
        if (seatIndex === 0) {
          left = 780 + 45 + 10;
          top = 400 + 88 + 10;
        } else if (seatIndex === 1) {
          left = 780 + 45 + 40 + 10;
          top = 400 + 88 + 10;
        } else if (seatIndex === 2) {
          left = 780 + 45 + 10;
          top = 400 + 188 + 10;
        } else {
          left = 780 + 45 + 40 + 10;
          top = 400 + 188 + 10;
        }
      } else if (status === "collaborating" || status === "executing") {
        // Collab area coordinates (absolute on canvas: Collab area at left 780, top 80)
        const seatIndex = index % 2;
        if (seatIndex === 0) {
          left = 780 + 55 + 12;
          top = 80 + 148 + 12;
        } else {
          left = 780 + 155 + 12;
          top = 80 + 148 + 12;
        }
      }

      positions[a.id] = {
        left,
        top,
        status,
        emote,
        message
      };
    });

    return positions;
  }, [visibleAgents, thinkingAgents, selectedTaskId, agentRealtimeStates]);

  // Latest canvas positions / visible agents for the event listener (avoids
  // stale closures without resubscribing on every render).
  const canvasPosRef = useRef(agentCanvasPositions);
  canvasPosRef.current = agentCanvasPositions;
  const visibleAgentsRef = useRef(visibleAgents);
  visibleAgentsRef.current = visibleAgents;
  const selectedTaskIdRef = useRef(selectedTaskId);
  selectedTaskIdRef.current = selectedTaskId;

  // Drive the office-map animations from engine stream events. The engine owns
  // the run loop and conversation/thinking state; here we only translate events
  // into agent emotes and flying-document handoffs. Subscribing to "*" means a
  // run started on the Task Manager page animates here too.
  useEffect(() => {
    const unsubscribe = engine.subscribe("*", (event: any) => {
      const eventType = event.type;
      const agentId = event.agent_id || event.agentId || event.agent_name || event.agentName;

      if (eventType === "llm_request_start") {
        if (!agentId) return;
        const senderId = lastActiveAgentIdRef.current;
        const receiverId = agentId;
        const positions = canvasPosRef.current;
        if (senderId && receiverId && senderId !== receiverId) {
          const senderPos = positions[senderId];
          const receiverPos = positions[receiverId];
          if (senderPos && receiverPos) {
            setFlyingDocs((prev) => [
              ...prev,
              { id: `${Date.now()}-${prev.length}`, fromX: senderPos.left, fromY: senderPos.top, toX: receiverPos.left, toY: receiverPos.top },
            ]);
          }
        }
        lastActiveAgentIdRef.current = receiverId;
        setAgentRealtimeStates((prev) => {
          const ag = prev[agentId];
          if (!ag) return prev;
          return { ...prev, [agentId]: { ...ag, status: "thinking", emote: "\ud83d\udcad", message: "Developing software solutions..." } };
        });
      } else if (eventType === "turn_complete" && event.turn) {
        const turn = event.turn;
        const turnAgentId = turn.agent_id || turn.agentId || turn.agent_name || turn.agentName;
        if (!turnAgentId) return;
        lastActiveAgentIdRef.current = turnAgentId;
        setAgentRealtimeStates((prev) => {
          const ag = prev[turnAgentId];
          if (!ag) return prev;
          return { ...prev, [turnAgentId]: { ...ag, status: "collaborating", emote: "\ud83d\udcac", message: "Reviewing code outputs" } };
        });
      } else if (eventType === "run_ended") {
        // A run_ended event fires for whichever task just finished, but this
        // page renders only the currently-selected task's agents \u2014 a
        // different task finishing elsewhere must not idle-out agents that
        // belong to the task the user is actively viewing.
        const endedTaskId = event.taskId || event.task_id;
        if (endedTaskId && endedTaskId !== selectedTaskIdRef.current) return;
        lastActiveAgentIdRef.current = null;
        setAgentRealtimeStates((prev) => {
          const next = { ...prev };
          for (const a of visibleAgentsRef.current) {
            const ag = next[a.id];
            if (ag) next[a.id] = { ...ag, status: "idle", emote: "\ud83d\udca4", message: "" };
          }
          return next;
        });
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start (or restart) a task run through the shared engine.
  const runTask = (task: Task) => {
    if (isStreaming(task.id)) return;
    const team = teams.find((t) => t.id === task.teamId);
    if (!team) return;
    lastActiveAgentIdRef.current = null;
    // Custom mode runs the user-drawn flow; fall back to sequential if unwired.
    const customGraph = buildCustomGraphPayload(team);
    const mode = team.mode === "custom" && !customGraph ? "sequential" : (team.mode ?? "sequential");
    void engine.startTask(task, { mode, maxSteps: team.maxSteps ?? 6, customGraph });
  };

  const handleCreateAndRunTask = async () => {
    if (!taskTitle.trim() || !selectedTeamId) return;

    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return;

    try {
      const newTask = await engine.upsertTask({
        title: taskTitle.trim(),
        description: taskDesc,
        teamId: selectedTeamId,
        status: "pending",
        progress: 0,
        assignedAgents: team.agents
      });

      setSelectedTaskId(newTask.id);
      setTaskTitle("");
      setTaskDesc("");

      runTask(newTask);
    } catch (e) {
      console.error("Failed to create task:", e);
    }
  };

  // Direct chat with agent in inspector
  const handleDirectChat = async () => {
    if (!directChatInput.trim() || !selectedAgentId) return;

    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    const userMessage = directChatInput;
    setDirectChatInput("");
    setDirectChatMessages((prev) => ({
      ...prev,
      [selectedAgentId]: [...(prev[selectedAgentId] ?? []), { sender: "user", text: userMessage }]
    }));
    setIsDirectChatLoading(true);

    setAgentRealtimeStates((prev) => {
      const ag = prev[selectedAgentId];
      if (!ag) return prev;
      return {
        ...prev,
        [selectedAgentId]: {
          ...ag,
          status: "thinking",
          emote: "💻",
          message: "Responding to query..."
        }
      };
    });

    try {
      const res = await api.chat({
        prompt: userMessage,
        agentId: selectedAgentId,
        conversationId: `direct-${selectedAgentId}`,
      });

      setDirectChatMessages((prev) => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] ?? []), { sender: "agent", text: res.response }]
      }));

      setAgentRealtimeStates((prev) => {
        const ag = prev[selectedAgentId];
        if (!ag) return prev;
        return {
          ...prev,
          [selectedAgentId]: {
            ...ag,
            status: "idle",
            emote: "💭",
            message: "Standing by"
          }
        };
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsDirectChatLoading(false);
    }
  };

  const inspectorAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  return (
    <div className="w-full h-full relative overflow-hidden transition-colors duration-200 bg-[#f8fafc] text-slate-900 dark:bg-[#161822] dark:text-slate-200 select-none">
      
      {/* 2D Grid Map Canvas Container (Centrally aligned, scrollable if window is small) */}
      <div className="w-full h-full overflow-auto scrollbar-thin relative z-10 flex items-center justify-center p-4">
        <div
          className="relative rounded-2xl border transition-colors duration-200 border-slate-200 dark:border-slate-800 bg-[#ffffff] dark:bg-[#1e202d] shadow-2xl overflow-hidden shrink-0"
          style={{
            width: "1600px",
            height: "900px",
            backgroundImage: isDark
              ? "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)"
              : "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        >
          {/* Room A: Meeting Room (Indigo Tinted - Positioned in top-middle x:380px) */}
          <div
            className="absolute border-[6px] border-indigo-500/60 rounded-2xl p-4 bg-indigo-50/60 dark:bg-[#252836]/90 transition-colors duration-200"
            style={{ left: "380px", top: "80px", width: "340px", height: "240px" }}
          >
            <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-xs uppercase tracking-wider absolute top-2.5 left-4">
              👥 Meeting Room
            </span>
            {/* Whiteboard */}
            <div className="absolute top-10 left-4 w-12 h-8 bg-slate-100 border border-slate-400 dark:border-slate-700 rounded shadow-sm flex flex-col justify-between p-1">
              <div className="h-0.5 w-full bg-slate-300" />
              <div className="h-0.5 w-2/3 bg-blue-400" />
              <div className="h-0.5 w-1/2 bg-red-400" />
            </div>
            {/* Long Wooden Table */}
            <div className="absolute left-[70px] top-[75px] w-[230px] h-[115px] bg-[#8d6e63] dark:bg-[#5d4037] border-2 border-[#5d4037] dark:border-[#3e2723] rounded-lg shadow-md flex items-center justify-center transition-colors">
              <span className="text-[10px] text-[#efebe9] dark:text-[#8d6e63] font-bold uppercase tracking-widest">Conference</span>
            </div>
            {/* Meeting Chairs */}
            {/* Top row */}
            <div className="absolute top-[52px] left-[85px] flex gap-5">
              {[1, 2, 3, 4].map((i) => <div key={i} className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700/90 border border-slate-400 dark:border-slate-900 shadow-sm" />)}
            </div>
            {/* Bottom row */}
            <div className="absolute top-[192px] left-[85px] flex gap-5">
              {[1, 2, 3, 4].map((i) => <div key={i} className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700/90 border border-slate-400 dark:border-slate-900 shadow-sm" />)}
            </div>
          </div>

          {/* Room B: Collab Area (Amber Tinted - Positioned at top-right x:780px) */}
          <div
            className="absolute border-[6px] border-amber-600/60 rounded-2xl p-4 bg-amber-50/60 dark:bg-[#252836]/90 transition-colors duration-200"
            style={{ left: "780px", top: "80px", width: "340px", height: "240px" }}
          >
            <span className="text-amber-700 dark:text-amber-500 font-bold font-mono text-xs uppercase tracking-wider absolute top-2.5 left-4">
              💡 Collab Area
            </span>
            {/* Bookshelf */}
            <div className="absolute right-4 top-8 w-8 h-20 bg-[#a1887f] dark:bg-[#6d4c41] border border-slate-300 dark:border-slate-800 rounded flex flex-col justify-between p-1 shadow-inner transition-colors">
              <div className="h-2 w-full bg-red-600 rounded-sm" />
              <div className="h-2 w-5/6 bg-blue-500 rounded-sm" />
              <div className="h-2 w-full bg-emerald-500 rounded-sm" />
              <div className="h-2 w-2/3 bg-amber-500 rounded-sm" />
            </div>
            {/* Round desks */}
            <div className="absolute left-[40px] top-[90px] w-14 h-14 rounded-full bg-[#a1887f] dark:bg-[#795548] border-2 border-amber-900 dark:border-amber-950 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#8d6e63] dark:bg-[#5d4037] flex items-center justify-center" />
            </div>
            <div className="absolute left-[140px] top-[90px] w-14 h-14 rounded-full bg-[#a1887f] dark:bg-[#795548] border-2 border-amber-900 dark:border-amber-950 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#8d6e63] dark:bg-[#5d4037] flex items-center justify-center" />
            </div>
            {/* Floor seats */}
            <div className="absolute left-[55px] top-[148px] w-6 h-6 rounded-full bg-red-400 dark:bg-red-500 border border-slate-400 dark:border-slate-900 shadow-lg" />
            <div className="absolute left-[155px] top-[148px] w-6 h-6 rounded-full bg-purple-400 dark:bg-purple-500 border border-slate-400 dark:border-slate-900 shadow-lg" />
          </div>

          {/* Room C: Coffee & Pantry (Green Border - Positioned at bottom-right x:780px, top: 400px) */}
          <div
            className="absolute border-[6px] border-emerald-500/60 rounded-2xl p-4 overflow-hidden transition-colors duration-200"
            style={{
              left: "780px",
              top: "400px",
              width: "340px",
              height: "260px",
              backgroundColor: isDark ? "#16251b" : "#e8f5e9",
              backgroundImage: isDark
                ? "repeating-conic-gradient(#101c13 0% 25%, #16251b 0% 50%)"
                : "repeating-conic-gradient(#c8e6c9 0% 25%, #e8f5e9 0% 50%)",
              backgroundSize: "20px 20px"
            }}
          >
            <div className="absolute inset-0 bg-emerald-950/10 pointer-events-none" />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono text-xs uppercase tracking-wider absolute top-2.5 left-4 z-10">
              ☕ Coffee & Pantry
            </span>
            {/* Coffee machine counter */}
            <div className="absolute right-4 top-10 w-28 h-8 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded flex items-center justify-around px-2 shadow-inner">
              <div className="w-5 h-5 bg-slate-300 dark:bg-slate-900 rounded border border-slate-400 dark:border-slate-700 flex items-center justify-center text-[8px] text-slate-800 dark:text-slate-200">☕</div>
              <div className="w-6 h-4 bg-slate-400 dark:bg-slate-950 rounded border border-slate-500 dark:border-slate-700" />
            </div>
            {/* Dining Table */}
            <div className="absolute left-[30px] top-[115px] w-[160px] h-[80px] bg-[#a1887f] dark:bg-[#8d6e63] border border-[#8d6e63] dark:border-[#5d4037] rounded-lg shadow-md flex items-center justify-around">
              <div className="w-3.5 h-3.5 rounded-full bg-yellow-500" />
              <div className="w-3.5 h-3.5 rounded-full bg-orange-500" />
            </div>
            {/* Pantry chairs */}
            <div className="absolute top-[88px] left-[45px] flex gap-8">
              {[1, 2].map((i) => <div key={i} className="w-5 h-5 rounded bg-emerald-200 dark:bg-emerald-800/80 border border-emerald-300 dark:border-emerald-950" />)}
            </div>
            <div className="absolute top-[200px] left-[45px] flex gap-8">
              {[1, 2].map((i) => <div key={i} className="w-5 h-5 rounded bg-emerald-200 dark:bg-emerald-800/80 border border-emerald-300 dark:border-emerald-950" />)}
            </div>
          </div>

          {/* Workstations Desks (Positioned centrally on the left x:400px and middle x:580px) */}
          {[
            { x: 400, y: 380 },
            { x: 400, y: 500 },
            { x: 400, y: 620 },
            { x: 580, y: 440 },
            { x: 580, y: 560 }
          ].map((desk, idx) => (
            <div key={idx} className="absolute" style={{ left: `${desk.x}px`, top: `${desk.y}px` }}>
              {/* Wooden Desk */}
              <div className="w-14 h-10 bg-[#8d6e63] dark:bg-[#4e342e] border border-[#5d4037] dark:border-amber-950 rounded-md shadow flex items-center justify-center relative transition-colors">
                {/* Keyboard line */}
                <div className="w-6 h-1 bg-slate-300 dark:bg-slate-400 absolute bottom-1.5 rounded-sm" />
                {/* Monitor stand */}
                <div className="w-8 h-1.5 bg-slate-700 dark:bg-slate-900 absolute top-1.5 rounded-sm" />
              </div>
              {/* Desk Chair */}
              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-900 absolute left-4 top-[42px] shadow" />
            </div>
          ))}

          {/* Plant obstacles around the office (Clear of widget regions) */}
          {[
            { x: 340, y: 800 },
            { x: 720, y: 340 },
            { x: 1140, y: 240 },
            { x: 740, y: 680 }
          ].map((plant, idx) => (
            <div key={idx} className="absolute w-8 h-8 rounded-full bg-emerald-50/20 dark:bg-emerald-600/40 border border-emerald-500/20 flex items-center justify-center shadow-lg" style={{ left: `${plant.x}px`, top: `${plant.y}px` }}>
              <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          ))}

          {/* Render Agent tokens using absolute coordinates calculated dynamically */}
          <AnimatePresence>
            {Object.entries(agentCanvasPositions).map(([agentId, pos]) => {
              const agent = agents.find((a) => a.id === agentId);
              if (!agent) return null;

              const isSelected = selectedAgentId === agent.id;
              const isThinking = pos.status === "thinking";
              const isCoffee = pos.status === "coffee";
              const isCollab = pos.status === "collaborating";

              return (
                <motion.div
                  key={agentId}
                  layout
                  transition={{ type: "spring", stiffness: 70, damping: 14 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAgentId(agent.id);
                  }}
                  className="absolute aspect-square flex flex-col items-center justify-center cursor-pointer z-30 group p-1"
                  style={{
                    left: `${pos.left}px`,
                    top: `${pos.top}px`,
                    width: "70px",
                    height: "70px",
                    transform: "translate(-50%, -50%)"
                  }}
                >
                  {/* Thought dialogue bubble */}
                  <AnimatePresence>
                    {pos.message && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -5 }}
                        className="absolute bottom-[75px] bg-white/95 border border-slate-200 text-slate-800 dark:bg-[#0d0f14]/95 dark:border-slate-700 dark:text-slate-200 text-[9px] p-2 rounded-lg shadow-2xl max-w-[150px] leading-normal font-mono text-center pointer-events-none z-40"
                      >
                        {pos.message}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Agent Circular Avatar container with inner micro-animations */}
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    {isThinking && (
                      <span className="absolute inset-0 rounded-full bg-teal-500/35 animate-ping" />
                    )}
                    <motion.div
                      whileHover={{ scale: 1.15 }}
                      animate={
                        isThinking
                          ? { y: [0, -5, 0] }
                          : isCoffee
                          ? { rotate: [-4, 4, -4] }
                          : isCollab
                          ? { scale: [1, 1.08, 1] }
                          : {}
                      }
                      transition={
                        isThinking
                          ? { repeat: Infinity, duration: 2, ease: "easeInOut" }
                          : isCoffee
                          ? { repeat: Infinity, duration: 3, ease: "easeInOut" }
                          : isCollab
                          ? { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
                          : {}
                      }
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all relative ${
                        isThinking
                          ? "border-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.6)]"
                          : isSelected
                          ? "border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                          : "border-slate-200 dark:border-slate-800 group-hover:border-slate-400 dark:group-hover:border-slate-600"
                      }`}
                    >
                      <AgentAvatar
                        agent={agent}
                        className="w-full h-full rounded-full"
                      />
                    </motion.div>
                    <span className="absolute bottom-1 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-100 dark:border-slate-950" />
                  </div>

                  {/* Name banner */}
                  <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 bg-white/90 dark:bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5 pointer-events-none mt-1 shadow-sm truncate max-w-[65px] text-center">
                    {agent.name}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Curved trajectory Flying Context Documents */}
          {flyingDocs.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ x: doc.fromX, y: doc.fromY, scale: 0.3, opacity: 0 }}
              animate={{
                x: [doc.fromX, doc.toX],
                y: [doc.fromY, (doc.fromY + doc.toY) / 2 - 120, doc.toY],
                scale: [0.5, 1.2, 1.2, 0.5],
                opacity: [0, 1, 1, 0]
              }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              onAnimationComplete={() => {
                setFlyingDocs((prev) => prev.filter((d) => d.id !== doc.id));
              }}
              className="absolute z-50 pointer-events-none w-7 h-7 bg-amber-400 dark:bg-amber-500 rounded border border-slate-700 dark:border-slate-800 shadow-xl flex items-center justify-center text-xs"
              style={{
                transform: "translate(-50%, -50%)"
              }}
            >
              📄
            </motion.div>
          ))}

          {/* FLOATING WIDGET 1: Task Board (Top-Left corner of canvas: x:24px, y:24px) */}
          <div className="absolute top-6 left-6 z-40 w-80 bg-white/95 dark:bg-[#0c0f16]/90 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col max-h-[380px] overflow-y-auto scrollbar-thin text-slate-900 dark:text-slate-200 transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Task Board
            </h3>
            
            {/* Task Creator */}
            <div className="space-y-2.5 mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Assign a task..."
                className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-teal-500/50 text-slate-950 dark:text-slate-200"
              />
              <div className="flex gap-2">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="flex-1 h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs focus:outline-none text-slate-600 dark:text-slate-400"
                >
                  <option value="">Auto-assign</option>
                  {filteredTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleCreateAndRunTask}
                  disabled={!taskTitle.trim() || !selectedTeamId}
                  className="px-3 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/40 text-white font-bold text-xs rounded-md shadow transition-all shrink-0"
                >
                  Assign
                </button>
              </div>
            </div>

            {/* Task list selection */}
            <div className="space-y-2">
              {filteredTasks.map((t) => {
                const isActive = selectedTaskId === t.id;
                const streaming = isStreaming(t.id);

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isActive
                        ? "bg-teal-50/50 border-teal-500/50 dark:bg-teal-500/5 dark:border-teal-500/50 shadow-sm"
                        : "bg-slate-100/60 border-slate-200 dark:bg-slate-950/40 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-semibold text-[11px] text-slate-800 dark:text-slate-100 truncate max-w-[170px]">
                        📁 {t.title}
                      </span>
                      {streaming && (
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping shrink-0" />
                      )}
                    </div>
                    
                    {/* Active Controls inside selection */}
                    {isActive && (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800/50 pt-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono capitalize">{t.status}</span>
                        {streaming ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); void engine.stopTask(t); }}
                            className="text-[9px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); runTask(t); }}
                            className="text-[9px] px-2 py-0.5 bg-teal-500 text-black font-bold rounded hover:bg-teal-600"
                          >
                            Start
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FLOATING WIDGET 2: Inspector & Direct Chat Combined (Top-Right corner of canvas: x:1256px, y:24px) */}
          <div className="absolute top-6 right-6 z-40 w-80 bg-white/95 dark:bg-[#0c0f16]/90 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col h-[400px] text-slate-900 dark:text-slate-200 transition-colors">
            {inspectorAgent ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Inspector: {inspectorAgent.name}
                  </h3>
                  <button
                    onClick={() => setSelectedAgentId(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {/* Agent statistics info */}
                <div className="space-y-1.5 text-[10px] font-mono mb-2 border-b border-slate-200 dark:border-slate-800/80 pb-2 shrink-0">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Role:</span>{" "}
                    <span className="text-slate-800 dark:text-slate-200">{inspectorAgent.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {agentRealtimeStates[inspectorAgent.id]?.status || "Idle"}
                    </span>
                  </div>
                </div>

                {/* Combined Direct Agent Chat messaging block */}
                <div className="flex-1 overflow-y-auto space-y-2 pb-2 scrollbar-thin text-xs pr-1 mt-1">
                  {(directChatMessages[inspectorAgent.id] ?? []).map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] p-2 rounded-lg text-xs leading-normal mb-1.5 ${
                        msg.sender === "user"
                          ? "bg-[#6366f1]/10 border border-[#6366f1]/20 text-[#4f46e5] dark:bg-[#6366f1]/20 dark:border-[#6366f1]/30 dark:text-indigo-300"
                          : "bg-slate-100 border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                      }`}>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-normal [&>p]:leading-relaxed [&>p:last-child]:mb-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isDirectChatLoading && (
                    <div className="flex justify-start animate-pulse">
                      <div className="bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-2 rounded-lg text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* direct chat input row inside widget */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 shrink-0 bg-transparent mt-auto space-y-2">
                  {selectedAgentId && (
                    <ConversationFiles
                      taskId={`direct-${selectedAgentId}`}
                      workspaceId={scope.workspace?.id ?? null}
                    />
                  )}
                  <div className="flex gap-2">
                  <input
                    type="text"
                    value={directChatInput}
                    onChange={(e) => setDirectChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDirectChat()}
                    placeholder="Send message..."
                    className="flex-1 h-8 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/50 text-slate-950 dark:text-slate-200"
                  />
                  <button
                    onClick={handleDirectChat}
                    disabled={!directChatInput.trim() || isDirectChatLoading}
                    className="w-8 h-8 rounded-md bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-black flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  Inspector
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Select an agent on the map to inspect and chat.</p>
              </div>
            )}
          </div>

          {/* FLOATING WIDGET 3: Office Chat Logs / Task logs (Bottom-Right corner: x:1216px, y:476px) */}
          <div className="absolute bottom-6 right-6 z-40 w-96 bg-white/95 dark:bg-[#0c0f16]/90 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col h-96 text-slate-900 dark:text-slate-200 transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-3 shrink-0 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Office Chat
            </h3>
            
            {/* Chat Scrolling logs */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pb-2.5 scrollbar-thin text-xs pr-1">
              {selectedTaskId && messages[selectedTaskId] ? (
                // Show General office task conversation logs
                messages[selectedTaskId].map((msg) => {
                  const agent = agents.find((a) => a.id === msg.agentId);
                  return (
                    <div key={msg.id} className="leading-relaxed mb-3">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{agent?.name || msg.agentId}:</span>{" "}
                      <span className="text-[10px] text-slate-400 ml-1">💭</span>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 pl-4 mt-0.5 leading-normal prose prose-sm dark:prose-invert max-w-none [&>p]:leading-normal [&>p:last-child]:mb-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 font-mono text-[10px] text-center pt-20">
                  Select a task to view collaboration logs.
                </div>
              )}
              {selectedTaskId && isStreaming(selectedTaskId) && (
                <div className="text-[10px] text-teal-500 dark:text-teal-400 font-semibold animate-pulse">
                  System: Tuning in to active agent channel...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* FLOATING WIDGET 4: Brand Logo & Layout Editor (Bottom-Left corner: x:24px, y:676px) */}
          <div className="absolute bottom-6 left-6 z-40 flex flex-col gap-2">
            <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors w-max">
              <Layers className="w-3.5 h-3.5" />
              Layout Editor
            </button>
            
            <div className="bg-white/95 dark:bg-[#0c0f16]/90 border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl shadow-2xl flex items-center gap-3 w-64 backdrop-blur-md text-slate-900 dark:text-slate-200 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                <Building className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-100">AgentOffice</h4>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">Real-time simulation</p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
