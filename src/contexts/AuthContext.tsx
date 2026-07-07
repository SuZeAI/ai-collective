import { createContext, useContext, useState, useCallback } from "react";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, getApiBase, parseErrorDetail } from "@/lib/api-base";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  joinedAt?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<AuthUser>) => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Guards against a stale/corrupted localStorage entry (e.g. left over from a
// backend field rename, or hand-edited) being trusted as a valid AuthUser
// everywhere useAuth() is read — only the required core fields are checked;
// optional fields are left to be `undefined` rather than validated.
function isValidAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const u = value as Record<string, unknown>;
  return typeof u.id === "string" && typeof u.name === "string" && typeof u.email === "string";
}

function loadPersistedAuth(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const raw = localStorage.getItem(AUTH_USER_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed !== null && !isValidAuthUser(parsed)) {
      // Corrupt/incompatible record — log out rather than trust a malformed
      // user object throughout the app.
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      return { user: null, token: null };
    }
    return { user: parsed, token };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const persisted = loadPersistedAuth();
  const [user, setUser] = useState<AuthUser | null>(persisted.user);
  const [token, setToken] = useState<string | null>(persisted.token);
  const [isLoading, setIsLoading] = useState(false);

  const persistAuth = useCallback((t: string | null, u: AuthUser) => {
    if (t) localStorage.setItem(AUTH_TOKEN_KEY, t);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authFetch<{ access_token: string; token_type: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      persistAuth(res.access_token, res.user);
    } finally {
      setIsLoading(false);
    }
  }, [persistAuth]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authFetch<{ access_token: string; token_type: string; user: AuthUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      persistAuth(res.access_token, res.user);
    } finally {
      setIsLoading(false);
    }
  }, [persistAuth]);

  const loginWithToken = useCallback(async (rawToken: string) => {
    setIsLoading(true);
    try {
      const base = getApiBase().replace(/\/$/, "");
      const res = await fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${rawToken}` },
      });
      if (!res.ok) throw new Error("Invalid token");
      const user: AuthUser = await res.json();
      persistAuth(rawToken, user);
    } finally {
      setIsLoading(false);
    }
  }, [persistAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithToken, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
