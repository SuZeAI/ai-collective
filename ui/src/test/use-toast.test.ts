import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { reducer, useToast, toast } from "@/hooks/use-toast";

describe("use-toast reducer", () => {
  it("ADD_TOAST prepends and caps the list at TOAST_LIMIT (1)", () => {
    const state = { toasts: [{ id: "1", open: true }] };
    const next = reducer(state, { type: "ADD_TOAST", toast: { id: "2", open: true } });

    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe("2");
  });

  it("UPDATE_TOAST merges fields into the matching toast by id", () => {
    const state = { toasts: [{ id: "1", open: true, title: "old" }] };
    const next = reducer(state, { type: "UPDATE_TOAST", toast: { id: "1", title: "new" } });

    expect(next.toasts[0]).toMatchObject({ id: "1", open: true, title: "new" });
  });

  it("DISMISS_TOAST with an id sets that toast's open to false, leaves others untouched", () => {
    const state = {
      toasts: [
        { id: "1", open: true },
        { id: "2", open: true },
      ],
    };
    const next = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });

    expect(next.toasts.find((t) => t.id === "1")?.open).toBe(false);
    expect(next.toasts.find((t) => t.id === "2")?.open).toBe(true);
  });

  it("DISMISS_TOAST without an id closes every toast", () => {
    const state = {
      toasts: [
        { id: "1", open: true },
        { id: "2", open: true },
      ],
    };
    const next = reducer(state, { type: "DISMISS_TOAST" });

    expect(next.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("REMOVE_TOAST with an id filters just that toast out", () => {
    const state = {
      toasts: [
        { id: "1", open: true },
        { id: "2", open: true },
      ],
    };
    const next = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });

    expect(next.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("REMOVE_TOAST without an id clears the list", () => {
    const state = { toasts: [{ id: "1", open: true }] };
    const next = reducer(state, { type: "REMOVE_TOAST" });

    expect(next.toasts).toEqual([]);
  });
});

describe("useToast", () => {
  beforeEach(() => {
    act(() => {
      toast({ title: "reset" }).dismiss();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("toast() adds a toast that the hook picks up, capped at 1 visible", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "First" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("First");

    act(() => {
      result.current.toast({ title: "Second" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Second");
  });

  it("dismiss(id) marks the toast closed without removing it immediately", () => {
    const { result } = renderHook(() => useToast());

    let id = "";
    act(() => {
      id = result.current.toast({ title: "Bye" }).id;
    });

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts.find((t) => t.id === id)?.open).toBe(false);
  });
});
