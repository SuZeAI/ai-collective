import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { api, type Department, type Staff, type Project, type Epic, type Sprint } from "@/lib/api";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { useLanguage } from "@/contexts/LanguageContext";
import HierarchyFlow from "@/components/company/HierarchyFlow";

export default function CompanyHierarchy() {
  const { t: lang } = useLanguage();
  const scope = useCompanyScope();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scope.pending || !scope.company) return;
    const companyId = scope.company.id;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [d, s, p, allEpics, allSprints] = await Promise.all([
          api.listDepartments(companyId),
          api.listStaff(companyId),
          api.listProjects(companyId),
          api.listEpics(),
          api.listSprints(),
        ]);
        if (!active) return;
        const projectIds = new Set(p.map((proj) => proj.id));
        setDepartments(d);
        setStaffList(s);
        setProjects(p);
        setEpics(allEpics.filter((e) => projectIds.has(e.projectId)));
        setSprints(allSprints.filter((sp) => projectIds.has(sp.projectId)));
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [scope.pending, scope.company?.id]);

  const isEmpty = !loading && departments.length === 0 && projects.length === 0;

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <div className="px-6 py-5 border-b border-border/60 flex items-center gap-3 flex-shrink-0 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20">
          <Network className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">{lang.companyHierarchyPage.pageTitle}</h1>
          <p className="text-xs text-muted-foreground mt-1.5">{lang.companyHierarchyPage.pageSubtitle}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loading || scope.pending ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-muted border-t-violet-500 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500/10 to-indigo-600/10 border border-violet-500/20 mb-6">
              <Network className="w-9 h-9 text-violet-400/60" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">{lang.companyHierarchyPage.emptyTitle}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{lang.companyHierarchyPage.emptyDesc}</p>
          </div>
        ) : scope.company ? (
          <HierarchyFlow
            company={scope.company}
            departments={departments}
            staffList={staffList}
            projects={projects}
            epics={epics}
            sprints={sprints}
          />
        ) : null}
      </div>
    </div>
  );
}
