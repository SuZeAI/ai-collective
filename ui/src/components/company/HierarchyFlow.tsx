import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, FolderKanban, Layers, Repeat2 } from "lucide-react";
import type { Company, Department, Staff, Project, Epic, Sprint } from "@/lib/api";
import { StaffAvatar } from "@/components/StaffAvatar";

type EntityNodeData = {
  label: string;
  subtitle?: string;
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
  icon?: "company" | "project" | "epic" | "sprint";
};

const KIND_ICON = { company: Building2, project: FolderKanban, epic: Layers, sprint: Repeat2 };

// Shared card shell for every node kind — avatar/icon, label, optional subtitle,
// themed like CustomFlowEditor's StaffNode so this reads as the same "flow" UI.
function EntityNode({ data }: NodeProps<Node<EntityNodeData>>) {
  const customColor = data.avatar_color || "hsl(var(--primary))";
  const Icon = data.icon ? KIND_ICON[data.icon] : undefined;

  return (
    <div
      className="relative rounded-xl border bg-card/95 backdrop-blur-md px-3.5 py-3 shadow-md flex items-center gap-3 min-w-[200px] max-w-[240px]"
      style={{ borderColor: `${customColor}80`, boxShadow: `0 4px 15px -3px rgba(0, 0, 0, 0.05), 0 0 10px -2px ${customColor}15` }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ backgroundColor: customColor }} />
      <Handle type="target" position={Position.Top} style={{ borderColor: customColor }} className="react-flow__handle" />
      <div className="flex-shrink-0">
        {Icon ? (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${customColor}1a`, color: customColor }}
          >
            <Icon className="w-4 h-4" />
          </div>
        ) : (
          <StaffAvatar staff={data} className="w-9 h-9 rounded-lg shadow-sm border border-border/50" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-xs font-semibold text-foreground truncate" title={data.label}>{data.label}</div>
        {data.subtitle && (
          <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5" title={data.subtitle}>
            {data.subtitle}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ borderColor: customColor }} className="react-flow__handle" />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

const CARD_W = 260;
const CARD_H = 80;
const CHILD_COLS = 2;
const ROOT_Y = 0;
const BRANCH_Y = ROOT_Y + CARD_H + 70;
const LEAF_Y = BRANCH_Y + CARD_H + 70;
const LEAF_ROW_GAP = CARD_H + 16;
const BRANCH_GAP = 60;

function makeNode(id: string, x: number, y: number, data: EntityNodeData): Node<EntityNodeData> {
  return { id, type: "entity", position: { x, y }, draggable: true, deletable: false, data };
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    animated: true,
    style: { stroke: "hsl(var(--primary) / 0.45)", strokeWidth: 2 },
  };
}

// Lays out one "branch" column (a Department+its Staff, or a Project+its
// Epics/Sprints) starting at `xOffset`, and returns how wide it ended up so
// the caller can place the next branch after it.
function layoutBranch(
  branchId: string,
  branchData: EntityNodeData,
  leaves: { id: string; data: EntityNodeData }[],
  xOffset: number,
): { nodes: Node<EntityNodeData>[]; edges: Edge[]; width: number } {
  const width = Math.max(CARD_W, CHILD_COLS * (CARD_W + 24));
  const branchX = xOffset + width / 2 - CARD_W / 2;

  const nodes: Node<EntityNodeData>[] = [makeNode(branchId, branchX, BRANCH_Y, branchData)];
  const edges: Edge[] = [];

  leaves.forEach((leaf, i) => {
    const col = i % CHILD_COLS;
    const row = Math.floor(i / CHILD_COLS);
    const x = xOffset + col * (CARD_W + 24);
    const y = LEAF_Y + row * LEAF_ROW_GAP;
    nodes.push(makeNode(leaf.id, x, y, leaf.data));
    edges.push(makeEdge(branchId, leaf.id));
  });

  return { nodes, edges, width: width + BRANCH_GAP };
}

type Props = {
  company: Company;
  departments: Department[];
  staffList: Staff[];
  projects: Project[];
  epics: Epic[];
  sprints: Sprint[];
};

function FlowCanvas({ company, departments, staffList, projects, epics, sprints }: Props) {
  const { nodes, edges } = useMemo(() => {
    const staffById = new Map(staffList.map((s) => [s.id, s]));
    const allNodes: Node<EntityNodeData>[] = [];
    const allEdges: Edge[] = [];
    let x = 0;

    const companyNodeId = `company:${company.id}`;

    departments.forEach((dept) => {
      const leaves = dept.staff
        .map((staffId) => staffById.get(staffId))
        .filter((s): s is Staff => Boolean(s))
        .map((s) => ({
          id: `staff:${s.id}`,
          data: { label: s.name, subtitle: s.role, avatar: s.avatar, avatar_icon: s.avatar_icon, avatar_color: s.avatar_color, avatar_url: s.avatar_url },
        }));
      const branch = layoutBranch(
        `dept:${dept.id}`,
        { label: dept.name, subtitle: `${dept.staff.length} staff`, avatar: dept.avatar, avatar_icon: dept.avatar_icon, avatar_color: dept.avatar_color, avatar_url: dept.avatar_url },
        leaves,
        x,
      );
      allNodes.push(...branch.nodes);
      allEdges.push(...branch.edges, makeEdge(companyNodeId, `dept:${dept.id}`));
      x += branch.width;
    });

    projects.forEach((project) => {
      const leaves = [
        ...epics.filter((e) => e.projectId === project.id).map((e) => ({
          id: `epic:${e.id}`,
          data: { label: e.title, subtitle: e.status || "Epic", avatar_color: e.color, icon: "epic" as const },
        })),
        ...sprints.filter((s) => s.projectId === project.id).map((s) => ({
          id: `sprint:${s.id}`,
          data: { label: s.name, subtitle: s.status || "Sprint", icon: "sprint" as const },
        })),
      ];
      const branch = layoutBranch(
        `project:${project.id}`,
        { label: project.name, subtitle: project.key, avatar: project.avatar, avatar_icon: project.avatar_icon, avatar_color: project.avatar_color, avatar_url: project.avatar_url, icon: "project" },
        leaves,
        x,
      );
      allNodes.push(...branch.nodes);
      allEdges.push(...branch.edges, makeEdge(companyNodeId, `project:${project.id}`));
      x += branch.width;
    });

    const totalWidth = Math.max(x, CARD_W);
    allNodes.unshift(
      makeNode(companyNodeId, totalWidth / 2 - CARD_W / 2, ROOT_Y, {
        label: company.name,
        subtitle: "Company",
        avatar: company.avatar,
        avatar_icon: company.avatar_icon,
        avatar_color: company.avatar_color,
        avatar_url: company.avatar_url,
        icon: "company",
      }),
    );

    return { nodes: allNodes, edges: allEdges };
  }, [company, departments, staffList, projects, epics, sprints]);

  return (
    <div className="relative h-full w-full bg-muted/10">
      <style>{`
        .react-flow__handle {
          width: 8px !important;
          height: 8px !important;
          background: hsl(var(--background)) !important;
          border-width: 2px !important;
          border-style: solid !important;
        }
        .react-flow__edge-path {
          stroke: hsl(var(--primary) / 0.4);
          stroke-width: 2px;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="currentColor" className="text-muted-foreground/10" gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function HierarchyFlow(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
