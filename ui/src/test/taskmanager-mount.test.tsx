import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/api", () => ({
  api: {
    listTasks: vi.fn(async () => [{ id: "task-1", title: "T", departmentId: "department-1", status: "in-progress", progress: 0, assignedStaff: ["a1"], description: "d" }]),
    listDepartments: vi.fn(async () => [{ id: "department-1", name: "Department", staff: ["a1"], mode: "sequential", maxSteps: 6 }]),
    listStaff: vi.fn(async () => [{ id: "a1", name: "Staff One", role: "dev", skill_ids: [] }]),
    listProjects: vi.fn(async () => []),
    listSprints: vi.fn(async () => []),
    listMeetings: vi.fn(async () => []),
    upsertTask: vi.fn(async (p: any) => ({ ...p, id: p.id ?? "task-1" })),
    deleteTask: vi.fn(async () => ({ deleted: true })),
    addMeeting: vi.fn(async () => ({ id: "m", staffId: "a1", content: "", timestamp: "", taskId: "task-1" })),
    getTaskGraphContext: vi.fn(async () => ({ nodes: [], edges: [], chunks: [] })),
    interjectStaffGraph: vi.fn(async () => ({ queued: true, message_id: "m" })),
    pauseStaffGraph: vi.fn(async () => ({ paused: true })),
    resumeStaffGraph: vi.fn(async () => ({ resumed: true })),
    respondStaffGraph: vi.fn(async () => ({ delivered: true })),
    runStaffGraphStream: async function* () { /* no events */ },
    canEditItem: () => true,
    canDeleteItem: () => true,
  },
}));

import { RunEngineProvider } from "@/contexts/RunEngineContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import TaskManager from "@/pages/TaskManager";

describe("TaskManager mounts without crashing under the engine provider", () => {
  it("renders", async () => {
    const { container } = render(
      <LanguageProvider>
        <RunEngineProvider>
          <MemoryRouter initialEntries={["/tasks?id=task-1"]}>
            <TaskManager />
          </MemoryRouter>
        </RunEngineProvider>
      </LanguageProvider>,
    );
    await waitFor(() => expect(container.textContent).toContain("Projects"));
  });
});
