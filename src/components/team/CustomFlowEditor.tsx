import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Agent, CustomFlow } from "@/lib/api";

type AgentNodeData = { label: string; role: string };

// Node renders the agent name + role with a left (target) and right (source)
// connection handle so the user can wire an explicit flow.
function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  return (
    <div className="rounded-lg border-2 border-primary/40 bg-card px-3 py-2 shadow-sm text-center min-w-[120px]">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <div className="text-sm font-semibold text-foreground">{data.label}</div>
      <div className="text-[10px] text-muted-foreground">{data.role}</div>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

function edgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

type Props = {
  /** Selected agents, in order — drives exactly one node per agent. */
  agents: Agent[];
  /** Initial flow to restore (positions + edges) when editing a saved team. */
  initialFlow?: CustomFlow | null;
  /** Emitted whenever the user moves a node or adds/removes an edge. */
  onChange: (flow: CustomFlow) => void;
};

function FlowCanvas({ agents, initialFlow, onChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const initialPos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    initialFlow?.nodes?.forEach((n) => map.set(n.id, n.position));
    return map;
  }, [initialFlow]);

  // Seed edges from the saved flow once.
  const seededEdges = useRef(false);
  useEffect(() => {
    if (seededEdges.current) return;
    seededEdges.current = true;
    if (initialFlow?.edges?.length) {
      setEdges(
        initialFlow.edges.map((e) => ({ id: e.id || edgeId(e.source, e.target), source: e.source, target: e.target })),
      );
    }
  }, [initialFlow, setEdges]);

  // Reconcile nodes with the current selection: one node per selected agent.
  // Nodes are not user-deletable (selection owns membership); edges are free.
  const selectedIds = useMemo(() => agents.map((a) => a.id).join(","), [agents]);
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      const next: Node<AgentNodeData>[] = [];
      agents.forEach((a, i) => {
        const existing = byId.get(a.id);
        const position = existing?.position ?? initialPos.get(a.id) ?? { x: 60 + (i % 4) * 200, y: 80 + Math.floor(i / 4) * 130 };
        next.push({
          id: a.id,
          type: "agent",
          position,
          deletable: false,
          data: { label: a.name, role: a.role },
        });
      });
      return next;
    });
    // Drop edges that reference an agent no longer selected.
    const allowed = new Set(agents.map((a) => a.id));
    setEdges((prev) => prev.filter((e) => allowed.has(e.source) && allowed.has(e.target)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, initialPos, setNodes, setEdges]);

  // Push the serialized flow up on every node/edge change.
  useEffect(() => {
    onChange({
      nodes: nodes.map((n) => ({ id: n.id, position: n.position })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      setEdges((eds) => addEdge({ ...conn, id: edgeId(conn.source!, conn.target!) }, eds));
    },
    [setEdges],
  );

  if (agents.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center text-center text-xs text-muted-foreground border border-input rounded-lg bg-muted/50 px-4">
        Select personnel on the left to add nodes, then drag from a node's right handle to another node's left handle to wire the flow.
      </div>
    );
  }

  return (
    <div className="h-[320px] border border-input rounded-lg overflow-hidden bg-muted/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

export default function CustomFlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
