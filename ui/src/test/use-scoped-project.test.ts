import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  api: {
    listProjects: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { useScopedProject } from "@/hooks/use-scoped-project";

const project = (overrides: Partial<{ id: string; key: string }> = {}) => ({
  id: "p1",
  key: "PROJ1",
  name: "Project One",
  ...overrides,
});

describe("useScopedProject", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("resolves the project matching projectKey and filters related data by its id", async () => {
    (api.listProjects as any).mockResolvedValue([project(), project({ id: "p2", key: "PROJ2" })]);
    const fetchRelated = vi.fn(async () => ({
      tasks: [
        { id: "t1", projectId: "p1" },
        { id: "t2", projectId: "p2" },
      ],
    }));

    const { result } = renderHook(() => useScopedProject("PROJ1", fetchRelated));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.project?.id).toBe("p1");
    expect(result.current.data.tasks).toEqual([{ id: "t1", projectId: "p1" }]);
  });

  it("drops a stale in-flight load when projectKey changes before it resolves", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    (api.listProjects as any)
      .mockReturnValueOnce(
        new Promise((res) => {
          resolveFirst = res;
        }),
      )
      .mockResolvedValueOnce([project({ id: "p2", key: "PROJ2" })]);
    const fetchRelated = vi.fn(async () => ({ tasks: [] }));

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useScopedProject(key, fetchRelated),
      { initialProps: { key: "PROJ1" } },
    );

    rerender({ key: "PROJ2" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.project?.id).toBe("p2");

    // The stale PROJ1 fetch resolving afterwards must not overwrite the PROJ2 result.
    resolveFirst([project()]);
    await Promise.resolve();
    expect(result.current.project?.id).toBe("p2");
  });

  it("stops updating state after unmount", async () => {
    let resolveList: (v: unknown) => void = () => {};
    (api.listProjects as any).mockReturnValue(
      new Promise((res) => {
        resolveList = res;
      }),
    );
    const fetchRelated = vi.fn(async () => ({ tasks: [] }));

    const { unmount } = renderHook(() => useScopedProject("PROJ1", fetchRelated));
    unmount();

    expect(() => resolveList([project()])).not.toThrow();
    await Promise.resolve();
  });

  it("sets loading to false without throwing when fetchRelated rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    (api.listProjects as any).mockResolvedValue([project()]);
    const fetchRelated = vi.fn(async () => {
      throw new Error("boom");
    });

    const { result } = renderHook(() => useScopedProject("PROJ1", fetchRelated));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.project).toBeUndefined();
  });

  it("reload() re-runs the fetch", async () => {
    (api.listProjects as any).mockResolvedValue([project()]);
    const fetchRelated = vi.fn(async () => ({ tasks: [] }));

    const { result } = renderHook(() => useScopedProject("PROJ1", fetchRelated));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchRelated).toHaveBeenCalledTimes(1);

    await result.current.reload();
    expect(fetchRelated).toHaveBeenCalledTimes(2);
  });
});
