import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/api", () => ({
  api: {
    listTasks: vi.fn(async () => [{ id: "task-1", title: "T", teamId: "team-1", status: "in-progress", progress: 0, assignedAgents: ["a1"], description: "d" }]),
    listTeams: vi.fn(async () => [{ id: "team-1", name: "Team", agents: ["a1"], mode: "sequential", maxSteps: 6 }]),
    listAgents: vi.fn(async () => [{ id: "a1", name: "Agent One", role: "dev", skill_ids: [] }]),
    listProjects: vi.fn(async () => []),
    listSprints: vi.fn(async () => []),
    listConversations: vi.fn(async () => []),
    upsertTask: vi.fn(async (p: any) => ({ ...p, id: p.id ?? "task-1" })),
    deleteTask: vi.fn(async () => ({ deleted: true })),
    addConversation: vi.fn(async () => ({ id: "m", agentId: "a1", content: "", timestamp: "", taskId: "task-1" })),
    getTaskGraphContext: vi.fn(async () => ({ nodes: [], edges: [], chunks: [] })),
    interjectAgentGraph: vi.fn(async () => ({ queued: true, message_id: "m" })),
    pauseAgentGraph: vi.fn(async () => ({ paused: true })),
    resumeAgentGraph: vi.fn(async () => ({ resumed: true })),
    respondAgentGraph: vi.fn(async () => ({ delivered: true })),
    runAgentGraphStream: async function* () { /* no events */ },
    canEditItem: () => true,
    canDeleteItem: () => true,
  },
}));

import { RunEngineProvider } from "@/contexts/RunEngineContext";
import TaskManager from "@/pages/TaskManager";

describe("TaskManager mounts without crashing under the engine provider", () => {
  it("renders", async () => {
    const { container } = render(
      <RunEngineProvider>
        <MemoryRouter initialEntries={["/tasks?id=task-1"]}>
          <TaskManager />
        </MemoryRouter>
      </RunEngineProvider>,
    );
    await waitFor(() => expect(container.textContent).toContain("Projects"));
  });
});
