import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from "@/lib/api-base";
import {
  api,
  buildCustomGraphPayload,
  mapAuthUser,
  avgCompletionOf,
  getCurrentUserId,
  canDeleteItem,
  type Task,
} from "@/lib/api";

describe("apiFetch (via api.* calls)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs from the api base with a JSON content-type header", async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify([{ id: "s1" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.listStaff();

    expect(result).toEqual([{ id: "s1" }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/staff");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("attaches an Authorization header when a token is stored", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok123");
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.listStaff();

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("sends upsertTask as a POST with a JSON body", async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify({ id: "t1", title: "New" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.upsertTask({ title: "New" });

    expect(result).toEqual({ id: "t1", title: "New" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ title: "New" });
  });

  it("throws the backend's detail message on a non-ok response", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ detail: "Staff not found" }), { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.listStaff()).rejects.toThrow("Staff not found");
  });

  it("falls back to a status-line message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("not json", { status: 500, statusText: "Server Error" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.listStaff()).rejects.toThrow("500 Server Error");
  });

  it("clears the stored token and dispatches auth:token-expired on a 401", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "tok123");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const listener = vi.fn();
    window.addEventListener("auth:token-expired", listener);

    await expect(api.listStaff()).rejects.toThrow();

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:token-expired", listener);
  });
});

describe("api.runStaffGraphStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses SSE 'data:' lines from the response body into events", async () => {
    const encoder = new TextEncoder();
    const chunks = ['data: {"type":"a"}\n', 'data: {"type":"b"}\n\n', "data: not-json\n"];
    let i = 0;
    const reader = {
      read: async () => {
        if (i < chunks.length) return { done: false, value: encoder.encode(chunks[i++]) };
        return { done: true, value: undefined };
      },
      releaseLock: () => {},
    };
    const fetchMock = vi.fn(async () => ({ ok: true, body: { getReader: () => reader } }));
    vi.stubGlobal("fetch", fetchMock);

    const events: unknown[] = [];
    for await (const e of api.runStaffGraphStream({ user_input: "hi", staff: ["a1"] })) {
      events.push(e);
    }

    // Malformed "data: not-json" lines are dropped silently, not thrown.
    expect(events).toEqual([{ type: "a" }, { type: "b" }]);
  });

  it("throws when the run-stream request itself fails", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ detail: "boom" }), { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const iterate = async () => {
      for await (const _e of api.runStaffGraphStream({ user_input: "hi", staff: ["a1"] })) {
        // no-op
      }
    };
    await expect(iterate()).rejects.toThrow("boom");
  });
});

describe("buildCustomGraphPayload", () => {
  it("returns undefined when mode isn't custom", () => {
    expect(
      buildCustomGraphPayload({ mode: "sequential", flow: { nodes: [], edges: [{ id: "e1", source: "a", target: "b" }] } }),
    ).toBeUndefined();
  });

  it("returns undefined when custom mode has no wired edges", () => {
    expect(buildCustomGraphPayload({ mode: "custom", flow: { nodes: [], edges: [] } })).toBeUndefined();
    expect(buildCustomGraphPayload({ mode: "custom", flow: null })).toBeUndefined();
  });

  it("maps flow edges to source/target pairs when custom mode is wired", () => {
    const flow = { nodes: [], edges: [{ id: "e1", source: "a", target: "b" }] };
    expect(buildCustomGraphPayload({ mode: "custom", flow })).toEqual({ edges: [{ source: "a", target: "b" }] });
  });
});

describe("mapAuthUser", () => {
  it("prefers camelCase joinedAt when present", () => {
    expect(mapAuthUser({ id: "1", name: "A", email: "a@b.com", joinedAt: "2026-01-01" }).joinedAt).toBe("2026-01-01");
  });

  it("falls back to snake_case joined_at", () => {
    expect(mapAuthUser({ id: "1", name: "A", email: "a@b.com", joined_at: "2026-02-02" }).joinedAt).toBe("2026-02-02");
  });
});

describe("avgCompletionOf", () => {
  const base = {
    id: "t",
    title: "",
    description: "",
    departmentId: "d",
    progress: 100,
    assignedStaff: [],
  } as unknown as Task;

  it("returns an em dash when there are no completed tasks with timestamps", () => {
    expect(avgCompletionOf([])).toBe("—");
  });

  it("averages duration across completed tasks, in minutes", () => {
    const tasks: Task[] = [
      { ...base, status: "completed", startTime: "2026-01-01T00:00:00Z", endTime: "2026-01-01T00:10:00Z" },
      { ...base, status: "completed", startTime: "2026-01-01T00:00:00Z", endTime: "2026-01-01T00:20:00Z" },
    ];
    expect(avgCompletionOf(tasks)).toBe("15m");
  });

  it("ignores non-completed tasks", () => {
    const tasks: Task[] = [
      { ...base, status: "in-progress", startTime: "2026-01-01T00:00:00Z", endTime: "2026-01-01T00:10:00Z" },
    ];
    expect(avgCompletionOf(tasks)).toBe("—");
  });
});

describe("ownership helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("treats a missing stored user as 'guest'", () => {
    expect(getCurrentUserId()).toBe("guest");
  });

  it("returns the stored user's id for a regular member", () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u1", role: "member" }));
    expect(getCurrentUserId()).toBe("u1");
  });

  it("maps admin/system roles to the shared 'default' scope", () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u1", role: "admin" }));
    expect(getCurrentUserId()).toBe("default");
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u1", role: "system" }));
    expect(getCurrentUserId()).toBe("default");
  });

  it("canDeleteItem is true only when owner_id matches the current user", () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u1", role: "member" }));
    expect(canDeleteItem({ owner_id: "u1" })).toBe(true);
    expect(canDeleteItem({ owner_id: "u2" })).toBe(false);
  });

  it("items without an owner_id default to the shared 'default' owner", () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: "u1", role: "admin" }));
    expect(canDeleteItem({})).toBe(true);
  });
});
