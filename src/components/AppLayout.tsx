import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Layout, Users, MessageSquare, CheckCircle2,
  BarChart3, Cpu, Play, Wrench, ChevronRight, BrainCircuit, Settings2,
  LogOut, User, UserCircle,
} from "lucide-react";
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

const NAV_CONFIG = [
  { key: "dashboard" as const, url: "/dashboard", icon: Layout },
  { key: "agents" as const, url: "/agents", icon: Cpu },
  { key: "skills" as const, url: "/skills", icon: Wrench },
  { key: "teams" as const, url: "/teams", icon: Users },
  { key: "tasks" as const, url: "/tasks", icon: CheckCircle2 },
  { key: "conversations" as const, url: "/conversations", icon: MessageSquare },
  { key: "analytics" as const, url: "/analytics", icon: BarChart3 },
  { key: "playground" as const, url: "/playground", icon: Play },
  { key: "workspaces" as const, url: "/workspaces", icon: BrainCircuit },
  { key: "settings" as const, url: "/settings", icon: Settings2 },
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

  const navItems = NAV_CONFIG.map((item) => ({
    ...item,
    title: t.nav[item.key] as string,
  }));

  const currentPage = navItems.find((n) => n.url === location.pathname);

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full bg-transparent">
        <Sidebar collapsible="icon">
          <SidebarContent className="flex flex-col h-full">
            {/* Brand */}
            <div className="px-3 py-3.5 flex items-center gap-2.5 border-b border-sidebar-border flex-shrink-0">
              <Link to="/" className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 bg-sidebar-foreground/8 border border-sidebar-border p-1">
                  <img
                    src="/spider.png"
                    alt="AI Collective"
                    className="w-full h-full object-contain opacity-90"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="group-data-[collapsible=icon]:hidden min-w-0">
                  <span className="block font-serif text-[15px] font-medium tracking-tight text-sidebar-foreground leading-none">
                    AI Collective
                  </span>
                  <span className="block text-[10px] text-sidebar-foreground/40 font-medium mt-0.5 uppercase tracking-wider">
                    {t.brand.subtitle}
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <SidebarGroup className="flex-1 overflow-y-auto py-2">
              <SidebarGroupLabel className="text-sidebar-foreground/30 text-[10px] font-semibold uppercase tracking-widest px-3 mb-1">
                {t.nav.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
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
                                  ? "text-sidebar-primary-foreground bg-sidebar-primary"
                                  : "text-sidebar-foreground/50",
                              )}
                            >
                              <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
                            </span>
                            <span className={cn(
                              "text-sm group-data-[collapsible=icon]:hidden",
                              isActive ? "font-semibold text-sidebar-foreground" : "font-medium text-sidebar-foreground/60",
                            )}>
                              {item.title}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

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
          <main className="flex-1 min-h-0 overflow-auto scrollbar-thin bg-background">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="p-6 md:p-8 max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
