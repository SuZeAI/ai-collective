import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from "@/lib/api-base";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const USER = { id: "u1", name: "Ada", email: "ada@example.com" };

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts logged out when nothing is persisted", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("restores a valid persisted session on mount", () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok123");
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(USER));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe("tok123");
    expect(result.current.user).toEqual(USER);
  });

  it("discards a corrupt persisted user record instead of trusting it", () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok123");
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ notAUser: true }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it("login persists the token/user and updates state", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ access_token: "tok456", token_type: "bearer", user: USER }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("ada@example.com", "hunter2");
    });

    expect(result.current.user).toEqual(USER);
    expect(result.current.token).toBe("tok456");
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("tok456");
    expect(JSON.parse(localStorage.getItem(AUTH_USER_KEY) as string)).toEqual(USER);
  });

  it("login surfaces the backend's error message and does not persist a session", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ detail: "Invalid credentials" }),
      { status: 401 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.login("ada@example.com", "wrong");
      }),
    ).rejects.toThrow("Invalid credentials");

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("logout clears persisted and in-memory session state", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok123");
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(USER));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toEqual(USER);

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it("updateUser merges a patch into the current user and persists it", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok123");
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(USER));
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.updateUser({ name: "Ada Lovelace" });
    });

    expect(result.current.user).toEqual({ ...USER, name: "Ada Lovelace" });
    expect(JSON.parse(localStorage.getItem(AUTH_USER_KEY) as string).name).toBe("Ada Lovelace");
  });

  it("loginWithToken fetches the user via /auth/me and persists the session", async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify(USER), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithToken("tok789");
    });

    expect(result.current.user).toEqual(USER);
    expect(result.current.token).toBe("tok789");
    const [, options] = fetchMock.mock.calls[0];
    expect((options as RequestInit).headers).toEqual({ Authorization: "Bearer tok789" });
  });

  it("loginWithToken throws and does not persist a session when the token is invalid", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.loginWithToken("bad-token");
      }),
    ).rejects.toThrow("Invalid token");

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("useAuth throws when used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within AuthProvider");
  });
});
