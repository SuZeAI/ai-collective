import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  api: {
    simulatePlan: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { useStaffSimulation } from "@/hooks/use-staff-simulation";

describe("useStaffSimulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends a message per step, tracks phase, and clears isSimulating on success", async () => {
    (api.simulatePlan as any).mockResolvedValue({
      steps: [
        { staff: "Planner", msg: "Kicking off", phase: 1, delay_ms: 1 },
        { staff: "Coder", msg: "Implementing", phase: 2, delay_ms: 1 },
      ],
    });

    const { result } = renderHook(() => useStaffSimulation());

    await act(async () => {
      await result.current.runSimulation("Build a widget");
    });

    expect(result.current.isSimulating).toBe(false);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: "Planner", content: "Kicking off" });
    expect(result.current.messages[1]).toMatchObject({ role: "Coder", content: "Implementing" });
    expect(result.current.currentStep).toBe(2);
  });

  it("surfaces a System error message and clears isSimulating when the API returns no steps", async () => {
    (api.simulatePlan as any).mockResolvedValue({ steps: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useStaffSimulation());

    await act(async () => {
      await result.current.runSimulation("Build a widget");
    });

    expect(result.current.isSimulating).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("System");
    expect(result.current.messages[0].content).toContain("No simulation steps returned from API");
  });

  it("surfaces a System error message when the API call rejects", async () => {
    (api.simulatePlan as any).mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useStaffSimulation());

    await act(async () => {
      await result.current.runSimulation("Build a widget");
    });

    expect(result.current.isSimulating).toBe(false);
    expect(result.current.messages[0]).toMatchObject({ role: "System", content: "Error: network down" });
  });

  it("reset() clears messages, currentStep, and isSimulating", async () => {
    (api.simulatePlan as any).mockResolvedValue({
      steps: [{ staff: "Planner", msg: "Kicking off", phase: 1, delay_ms: 1 }],
    });

    const { result } = renderHook(() => useStaffSimulation());
    await act(async () => {
      await result.current.runSimulation("Build a widget");
    });
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.reset();
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(0));
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isSimulating).toBe(false);
  });
});
