import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Layout, Users, MessageSquare, CheckCircle2,
  BarChart3, Cpu, Play, Wrench, ChevronRight, BrainCircuit, Settings2,
  LogOut, User, UserCircle, ChevronDown, Sparkles, Globe, ShieldCheck,
} from "lucide-react";
import { api, type Workspace } from "@/lib/api";
import { OVERALL_WORKSPACE_ID } from "@/hooks/use-workspace-scope";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarProvider, SidebarTrigger, Sidebar, SidebarContent,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItemKey =
  | "dashboard" | "analytics" | "tasks" | "conversations" | "officeBuilder"
  | "teams" | "agents" | "skills" | "playground" | "workspaces" | "settings"
  | "monitoring";

type NavGroup = {
  groupKey: "overviewGroup" | "operationsGroup" | "orgGroup" | "devGroup" | "systemGroup" | "adminGroup";
  adminOnly?: boolean;
  items: { key: NavItemKey; url: string; icon: React.ElementType }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "overviewGroup",
    items: [
      { key: "dashboard", url: "/dashboard", icon: Layout },
      { key: "analytics", url: "/analytics", icon: BarChart3 },
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
    groupKey: "orgGroup",
    items: [
      { key: "officeBuilder", url: "/office-builder", icon: Sparkles },
      { key: "teams", url: "/teams", icon: Users },
      { key: "agents", url: "/agents", icon: Cpu },
      { key: "skills", url: "/skills", icon: Wrench },
    ]
  },
  {
    groupKey: "devGroup",
    items: [
      { key: "playground", url: "/playground", icon: Play },
      { key: "workspaces", url: "/workspaces", icon: BrainCircuit },
    ]
  },
  {
    groupKey: "systemGroup",
    items: [
      { key: "settings", url: "/settings", icon: Settings2 },
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
        // Default is "Overall" (all offices); only restore a stored real office.
        const storedId = localStorage.getItem("activeWorkspaceId");
        const found = data.find((ws) => ws.id === storedId);
        setActiveWorkspace(found || null);
        if (!found) localStorage.setItem("activeWorkspaceId", OVERALL_WORKSPACE_ID);
      })
      .catch((err) => console.error("Error listing workspaces in sidebar:", err));
    return () => { active = false; };
  }, []);

  // Listen to external workspace creations/deletes/updates to refresh dropdown list
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

  // null → "Overall" (all offices, including items not attached to any office).
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
  const isFullBleed = location.pathname === "/tasks";

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full bg-transparent">
        <Sidebar collapsible="icon">
          <SidebarContent className="flex flex-col h-full bg-sidebar">
            {/* Brand & Workspace Switcher dropdown */}
            <div className="px-3 py-3 border-b border-sidebar-border flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 w-full text-left rounded-lg p-1.5 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none select-none">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-bold shadow-md shadow-teal-500/10 text-sm">
                      {activeWorkspace ? (activeWorkspace.avatar || activeWorkspace.name?.[0] || "A") : <Globe className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="block font-semibold text-[13px] text-sidebar-foreground truncate">
                        {activeWorkspace?.name || "Overall"}
                      </span>
                      <span className="block text-[10px] text-sidebar-foreground/45 truncate mt-0.5">
                        {activeWorkspace?.description || "All offices & shared items"}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0 group-data-[collapsible=icon]:hidden" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 align-start" side="bottom" align="start">
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Offices & Workspaces
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleSelectWorkspace(null)}
                    className={cn(
                      "flex items-center gap-2 text-xs py-2 cursor-pointer",
                      !activeWorkspace ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <div className="w-5 h-5 rounded-md flex items-center justify-center bg-gradient-to-br from-slate-500 to-zinc-600 text-white shrink-0">
                      <Globe className="w-3 h-3" />
                    </div>
                    <span className="truncate flex-1">Overall — all offices</span>
                    {!activeWorkspace && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                  </DropdownMenuItem>
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleSelectWorkspace(ws)}
                      className={cn(
                        "flex items-center gap-2 text-xs py-2 cursor-pointer",
                        activeWorkspace?.id === ws.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-bold text-[10px] shrink-0">
                        {ws.avatar || ws.name[0]}
                      </div>
                      <span className="truncate flex-1">{ws.name}</span>
                      {activeWorkspace?.id === ws.id && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                    </DropdownMenuItem>
                  ))}
                  {workspaces.length === 0 && (
                    <div className="p-2 text-center text-[11px] text-muted-foreground">
                      No offices found
                    </div>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/workspaces")} className="text-xs text-primary font-medium cursor-pointer">
                    <BrainCircuit className="w-3.5 h-3.5 mr-2 text-teal-400" />
                    {t.nav.manageWorkspaces}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Navigation groups */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {navGroups.map((group) => (
                <SidebarGroup key={group.groupKey} className="py-0">
                  <SidebarGroupLabel className="text-sidebar-foreground/30 text-[10px] font-bold uppercase tracking-widest px-3 mb-1 group-data-[collapsible=icon]:hidden">
                    {t.nav[group.groupKey]}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-px">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        const title = t.nav[item.key];
                        return (
                          <SidebarMenuItem key={item.key}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className={cn(
                                "h-9 rounded-md transition-all duration-150 group/item",
                              )}
                            >
                              <Link to={item.url} className="flex items-center gap-2.5 px-2">
                                <span
                                  className={cn(
                                    "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-150",
                                    isActive
                                      ? "text-sidebar-primary-foreground bg-sidebar-primary shadow-sm"
                                      : "text-sidebar-foreground/50 group-hover/item:text-sidebar-foreground",
                                  )}
                                >
                                  <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
                                </span>
                                <span className={cn(
                                  "text-[13px] group-data-[collapsible=icon]:hidden transition-colors",
                                  isActive
                                    ? "font-semibold text-sidebar-foreground"
                                    : "font-medium text-sidebar-foreground/60 group-hover/item:text-sidebar-foreground/80",
                                )}>
                                  {title}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </div>

            {/* Sidebar footer */}
            <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0 group-data-[collapsible=icon]:px-2">
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sidebar-foreground/40 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sidebar-foreground/40" />
                </span>
                <span className="text-[11px] text-sidebar-foreground/35 font-mono group-data-[collapsible=icon]:hidden">
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
