import { createContext, useContext, useState, useCallback } from "react";

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
  loginAsGuest: () => void;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<AuthUser>) => void;
  isLoading: boolean;
  isGuest: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ai-collective-token";
const USER_KEY = "ai-collective-user";
const GUEST_KEY = "ai-collective-guest";

function getApiBase(): string {
  // Same-origin relative default: requests flow through the nginx proxy to the
  // backend (port 8000 is not published to the host). See src/lib/api.ts.
  return ((import.meta as any).env?.VITE_API_BASE_URL as string) || "/api/v1";
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function loadPersistedAuth(): { user: AuthUser | null; token: string | null; isGuest: boolean } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    const isGuest = localStorage.getItem(GUEST_KEY) === "1";
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    return { user, token, isGuest };
  } catch {
    return { user: null, token: null, isGuest: false };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const persisted = loadPersistedAuth();
  const [user, setUser] = useState<AuthUser | null>(persisted.user);
  const [token, setToken] = useState<string | null>(persisted.token);
  const [isGuest, setIsGuest] = useState(persisted.isGuest);
  const [isLoading, setIsLoading] = useState(false);

  const persistAuth = (t: string | null, u: AuthUser, guest = false) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    if (guest) localStorage.setItem(GUEST_KEY, "1");
    else localStorage.removeItem(GUEST_KEY);
    setToken(t);
    setUser(u);
    setIsGuest(guest);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authFetch<{ access_token: string; token_type: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      persistAuth(res.access_token, res.user, false);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authFetch<{ access_token: string; token_type: string; user: AuthUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      persistAuth(res.access_token, res.user, false);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithToken = useCallback(async (rawToken: string) => {
    setIsLoading(true);
    try {
      const base = getApiBase().replace(/\/$/, "");
      const res = await fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${rawToken}` },
      });
      if (!res.ok) throw new Error("Invalid token");
      const user: AuthUser = await res.json();
      persistAuth(rawToken, user, false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAsGuest = useCallback(() => {
    const guestUser: AuthUser = {
      id: "guest",
      name: "Guest",
      email: "guest@local",
      role: "Guest",
      joinedAt: new Date().toISOString(),
    };
    persistAuth(null, guestUser, true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(GUEST_KEY);
    setToken(null);
    setUser(null);
    setIsGuest(false);
  }, []);

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginAsGuest, loginWithToken, logout, updateUser, isLoading, isGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
