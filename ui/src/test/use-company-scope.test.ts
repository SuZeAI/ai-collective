import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  api: {
    getCompany: vi.fn(),
    listDepartments: vi.fn(async () => []),
    listStaff: vi.fn(async () => []),
    listProjects: vi.fn(async () => []),
  },
}));

import { api } from "@/lib/api";
import { OVERALL_COMPANY_ID, getActiveCompanyId, setActiveCompanyId, useCompanyScope } from "@/hooks/use-company-scope";

describe("active company persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getActiveCompanyId returns null when unset or set to the overall sentinel", () => {
    expect(getActiveCompanyId()).toBeNull();
    localStorage.setItem("activeCompanyId", OVERALL_COMPANY_ID);
    expect(getActiveCompanyId()).toBeNull();
  });

  it("setActiveCompanyId persists the id and broadcasts activeCompanyChanged", () => {
    const listener = vi.fn();
    window.addEventListener("activeCompanyChanged", listener);

    setActiveCompanyId("company-1");

    expect(localStorage.getItem("activeCompanyId")).toBe("company-1");
    expect(getActiveCompanyId()).toBe("company-1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("company-1");

    window.removeEventListener("activeCompanyChanged", listener);
  });

  it("setActiveCompanyId(null) stores the overall sentinel", () => {
    setActiveCompanyId("company-1");
    setActiveCompanyId(null);
    expect(localStorage.getItem("activeCompanyId")).toBe(OVERALL_COMPANY_ID);
    expect(getActiveCompanyId()).toBeNull();
  });
});

describe("useCompanyScope", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (api.listDepartments as any).mockResolvedValue([]);
    (api.listStaff as any).mockResolvedValue([]);
    (api.listProjects as any).mockResolvedValue([]);
  });

  it("defaults to Overall scope when no company is active", () => {
    const { result } = renderHook(() => useCompanyScope());
    expect(result.current.isOverall).toBe(true);
    expect(result.current.ready).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it("resolves department/staff/project id sets for the active company", async () => {
    (api.getCompany as any).mockResolvedValue({ id: "c1", departmentIds: ["d1"] });
    (api.listDepartments as any).mockResolvedValue([{ id: "d1", staff: ["a1"] }, { id: "d2", staff: ["a2"] }]);
    (api.listStaff as any).mockResolvedValue([{ id: "a1", skill_ids: ["sk1"] }, { id: "a2", skill_ids: ["sk2"] }]);
    (api.listProjects as any).mockResolvedValue([{ id: "p1" }]);
    setActiveCompanyId("c1");

    const { result } = renderHook(() => useCompanyScope());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isOverall).toBe(false);
    expect(result.current.departmentIds.has("d1")).toBe(true);
    expect(result.current.departmentIds.has("d2")).toBe(false);
    expect(result.current.staffIds.has("a1")).toBe(true);
    expect(result.current.staffIds.has("a2")).toBe(false);
    expect(result.current.skillIds.has("sk1")).toBe(true);
    expect(result.current.projectIds.has("p1")).toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it("is pending while a company is selected but membership hasn't resolved yet", async () => {
    let resolveCompany: (v: unknown) => void = () => {};
    (api.getCompany as any).mockReturnValue(
      new Promise((res) => {
        resolveCompany = res;
      }),
    );
    setActiveCompanyId("c1");

    const { result } = renderHook(() => useCompanyScope());
    expect(result.current.isOverall).toBe(false);
    expect(result.current.pending).toBe(true);

    resolveCompany({ id: "c1", departmentIds: [] });
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("falls back to Overall when the company fails to resolve (e.g. deleted elsewhere)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    (api.getCompany as any).mockRejectedValue(new Error("404"));
    setActiveCompanyId("c1");

    const { result } = renderHook(() => useCompanyScope());

    await waitFor(() => expect(result.current.isOverall).toBe(true));
    expect(result.current.pending).toBe(false);
  });
});
