import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layout, Users, MessageSquare, CheckCircle2,
  BarChart3, Cpu, Play, Wrench, ChevronRight, BrainCircuit,
  LogOut, User, UserCircle, ChevronDown, Sparkles, Globe, ShieldCheck, Building, Building2, ShoppingBag, Plus, FolderOpen, Coins, FolderKanban, Star, Plug,
} from "lucide-react";
import { api, type Company } from "@/lib/api";
import { OVERALL_COMPANY_ID, setActiveCompanyId, getActiveCompanyId, useCompanyScope } from "@/hooks/use-company-scope";
import { COMPANY_TYPE_MAP, companyTypeOf, suggestedNavKeys } from "@/lib/company-types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarProvider, SidebarTrigger, Sidebar, SidebarContent,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItemKey =
  | "dashboard" | "analytics" | "tasks" | "projects" | "meetings" | "officeBuilder" | "virtualOffice"
  | "departments" | "staff" | "skills" | "playground" | "companies" | "settings"
  | "monitoring" | "consumption" | "recruiting" | "documentLibrary" | "platform";

type NavGroup = {
  groupKey: "overviewGroup" | "companiesGroup" | "catalogGroup" | "operationsGroup" | "orgGroup" | "officeGroup" | "devGroup" | "systemGroup" | "integrationsGroup" | "adminGroup";
  adminOnly?: boolean;
  // Where the group appears: "overall" = only the All scope (company create/
  // control), "company" = only inside a selected company, "both" = everywhere.
  visibleIn: "overall" | "company" | "both";
  items: { key: NavItemKey; url: string; icon: React.ElementType }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "overviewGroup",
    visibleIn: "both",
    items: [
      { key: "dashboard", url: "/dashboard", icon: Layout },
      { key: "analytics", url: "/analytics", icon: BarChart3 },
      { key: "consumption", url: "/consumption", icon: Coins },
    ]
  },
  {
    // All-scope only: the company control center — create (AI) + manage.
    // Hidden for admins (admins curate the shared catalog instead, below).
    groupKey: "companiesGroup",
    visibleIn: "overall",
    items: [
      { key: "officeBuilder", url: "/office-builder", icon: Sparkles },
      { key: "companies", url: "/companies", icon: Building2 },
    ]
  },
  {
    // Admin-only, All-scope: the shared "default" catalog admins curate. These
    // feed Recruiting (Recruiting) for every company to copy from.
    groupKey: "catalogGroup",
    adminOnly: true,
    visibleIn: "overall",
    items: [
      { key: "departments", url: "/departments", icon: Users },
      { key: "staff", url: "/staff", icon: Cpu },
      { key: "skills", url: "/skills", icon: Wrench },
      { key: "documentLibrary", url: "/documents", icon: FolderOpen },
    ]
  },
  {
    groupKey: "orgGroup",
    visibleIn: "company",
    items: [
      { key: "departments", url: "/departments", icon: Users },
      { key: "staff", url: "/staff", icon: Cpu },
      { key: "skills", url: "/skills", icon: Wrench },
    ]
  },
  {
    groupKey: "operationsGroup",
    visibleIn: "company",
    items: [
      { key: "projects", url: "/projects", icon: FolderKanban },
      { key: "tasks", url: "/tasks", icon: CheckCircle2 },
      { key: "meetings", url: "/meetings", icon: MessageSquare },
    ]
  },
  {
    groupKey: "officeGroup",
    visibleIn: "company",
    items: [
      { key: "virtualOffice", url: "/virtual-office", icon: Building },
      { key: "documentLibrary", url: "/documents", icon: FolderOpen },
      { key: "recruiting", url: "/recruiting", icon: ShoppingBag },
    ]
  },
  {
    groupKey: "integrationsGroup",
    visibleIn: "company",
    items: [
      { key: "platform", url: "/platform", icon: Plug },
    ]
  },
  {
    groupKey: "systemGroup",
    visibleIn: "company",
    items: [
      { key: "playground", url: "/playground", icon: Play },
    ]
  },
  {
    groupKey: "adminGroup",
    adminOnly: true,
    visibleIn: "both",
    items: [
      { key: "monitoring", url: "/admin/monitoring", icon: ShieldCheck },
    ]
  }
];

