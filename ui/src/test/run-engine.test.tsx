import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useEffect, useState } from "react";

// --- A tiny mutable "backend" the mocked api reads/writes, so a page's
// remount-time reconcile reflects what the server actually has. ---------------
const backend: { tasks: any[]; convos: Record<string, any[]> } = {
  tasks: [{ id: "task-1", title: "T", departmentId: "department-1", status: "pending", progress: 0, assignedStaff: ["a1"], description: "" }],
  convos: {},
};

const events: any[] = [
  { type: "llm_request_start", agent_id: "a1" },
  { type: "turn_complete", turn: { agent_id: "a1", turn: 1, content: "Hello from staff" } },
];

vi.mock("@/lib/api", () => ({
  api: {
    listTasks: vi.fn(async () => backend.tasks.map((t) => ({ ...t }))),
    listMeetings: vi.fn(async (taskId: string) => (backend.convos[taskId] ?? []).map((m) => ({ ...m }))),
    upsertTask: vi.fn(async (payload: any) => {
      const id = payload.id ?? "task-1";
      const existing = backend.tasks.find((t) => t.id === id);
      const merged = { ...(existing ?? {}), ...payload, id };
      if (existing) Object.assign(existing, merged);
      else backend.tasks.push(merged);
      return { ...merged };
    }),
    deleteTask: vi.fn(async () => ({ deleted: true })),
    addMeeting: vi.fn(async (p: any) => {
      const m = { id: `srv-${(backend.convos[p.taskId]?.length ?? 0) + 1}`, staffId: p.staffId, content: p.content, timestamp: "", taskId: p.taskId };
      backend.convos[p.taskId] = [...(backend.convos[p.taskId] ?? []), m];
      return { ...m };
    }),
    getTaskGraphContext: vi.fn(async () => ({ nodes: [], edges: [], chunks: [] })),
    interjectStaffGraph: vi.fn(async () => ({ queued: true, message_id: "mi" })),
    pauseStaffGraph: vi.fn(async () => ({ paused: true })),
    resumeStaffGraph: vi.fn(async () => ({ resumed: true })),
    respondStaffGraph: vi.fn(async () => ({ delivered: true })),
    runStaffGraphStream: async function* () {
      for (const e of events) yield e;
      await new Promise<void>(() => {}); // stay open
    },
  },
}));

import { RunEngineProvider, useRunEngine } from "@/contexts/RunEngineContext";

const TASK: any = { id: "task-1", title: "T", departmentId: "department-1", status: "pending", progress: 0, assignedStaff: ["a1"], description: "" };

// Mirrors the real pages: fetch from backend on (re)mount and reconcile.
function Consumer() {
  const engine = useRunEngine();
  const { ingestTasks, ingestMeetings } = engine;
  useEffect(() => {
    let active = true;
    (async () => {
      const { api } = await import("@/lib/api");
      const tasks = await api.listTasks();
      if (!active) return;
      ingestTasks(tasks);
      for (const t of tasks) {
        const msgs = await api.listMeetings(t.id);
        if (active) ingestMeetings(t.id, msgs);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const task = engine.tasks.find((t) => t.id === "task-1");
  return (
    <div>
      <div data-testid="status">{task?.status ?? "none"}</div>
      <div data-testid="streaming">{engine.isStreaming("task-1") ? "yes" : "no"}</div>
      <div data-testid="messages">{(engine.meetings["task-1"] ?? []).length}</div>
      <button onClick={() => engine.startTask(TASK, { mode: "sequential", maxSteps: 6 })}>start</button>
    </div>
  );
}

function Harness() {
  const [onPage, setOnPage] = useState(true);
  return (
    <RunEngineProvider>
      <button onClick={() => setOnPage((v) => !v)}>toggle</button>
      {onPage && <Consumer />}
    </RunEngineProvider>
  );
}

describe("RunEngine persistence across navigation", () => {
  beforeEach(() => {
    backend.tasks = [{ id: "task-1", title: "T", departmentId: "department-1", status: "pending", progress: 0, assignedStaff: ["a1"], description: "" }];
    backend.convos = {};
  });

  it("keeps run state when the page unmounts and remounts (with backend reconcile)", async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("pending"));

    await act(async () => { fireEvent.click(screen.getByText("start")); });

    await waitFor(() => expect(screen.getByTestId("streaming").textContent).toBe("yes"));
    expect(screen.getByTestId("status").textContent).toBe("in-progress");
    await waitFor(() => expect(screen.getByTestId("messages").textContent).toBe("1"));

    // Navigate away then back; the page remounts and reconciles from backend.
    await act(async () => { fireEvent.click(screen.getByText("toggle")); });
    await act(async () => { fireEvent.click(screen.getByText("toggle")); });
    // let the remount reconcile effect resolve
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByTestId("streaming").textContent).toBe("yes");
    expect(screen.getByTestId("status").textContent).toBe("in-progress");
    expect(Number(screen.getByTestId("messages").textContent)).toBeGreaterThanOrEqual(1);
  });
});
