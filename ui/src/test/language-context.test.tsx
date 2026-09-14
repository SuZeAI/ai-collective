import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "ai-collective-language";

function wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe("LanguageContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("defaults to English when nothing is persisted", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe("en");
    expect(result.current.t.auth.loginTab).toBe("Sign In");
  });

  it("restores a persisted language on mount", () => {
    localStorage.setItem(STORAGE_KEY, "vi");

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe("vi");
  });

  it("ignores a corrupt persisted value and falls back to English", () => {
    localStorage.setItem(STORAGE_KEY, "klingon");

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe("en");
  });

  it("setLanguage switches the language, updates t, and persists the choice", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage("ja");
    });

    expect(result.current.language).toBe("ja");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("ja");
  });

  it("keeps document.documentElement.lang in sync with the selected language", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLanguage("zh");
    });

    expect(document.documentElement.lang).toBe("zh");
  });

  it("throws when used outside a LanguageProvider", () => {
    expect(() => renderHook(() => useLanguage())).toThrow(/must be used within/);
  });
});
