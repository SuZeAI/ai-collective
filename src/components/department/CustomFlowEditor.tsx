import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
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
import type { Staff, CustomFlow } from "@/lib/api";
import { StaffAvatar } from "@/components/StaffAvatar";

type StaffNodeData = {
  label: string;
  role: string;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
};

// Custom Node component displaying the staff avatar, name, and role,
// with styled boundaries matching the staff's custom avatar color.
function StaffNode({ data }: NodeProps<Node<StaffNodeData>>) {
  const customColor = data.avatar_color || "hsl(var(--primary))";

  return (
    <div
      className="relative group rounded-xl border bg-card/95 backdrop-blur-md px-3.5 py-3 shadow-md hover:shadow-xl transition-all duration-300 flex items-center gap-3.5 min-w-[220px] max-w-[260px]"
      style={{
        borderColor: `${customColor}80`,
        boxShadow: `0 4px 15px -3px rgba(0, 0, 0, 0.05), 0 0 10px -2px ${customColor}15`,
      }}
    >
      {/* Top indicator bar matching the staff's color theme */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
        style={{ backgroundColor: customColor }}
      />

      {/* Target input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: customColor }}
        className="react-flow__handle"
      />

      {/* Avatar wrapper */}
      <div className="flex-shrink-0">
        <StaffAvatar
          staff={{
            avatar: data.avatar,
            avatar_icon: data.avatar_icon,
            avatar_color: data.avatar_color,
            avatar_url: data.avatar_url,
          }}
          className="w-10 h-10 rounded-lg shadow-sm border border-border/50"
        />
      </div>

      {/* Staff details */}
      <div className="flex-1 min-w-0 text-left">
        <div className="text-xs font-semibold text-foreground truncate" title={data.label}>
          {data.label}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5" title={data.role}>
          {data.role}
        </div>
      </div>

      {/* Source output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: customColor }}
        className="react-flow__handle"
      />
    </div>
  );
}

const nodeTypes = { staff: StaffNode };

function edgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

type Props = {
  /** Selected staff, in order — drives exactly one node per staff. */
  staff: Staff[];
  /** Initial flow to restore (positions + edges) when editing a saved department. */
  initialFlow?: CustomFlow | null;
  /** Emitted whenever the user moves a node or adds/removes an edge. */
  onChange: (flow: CustomFlow) => void;
};

function FlowCanvas({ staff, initialFlow, onChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StaffNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Keep track of the initial position map. Only write to it once when loaded.
  const initialPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const seededPositions = useRef(false);

  if (!seededPositions.current && initialFlow?.nodes?.length) {
    initialFlow.nodes.forEach((n) => {
      initialPosRef.current.set(n.id, n.position);
    });
    seededPositions.current = true;
  }

  // Seed edges from the saved flow once.
  const seededEdges = useRef(false);
  useEffect(() => {
    if (seededEdges.current) return;
    if (initialFlow?.edges?.length) {
      seededEdges.current = true;
      setEdges(
        initialFlow.edges.map((e) => ({
          id: e.id || edgeId(e.source, e.target),
          source: e.source,
          target: e.target,
          animated: true,
        })),
      );
    }
  }, [initialFlow, setEdges]);

  // Reconcile nodes with the current selection: one node per selected staff.
  // This effect ONLY triggers when the selected staff list changes.
  const selectedIds = useMemo(() => staff.map((a) => a.id).join(","), [staff]);
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      const next: Node<StaffNodeData>[] = [];
      staff.forEach((a, i) => {
        const existing = byId.get(a.id);
        const position =
          existing?.position ??
          initialPosRef.current.get(a.id) ?? {
            x: 40 + (i % 3) * 280,
            y: 50 + Math.floor(i / 3) * 140,
          };
        next.push({
          id: a.id,
          type: "staff",
          position,
          deletable: false,
          data: {
            label: a.name,
            role: a.role,
            avatar: a.avatar,
            avatar_icon: a.avatar_icon,
            avatar_color: a.avatar_color,
            avatar_url: a.avatar_url,
          },
        });
      });
      return next;
    });

    // Drop edges that reference an staff no longer selected.
    const allowed = new Set(staff.map((a) => a.id));
    setEdges((prev) => prev.filter((e) => allowed.has(e.source) && allowed.has(e.target)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
    // keyed on selectedIds (not `staff`): `staff` is a fresh array
    // reference on every parent render even when the selection is
    // unchanged, so depending on it directly re-runs this effect every
    // render and feeds back into onChange -> parent state -> re-render.
  }, [selectedIds, setNodes, setEdges]);

  // Push the serialized flow up on every node/edge change.
  useEffect(() => {
    onChange({
      nodes: nodes.map((n) => ({ id: n.id, position: n.position })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    });
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      setEdges((eds) => addEdge({ ...conn, id: edgeId(conn.source!, conn.target!), animated: true }, eds));
    },
    [setEdges],
  );

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
    style: { stroke: "hsl(var(--primary) / 0.5)", strokeWidth: 2.5 },
  }), []);

  if (staff.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center text-center text-xs text-muted-foreground border border-input rounded-xl bg-muted/20 px-6">
        Select personnel on the left to add nodes, then drag from a node's right handle to another node's left handle to wire the flow.
      </div>
    );
  }

  return (
    <div className="relative h-[500px] border border-input rounded-xl overflow-hidden bg-muted/10 shadow-inner">
      {/* Inline styles for custom React Flow theme overrides */}
      <style>{`
        .react-flow__handle {
          width: 8px !important;
          height: 8px !important;
          background: hsl(var(--background)) !important;
          border-width: 2px !important;
          border-style: solid !important;
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease;
          z-index: 10;
        }
        .react-flow__handle:hover {
          transform: scale(1.4);
          background: hsl(var(--primary)) !important;
          cursor: crosshair;
        }
        .react-flow__edge-path {
          stroke: hsl(var(--primary) / 0.45);
          stroke-width: 2.5px;
          transition: stroke 0.15s ease, stroke-width 0.15s ease;
        }
        .react-flow__edge.selected .react-flow__edge-path,
        .react-flow__edge:hover .react-flow__edge-path {
          stroke: hsl(var(--primary));
          stroke-width: 3.5px;
          filter: drop-shadow(0 0 3px hsl(var(--primary) / 0.4));
        }
        .react-flow__controls {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 8px !important;
          overflow: hidden;
          background: hsl(var(--background) / 0.8) !important;
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 2px !important;
        }
        .react-flow__controls-button {
          background: transparent !important;
          border: none !important;
          border-bottom: 1px solid hsl(var(--border) / 0.5) !important;
          color: hsl(var(--foreground)) !important;
          fill: currentColor !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 4px !important;
          transition: background-color 0.15s ease;
        }
        .react-flow__controls-button:last-child {
          border-bottom: none !important;
        }
        .react-flow__controls-button:hover {
          background: hsl(var(--muted)) !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="currentColor" className="text-muted-foreground/10" gap={18} size={1} />
        <Controls showInteractive={false} />
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
