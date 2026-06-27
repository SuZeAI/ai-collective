import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Layout, Users, MessageSquare, CheckCircle2,
  BarChart3, Cpu, Play, Wrench, ChevronRight, BrainCircuit,
  LogOut, User, UserCircle, ChevronDown, Sparkles, Globe, ShieldCheck, Building, ShoppingBag, Plus, FolderOpen, Coins,
} from "lucide-react";
import { api, type Workspace } from "@/lib/api";
import { OVERALL_WORKSPACE_ID } from "@/hooks/use-workspace-scope";
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
  | "dashboard" | "analytics" | "tasks" | "conversations" | "officeBuilder" | "virtualOffice"
  | "teams" | "agents" | "skills" | "playground" | "workspaces" | "settings"
  | "monitoring" | "consumption" | "marketplace" | "documentLibrary";

type NavGroup = {
  groupKey: "overviewGroup" | "operationsGroup" | "orgGroup" | "officeGroup" | "devGroup" | "systemGroup" | "adminGroup";
  adminOnly?: boolean;
  items: { key: NavItemKey; url: string; icon: React.ElementType }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "overviewGroup",
    items: [
      { key: "dashboard", url: "/dashboard", icon: Layout },
      { key: "analytics", url: "/analytics", icon: BarChart3 },
      { key: "consumption", url: "/consumption", icon: Coins },
    ]
  },
  {
    groupKey: "orgGroup",
    items: [
      { key: "teams", url: "/teams", icon: Users },
      { key: "agents", url: "/agents", icon: Cpu },
      { key: "skills", url: "/skills", icon: Wrench },
    ]
  },
  {
    groupKey: "operationsGroup",
    items: [
      { key: "tasks", url: "/tasks", icon: CheckCircle2 },
      { key: "conversations", url: "/conversations", icon: MessageSquare },
    ]
  },
  {
    groupKey: "officeGroup",
    items: [
      { key: "officeBuilder", url: "/office-builder", icon: Sparkles },
      { key: "virtualOffice", url: "/virtual-office", icon: Building },
      { key: "documentLibrary", url: "/documents", icon: FolderOpen },
      { key: "marketplace", url: "/marketplace", icon: ShoppingBag },
    ]
  },
  {
    groupKey: "systemGroup",
    items: [
      { key: "playground", url: "/playground", icon: Play },
    ]
  },
  {
    groupKey: "adminGroup",
    adminOnly: true,
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
  const { user, logout, isGuest } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    let active = true;
    api.listWorkspaces()
      .then((data) => {
        if (!active) return;
        setWorkspaces(data);
        const storedId = localStorage.getItem("activeWorkspaceId");
        const found = data.find((ws) => ws.id === storedId);
        setActiveWorkspace(found || null);
        if (!found) localStorage.setItem("activeWorkspaceId", OVERALL_WORKSPACE_ID);
      })
      .catch((err) => console.error("Error listing workspaces in sidebar:", err));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleWorkspaceRefresh = () => {
      api.listWorkspaces()
        .then((data) => {
          setWorkspaces(data);
          const storedId = localStorage.getItem("activeWorkspaceId");
          const found = data.find((ws) => ws.id === storedId);
          setActiveWorkspace(found || null);
          if (!found) localStorage.setItem("activeWorkspaceId", OVERALL_WORKSPACE_ID);
        })
        .catch((err) => console.error("Error refreshing workspaces:", err));
    };

    window.addEventListener("workspaceChanged", handleWorkspaceRefresh);
    return () => window.removeEventListener("workspaceChanged", handleWorkspaceRefresh);
  }, []);

  const handleSelectWorkspace = (ws: Workspace | null) => {
    setActiveWorkspace(ws);
    localStorage.setItem("activeWorkspaceId", ws ? ws.id : OVERALL_WORKSPACE_ID);
    window.dispatchEvent(new CustomEvent("activeWorkspaceChanged", { detail: ws?.id ?? null }));
  };

  const isAdmin = user?.role === "admin" || user?.role === "system";
  const navGroups = NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin);

  const allNavItems = navGroups.flatMap((g) => g.items).map((item) => ({
    ...item,
    title: t.nav[item.key] as string,
  }));

  const currentPage = allNavItems.find((n) => n.url === location.pathname);
  const isFullBleed = location.pathname === "/tasks" || location.pathname === "/virtual-office";

  return (
    <SidebarProvider style={{ "--sidebar-width-icon": "4rem", "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="h-screen overflow-hidden flex w-full bg-transparent">
        <Sidebar collapsible="icon">
          <SidebarContent className="flex flex-row h-full bg-sidebar overflow-hidden p-0 gap-0">
            <div className="w-16 border-r border-sidebar-border/50 bg-sidebar/95 flex flex-col items-center py-4 justify-between shrink-0 h-full">
              <div className="flex flex-col items-center gap-4 w-full">
                <div 
                  onClick={() => navigate("/dashboard")}
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
                    onClick={() => handleSelectWorkspace(null)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group shrink-0",
                      !activeWorkspace
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
                  {workspaces.map((ws) => {
                    const isActive = activeWorkspace?.id === ws.id;
                    const initials = ws.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("");
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleSelectWorkspace(ws)}
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
                  <button
                    onClick={() => navigate("/workspaces")}
                    className="w-10 h-10 rounded-xl border border-dashed border-sidebar-border/70 flex items-center justify-center text-sidebar-foreground/45 hover:text-sidebar-foreground hover:border-sidebar-foreground/60 hover:bg-sidebar-accent/20 transition-all group relative shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <div className="absolute left-14 bg-popover text-popover-foreground border shadow-md px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0 pointer-events-none z-50">
                      {t.nav.manageWorkspaces}
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col h-full overflow-hidden group-data-[state=collapsed]:hidden bg-sidebar">
              <div className="px-4 py-4 border-b border-sidebar-border/40 shrink-0 bg-sidebar-accent/5 select-none">
                <div className="text-[9px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
                  {t.nav.workspaces}
                </div>
                <div className="font-bold text-[13px] text-sidebar-foreground truncate mt-1">
                  {activeWorkspace?.name || "Overall Collective"}
                </div>
                <div className="text-[10px] text-sidebar-foreground/45 truncate mt-0.5 leading-normal">
                  {activeWorkspace?.description || "All offices & shared resources"}
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
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground text-xs font-medium">AI Collective</span>
              {currentPage && (
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
                        {isGuest && (
                          <span className="text-[10px] text-amber-500 mt-0.5">{t.auth.guestMode}</span>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <UserCircle className="w-4 h-4 mr-2" />
                      {t.auth.profileBtn}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { logout(); navigate("/login"); }}
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
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn("h-full w-full", !isFullBleed && "p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto scrollbar-thin")}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
