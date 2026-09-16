import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

function stubMatchMedia() {
  let changeHandler: (() => void) | undefined;
  const mql = {
    matches: false,
    media: "",
    addEventListener: (_: string, handler: () => void) => {
      changeHandler = handler;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => mql);
  return () => changeHandler?.();
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports false above the 768px breakpoint", () => {
    setInnerWidth(1024);
    stubMatchMedia();

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("reports true below the 768px breakpoint", () => {
    setInnerWidth(500);
    stubMatchMedia();

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("re-evaluates when the media query change handler fires", () => {
    setInnerWidth(1024);
    const fireChange = stubMatchMedia();

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setInnerWidth(400);
    act(() => {
      fireChange();
    });

    expect(result.current).toBe(true);
  });
});
