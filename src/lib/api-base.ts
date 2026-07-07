// Shared by src/lib/api.ts and src/contexts/AuthContext.tsx. Kept dependency-free
// (no imports from api.ts or React) so both can import it without a cycle.

/** localStorage keys for the persisted auth session. */
export const AUTH_TOKEN_KEY = "ai-collective-token";
export const AUTH_USER_KEY = "ai-collective-user";

export function getApiBase(): string {
  // Default to a same-origin relative path so requests flow through the nginx
  // reverse proxy (http://localhost:2026 → /api/v1/ → backend). The backend's
  // port 8000 is not published to the host in the dev/prod compose setups, so
  // an absolute http://localhost:8000 base would fail with ERR_CONNECTION_REFUSED.
  // Override with VITE_API_BASE_URL when the API lives on a different origin.
  return ((import.meta as any).env?.VITE_API_BASE_URL as string) || "/api/v1";
}

/** Extract a human-readable error message from a failed fetch Response. */
export async function parseErrorDetail(res: Response): Promise<string> {
  let detail = `${res.status} ${res.statusText}`;
  try {
    const data = await res.json();
    if (data?.detail) detail = String(data.detail);
  } catch {
    // body wasn't JSON (or was empty) — keep the status-line fallback
  }
  return detail;
}