function UserAvatarButton({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-8 h-8 rounded-full object-cover select-none"
      />
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-bold select-none">
      {initials || <User className="w-4 h-4" />}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const scope = useCompanyScope();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  // Selected office id, known synchronously from localStorage (unlike
  // `activeCompany`, which needs the `listCompanies` fetch to resolve). Every
  // route wraps its own <AppLayout>, so this component remounts on each
  // navigation — driving the rail highlight off this instead of `activeCompany`
  // avoids a frame where the "All" button flashes active while that fetch is in flight.
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => getActiveCompanyId());
  // Mirror of `companies` for event handlers that must read the latest list
  // without re-subscribing (their effect runs once with [] deps).
  const companiesRef = useRef<Company[]>([]);
  useEffect(() => { companiesRef.current = companies; }, [companies]);

  useEffect(() => {
    let active = true;
    api.listCompanies()
      .then((data) => {
        if (!active) return;
        setCompanies(data);
        const storedId = localStorage.getItem("activeCompanyId");
        const found = data.find((ws) => ws.id === storedId);
        setActiveCompany(found || null);
        if (!found) {
          localStorage.setItem("activeCompanyId", OVERALL_COMPANY_ID);
          setSelectedCompanyId(null);
        }
      })
      .catch((err) => console.error("Error listing companies in sidebar:", err));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // "companyChanged" → the office list itself changed (created/edited/deleted):
    // refetch the list and re-sync the active office from storage.
    const handleListRefresh = () => {
      api.listCompanies()
        .then((data) => {
          setCompanies(data);
          const storedId = localStorage.getItem("activeCompanyId");
          const found = data.find((ws) => ws.id === storedId);
          setActiveCompany(found || null);
          if (!found) {
            localStorage.setItem("activeCompanyId", OVERALL_COMPANY_ID);
            setSelectedCompanyId(null);
          }
        })
        .catch((err) => console.error("Error refreshing companies:", err));
    };

    // "activeCompanyChanged" → only the selection switched (sidebar click,
    // Overview grid). Resolve it from the in-memory list — no refetch, so the
    // rail doesn't flicker (the old code refetched here, briefly resolving to
    // null and flashing the "All" button). Only refetch when the id is unknown
    // (e.g. an office just created elsewhere).
    const handleActiveChange = () => {
      const storedId = getActiveCompanyId(); // null when "All"/Overall
      setSelectedCompanyId(storedId);
      if (!storedId) { setActiveCompany(null); return; }
      const known = companiesRef.current.find((ws) => ws.id === storedId);
      if (known) setActiveCompany(known);
      else handleListRefresh();
    };

    window.addEventListener("companyChanged", handleListRefresh);
    window.addEventListener("activeCompanyChanged", handleActiveChange);
    return () => {
      window.removeEventListener("companyChanged", handleListRefresh);
      window.removeEventListener("activeCompanyChanged", handleActiveChange);
    };
  }, []);

  const handleSelectCompany = (ws: Company | null) => {
    setActiveCompany(ws);
    setSelectedCompanyId(ws ? ws.id : null);
    setActiveCompanyId(ws ? ws.id : null);
  };

  const isAdmin = user?.role === "admin" || user?.role === "system";
  // "All" scope = company create/control/monitor; inside a company = that
  // company's operations. Groups declare where they belong via `visibleIn`.
  const isOverall = !selectedCompanyId;
  const navGroups = useMemo(
    () =>
      NAV_GROUPS.filter(
        (group) =>
          (!group.adminOnly || isAdmin) &&
          (group.visibleIn === "both" || group.visibleIn === (isOverall ? "overall" : "company")) &&
          // Admins in the "All" scope don't create/control companies — their All
          // view is the shared catalog (catalogGroup) + System Monitoring only.
          !(isOverall && isAdmin && (group.groupKey === "overviewGroup" || group.groupKey === "companiesGroup")),
      ),
    [isAdmin, isOverall],
  );
  // Flexible company-type rule: inside a company, mark (never hide) the options
  // best suited to its type with a "suggested" star.
  const companyType = companyTypeOf(activeCompany);
  const suggestedKeys = useMemo(
    () => (isOverall ? new Set<string>() : suggestedNavKeys(companyType)),
    [isOverall, companyType],
  );
  const typeDef = COMPANY_TYPE_MAP[companyType];

  const allNavItems = useMemo(
    () =>
      navGroups.flatMap((g) => g.items).map((item) => ({
        ...item,
        title: t.nav[item.key] as string,
      })),
    [navGroups, t],
  );

  const currentPage = useMemo(
    () => allNavItems.find((n) => n.url === location.pathname),
    [allNavItems, location.pathname],
  );
  const isFullBleed = location.pathname === "/tasks" || location.pathname === "/virtual-office";
  const isFullWidth = isFullBleed || location.pathname === "/dashboard";

  // Inside a project (board/backlog/roadmap/reports) the header breadcrumb
  // drops down a level: "AI Collective > Projects > <project name>", with
  // "Projects" linking back to the list — instead of the flat 2-level form
  // `currentPage` gives every other page (it only exact-matches nav URLs, so
  // it can't see the :key param here).
  const projectKeyParam = location.pathname.match(/^\/projects\/([^/]+)\/(?:board|backlog|roadmap|reports)$/)?.[1];
  const { data: breadcrumbProjects = [] } = useQuery({
    queryKey: ["breadcrumb-projects", scope.isOverall, scope.company?.id ?? null],
    queryFn: () => api.listProjects(scope.isOverall ? undefined : scope.company?.id),
    enabled: !!projectKeyParam,
  });
  const breadcrumbProject = projectKeyParam ? breadcrumbProjects.find((p) => p.key === projectKeyParam) : undefined;

  return (
    <SidebarProvider style={{ "--sidebar-width-icon": "4rem", "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="h-screen overflow-hidden flex w-full bg-transparent">
        <Sidebar collapsible="icon">
          <SidebarContent className="flex flex-row h-full bg-sidebar overflow-hidden p-0 gap-0">
            <div className="w-16 border-r border-sidebar-border/50 bg-sidebar/95 flex flex-col items-center py-4 justify-between shrink-0 h-full">
              <div className="flex flex-col items-center gap-4 w-full">
                <div
                  onClick={() => navigate("/")}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-500/20 select-none cursor-pointer hover:scale-105 transition-transform"
                >
                  <Building className="w-5 h-5 text-white" />
                </div>
                <div className="w-8 h-px bg-sidebar-border/40 my-1 shrink-0" />
                <div 
                  className="flex flex-col gap-2.5 w-full items-center max-h-[calc(100vh-220px)] overflow-y-auto [&::-webkit-scrollbar]:hidden py-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  <button
                    onClick={() => handleSelectCompany(null)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group shrink-0",
                      !selectedCompanyId
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-[8px] font-bold px-1 rounded-full border border-background scale-90">
                      All
                    </span>
                    <div className="absolute left-14 bg-popover text-popover-foreground border shadow-md px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0 pointer-events-none z-50">
                      Overall Collective
                    </div>
                  </button>
                  {companies.map((ws) => {
                    const isActive = selectedCompanyId === ws.id;
                    const initials = ws.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("");
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleSelectCompany(ws)}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-[11px] transition-all relative group shrink-0",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                            : "bg-sidebar-accent/30 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                        )}
                      >
                        {ws.avatar ? (
                          <span className="text-sm select-none">{ws.avatar}</span>
                        ) : (
                          <span className="tracking-tight select-none">{initials || ws.name[0]?.toUpperCase()}</span>
                        )}
                        <div className="absolute left-14 bg-popover text-popover-foreground border shadow-md px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0 pointer-events-none z-50">
                          {ws.name}
                        </div>
                      </button>
                    );
                  })}
                  {/* Company creation is a non-admin action; admins curate the
                      shared catalog instead and don't create companies. */}
                  {!isAdmin && (
                    <button
                      onClick={() => navigate("/companies")}
                      className="w-10 h-10 rounded-xl border border-dashed border-sidebar-border/70 flex items-center justify-center text-sidebar-foreground/45 hover:text-sidebar-foreground hover:border-sidebar-foreground/60 hover:bg-sidebar-accent/20 transition-all group relative shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <div className="absolute left-14 bg-popover text-popover-foreground border shadow-md px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0 pointer-events-none z-50">
                        {t.nav.manageCompanies}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col h-full overflow-hidden group-data-[state=collapsed]:hidden bg-sidebar">
              <div className="px-4 py-4 border-b border-sidebar-border/40 shrink-0 bg-sidebar-accent/5 select-none">
                <div className="text-[9px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
                  {t.nav.companies}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-bold text-[13px] text-sidebar-foreground truncate">
                    {activeCompany?.name || (selectedCompanyId ? "" : "Overall Collective")}
                  </span>
                  {isOverall ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-500/15 text-teal-500 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-teal-500/25">
                      <Globe className="w-2.5 h-2.5" />
                      {t.nav.monitoringBadge}
                    </span>
                  ) : (
                    <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border", typeDef.accent)}>
                      <typeDef.icon className="w-2.5 h-2.5" />
                      {t.companyTypes[companyType]}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-sidebar-foreground/45 truncate mt-0.5 leading-normal">
                  {activeCompany?.description || (selectedCompanyId ? "" : "All offices & shared resources")}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-4 space-y-4 px-2.5">
                {navGroups.map((group) => (
                  <div key={group.groupKey} className="space-y-1">
                    <div className="text-[9px] font-bold text-sidebar-foreground/35 uppercase tracking-widest px-2 mb-1.5 select-none">
                      {t.nav[group.groupKey]}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        const title = t.nav[item.key];
                        const suggested = suggestedKeys.has(item.key);
                        return (
                          <Link
                            key={item.key}
                            to={item.url}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all group/item font-semibold",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border/20"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                isActive
                                  ? "text-sidebar-accent-foreground"
                                  : "text-sidebar-foreground/40 group-hover/item:text-sidebar-foreground/70"
                              )}
                            />
                            <span className="truncate">{title}</span>
                            {suggested && (
                              <span className="ml-auto shrink-0" title={t.nav.suggestedBadge}>
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-sidebar-border/40 shrink-0 bg-sidebar-accent/5 flex items-center gap-2 select-none">
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-sidebar-foreground/45 font-semibold">
                  {t.status.allSystemsOnline}
                </span>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-background gap-3 flex-shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors h-8 w-8" />
            <div className="h-3.5 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-muted-foreground text-xs font-medium shrink-0">AI Collective</span>
              {projectKeyParam ? (
                <>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  <Link to="/projects" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {t.nav.projects}
                  </Link>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {breadcrumbProject?.name ?? projectKeyParam}
                  </span>
                </>
              ) : currentPage && (
                <>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-xs font-semibold text-foreground">{currentPage.title}</span>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="ml-1 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity hover:opacity-80">
                      <UserAvatarButton name={user.name} src={user.avatar || undefined} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm truncate">{user.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <UserCircle className="w-4 h-4 mr-2" />
                      {t.auth.profileBtn}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { logout(); queryClient.clear(); navigate("/login"); }}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      {t.auth.logoutBtn}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-hidden bg-background">
            <div
              key={location.pathname}
              className={cn(
                "h-full w-full animate-in fade-in-0 duration-150 ease-out",
                !isFullBleed && "p-6 md:p-8 overflow-y-auto scrollbar-thin",
                !isFullWidth && "max-w-7xl mx-auto",
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
