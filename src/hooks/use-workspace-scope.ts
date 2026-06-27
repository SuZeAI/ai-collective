import { useEffect, useState } from "react";
import { api, type Workspace } from "@/lib/api";

// Sentinel stored in localStorage when "Overall" (all offices) is selected.
export const OVERALL_WORKSPACE_ID = "__overall__";

// Workspace id used to tag documents that belong to the shared "default" catalog
// (curated by admins in the "All" scope and offered in Recruiting), rather than
// to any single company. Documents are workspace-bound, so catalog docs need a
// stable home that isn't a real office.
export const CATALOG_WORKSPACE_ID = "__default__";

export function getActiveWorkspaceId(): string | null {
  try {
    const v = localStorage.getItem("activeWorkspaceId");
    return v && v !== OVERALL_WORKSPACE_ID ? v : null;
  } catch {
    return null;
  }
}

/**
 * Switch the active office (or Overall when `id` is null). Persists the choice
 * and broadcasts it so every `useWorkspaceScope()` consumer and the sidebar
 * re-resolve. Shared by the sidebar switcher and the Overview "Companies" grid.
 */
export function setActiveWorkspaceId(id: string | null): void {
  try {
    localStorage.setItem("activeWorkspaceId", id ?? OVERALL_WORKSPACE_ID);
  } catch {
    /* ignore storage failures */
  }
  window.dispatchEvent(new CustomEvent("activeWorkspaceChanged", { detail: id }));
}

export type WorkspaceScope = {
  /** true → "Overall": show everything across all offices (incl. unattached items). */
  isOverall: boolean;
  workspace: Workspace | null;
  /** Entity id sets belonging to the selected office (empty when isOverall). */
  teamIds: Set<string>;
  agentIds: Set<string>;
  skillIds: Set<string>;
  /** false while the office membership is still being resolved. */
  ready: boolean;
};

const OVERALL_SCOPE: WorkspaceScope = {
  isOverall: true,
  workspace: null,
  teamIds: new Set(),
  agentIds: new Set(),
  skillIds: new Set(),
  ready: true,
};

/**
 * Resolve the active office (workspace) into entity-id sets so pages can show
 * only the departments/humans/skills that belong to it. Membership is derived
 * from the existing hierarchy: workspace.teamIds → team.agents → agent.skill_ids.
 * Reacts to the sidebar switcher via the activeWorkspaceChanged/workspaceChanged events.
 */
export function useWorkspaceScope(): WorkspaceScope {
  const [workspaceId, setWorkspaceId] = useState<string | null>(getActiveWorkspaceId());
  const [rev, setRev] = useState(0); // bumped on membership changes so scope refetches even for the same office
  const [scope, setScope] = useState<WorkspaceScope>(
    workspaceId ? { ...OVERALL_SCOPE, isOverall: false, ready: false } : OVERALL_SCOPE,
  );

  useEffect(() => {
    const sync = () => {
      setWorkspaceId(getActiveWorkspaceId());
      setRev((v) => v + 1);
    };
    window.addEventListener("activeWorkspaceChanged", sync);
    window.addEventListener("workspaceChanged", sync);
    return () => {
      window.removeEventListener("activeWorkspaceChanged", sync);
      window.removeEventListener("workspaceChanged", sync);
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setScope(OVERALL_SCOPE);
      return;
    }
    let active = true;
    setScope((prev) => ({ ...prev, isOverall: false, ready: false }));
    (async () => {
      try {
        const [ws, teams, agents] = await Promise.all([
          api.getWorkspace(workspaceId),
          api.listTeams(),
          api.listAgents(),
        ]);
        if (!active) return;
        const teamIds = new Set(ws.teamIds);
        const agentIds = new Set(
          teams.filter((t) => teamIds.has(t.id)).flatMap((t) => t.agents),
        );
        const skillIds = new Set(
          agents.filter((a) => agentIds.has(a.id)).flatMap((a) => a.skill_ids),
        );
        setScope({ isOverall: false, workspace: ws, teamIds, agentIds, skillIds, ready: true });
      } catch (err) {
        console.error("Failed to resolve workspace scope:", err);
        // Office vanished (deleted elsewhere) — fall back to Overall.
        if (active) setScope(OVERALL_SCOPE);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId, rev]);

  return scope;
}
