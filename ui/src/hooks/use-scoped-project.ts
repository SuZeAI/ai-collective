import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Project } from "@/lib/api";
import { useCompanyScope } from "@/hooks/use-company-scope";

type ProjectScoped = { projectId?: string | null };

/**
 * Resolves the Project matching `projectKey` in the active company scope and
 * loads whatever related entity lists `fetchRelated` returns, filtered down
 * to that project's id. Centralizes the load/cancel-guard/loading plumbing
 * that per-project pages (Backlog, Roadmap, Reports) otherwise repeat
 * identically.
 */
export function useScopedProject<T extends Record<string, ProjectScoped[]>>(
  projectKey: string,
  fetchRelated: () => Promise<T>,
): { project: Project | undefined; data: T; loading: boolean; reload: () => Promise<void> } {
  const scope = useCompanyScope();
  const [project, setProject] = useState<Project | undefined>();
  const [data, setData] = useState<T>({} as T);
  const [loading, setLoading] = useState(true);

  // Guards against a stale in-flight load (e.g. the user navigated to a
  // different project, or the component unmounted) overwriting state with
  // results for the wrong project.
  const projectKeyRef = useRef(projectKey);
  projectKeyRef.current = projectKey;
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Ref (not a dep) so callers can pass an inline fetchRelated without
  // retriggering the effect on every render.
  const fetchRelatedRef = useRef(fetchRelated);
  fetchRelatedRef.current = fetchRelated;

  const load = useCallback(async () => {
    if (scope.pending) return;
    const requestedKey = projectKey;
    try {
      const [projects, related] = await Promise.all([
        api.listProjects(scope.isOverall ? undefined : scope.company?.id),
        fetchRelatedRef.current(),
      ]);
      if (!mountedRef.current || projectKeyRef.current !== requestedKey) return;
      const proj = projects.find((p) => p.key === requestedKey);
      const filtered = Object.fromEntries(
        Object.entries(related).map(([key, items]) => [key, items.filter((item) => item.projectId === proj?.id)]),
      ) as T;
      setProject(proj);
      setData(filtered);
    } catch (e) {
      if (mountedRef.current && projectKeyRef.current === requestedKey) console.error(e);
    } finally {
      if (mountedRef.current && projectKeyRef.current === requestedKey) setLoading(false);
    }
  }, [projectKey, scope.pending, scope.isOverall, scope.company?.id]);

  useEffect(() => { void load(); }, [load]);

  return { project, data, loading, reload: load };
}
