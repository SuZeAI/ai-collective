import { useEffect, useMemo, useState } from "react";
import { api, type Company } from "@/lib/api";

// Sentinel stored in localStorage when "Overall" (all offices) is selected.
export const OVERALL_COMPANY_ID = "__overall__";

// Company id used to tag documents that belong to the shared "default" catalog
// (curated by admins in the "All" scope and offered in Recruiting), rather than
// to any single company. Documents are company-bound, so catalog docs need a
// stable home that isn't a real office.
export const CATALOG_COMPANY_ID = "__default__";

export function getActiveCompanyId(): string | null {
  try {
    const v = localStorage.getItem("activeCompanyId");
    return v && v !== OVERALL_COMPANY_ID ? v : null;
  } catch {
    return null;
  }
}

/**
 * Switch the active office (or Overall when `id` is null). Persists the choice
 * and broadcasts it so every `useCompanyScope()` consumer and the sidebar
 * re-resolve. Shared by the sidebar switcher and the Overview "Companies" grid.
 */
export function setActiveCompanyId(id: string | null): void {
  try {
    localStorage.setItem("activeCompanyId", id ?? OVERALL_COMPANY_ID);
  } catch {
    /* ignore storage failures */
  }
  window.dispatchEvent(new CustomEvent("activeCompanyChanged", { detail: id }));
}

export type CompanyScope = {
  /** true → "Overall": show everything across all offices (incl. unattached items). */
  isOverall: boolean;
  company: Company | null;
  /** Entity id sets belonging to the selected office (empty when isOverall). */
  departmentIds: Set<string>;
  staffIds: Set<string>;
  skillIds: Set<string>;
  /** false while the office membership is still being resolved. */
  ready: boolean;
  /**
   * true while an office is selected but its membership hasn't resolved yet
   * (`!isOverall && !ready`). Pages were each hand-rolling this exact
   * expression to gate their loading state so scoped filters don't flash
   * "0 items" before the real numbers land — use this instead of
   * reimplementing it.
   */
  pending: boolean;
};

// `pending` is derived (always `!isOverall && !ready`), so the internal
// state never stores it directly — that would let a setScope call forget to
// recompute it and silently drift out of sync. It's added once, in the
// return statement below.
type CompanyScopeState = Omit<CompanyScope, "pending">;

const OVERALL_SCOPE: CompanyScopeState = {
  isOverall: true,
  company: null,
  departmentIds: new Set(),
  staffIds: new Set(),
  skillIds: new Set(),
  ready: true,
};

/**
 * Resolve the active office (company) into entity-id sets so pages can show
 * only the departments/staff/skills that belong to it. Membership is derived
 * from the existing hierarchy: company.departmentIds → department.staff → staff.skill_ids.
 * Reacts to the sidebar switcher via the activeCompanyChanged/companyChanged events.
 */
export function useCompanyScope(): CompanyScope {
  const [companyId, setCompanyId] = useState<string | null>(getActiveCompanyId());
  const [rev, setRev] = useState(0); // bumped on membership changes so scope refetches even for the same office
  const [scope, setScope] = useState<CompanyScopeState>(
    companyId ? { ...OVERALL_SCOPE, isOverall: false, ready: false } : OVERALL_SCOPE,
  );

  useEffect(() => {
    const sync = () => {
      setCompanyId(getActiveCompanyId());
      setRev((v) => v + 1);
    };
    window.addEventListener("activeCompanyChanged", sync);
    window.addEventListener("companyChanged", sync);
    return () => {
      window.removeEventListener("activeCompanyChanged", sync);
      window.removeEventListener("companyChanged", sync);
    };
  }, []);

  useEffect(() => {
    if (!companyId) {
      setScope(OVERALL_SCOPE);
      return;
    }
    let active = true;
    setScope((prev) => ({ ...prev, isOverall: false, ready: false }));
    (async () => {
      try {
        const [ws, departments, staff] = await Promise.all([
          api.getCompany(companyId),
          api.listDepartments(),
          api.listStaff(),
        ]);
        if (!active) return;
        const departmentIds = new Set(ws.departmentIds);
        const staffIds = new Set(
          departments.filter((t) => departmentIds.has(t.id)).flatMap((t) => t.staff),
        );
        const skillIds = new Set(
          staff.filter((a) => staffIds.has(a.id)).flatMap((a) => a.skill_ids),
        );
        setScope({ isOverall: false, company: ws, departmentIds, staffIds, skillIds, ready: true });
      } catch (err) {
        console.error("Failed to resolve company scope:", err);
        // Office vanished (deleted elsewhere) — fall back to Overall.
        if (active) setScope(OVERALL_SCOPE);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId, rev]);

  return useMemo(
    () => ({ ...scope, pending: !scope.isOverall && !scope.ready }),
    [scope],
  );
}
