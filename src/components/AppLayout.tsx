import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Layout, Users, MessageSquare, CheckCircle2,
  BarChart3, Cpu, Play, Wrench, ChevronRight, BrainCircuit,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SidebarProvider, SidebarTrigger, Sidebar, SidebarContent,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_CONFIG = [
  { key: "dashboard" as const, url: "/dashboard", icon: Layout, iconText: "text-sky-300", iconSurface: "bg-sky-500/15", iconActive: "from-sky-500 to-blue-600" },
  { key: "agents" as const, url: "/agents", icon: Cpu, iconText: "text-emerald-300", iconSurface: "bg-emerald-500/15", iconActive: "from-emerald-500 to-teal-600" },
  { key: "skills" as const, url: "/skills", icon: Wrench, iconText: "text-amber-300", iconSurface: "bg-amber-500/15", iconActive: "from-amber-500 to-orange-500" },
  { key: "teams" as const, url: "/teams", icon: Users, iconText: "text-violet-300", iconSurface: "bg-violet-500/15", iconActive: "from-indigo-500 to-violet-600" },
  { key: "tasks" as const, url: "/tasks", icon: CheckCircle2, iconText: "text-lime-300", iconSurface: "bg-lime-500/15", iconActive: "from-lime-500 to-emerald-600" },
  { key: "conversations" as const, url: "/conversations", icon: MessageSquare, iconText: "text-cyan-300", iconSurface: "bg-cyan-500/15", iconActive: "from-cyan-500 to-sky-600" },
  { key: "analytics" as const, url: "/analytics", icon: BarChart3, iconText: "text-fuchsia-300", iconSurface: "bg-fuchsia-500/15", iconActive: "from-fuchsia-500 to-pink-600" },
  { key: "playground" as const, url: "/playground", icon: Play, iconText: "text-rose-300", iconSurface: "bg-rose-500/15", iconActive: "from-rose-500 to-red-600" },
  { key: "workspaces" as const, url: "/workspaces", icon: BrainCircuit, iconText: "text-teal-300", iconSurface: "bg-teal-500/15", iconActive: "from-teal-500 to-cyan-600" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = NAV_CONFIG.map((item) => ({
    ...item,
    title: t.nav[item.key],
  }));

  const currentPage = navItems.find((n) => n.url === location.pathname);

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full bg-transparent">
        <Sidebar collapsible="icon">
          <SidebarContent className="flex flex-col h-full">
            {/* Brand */}
            <div className="px-3 py-3.5 flex items-center gap-2.5 border-b border-sidebar-border/50 flex-shrink-0">
              <Link to="/" className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 sidebar-brand-glow bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-white/10 p-1">
                  <img
                    src="/spider.png"
                    alt="AI Collective"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const icon = document.createElement("span");
                        icon.className = "text-sky-300";
                        parent.appendChild(icon);
                      }
                    }}
                  />
                </div>
                <div className="group-data-[collapsible=icon]:hidden min-w-0">
                  <span className="block font-bold text-[15px] tracking-tight text-sidebar-foreground leading-none">
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
              <SidebarGroupLabel className="text-sidebar-foreground/35 text-[10px] font-bold uppercase tracking-widest px-3 mb-1">
                {t.nav.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "h-10 rounded-xl transition-all duration-200 group/item",
                            isActive && "nav-glow",
                          )}
                        >
                          <Link to={item.url} className="flex items-center gap-2.5 px-2">
                            <span
                              className={cn(
                                "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                                isActive
                                  ? `text-white bg-gradient-to-br ${item.iconActive} shadow-lg shadow-black/30`
                                  : `${item.iconSurface} ${item.iconText}`,
                              )}
                            >
                              <item.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                            </span>
                            <span className={cn(
                              "font-medium text-sm group-data-[collapsible=icon]:hidden",
                              isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/70",
                            )}>
                              {item.title}
                            </span>
                            {isActive && (
                              <ChevronRight className="ml-auto w-3.5 h-3.5 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Sidebar footer */}
            <div className="px-3 py-3 border-t border-sidebar-border/50 flex-shrink-0 group-data-[collapsible=icon]:px-2">
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-[11px] text-sidebar-foreground/40 font-mono group-data-[collapsible=icon]:hidden">
                  {t.status.allSystemsOnline}
                </span>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <header className="h-14 flex items-center border-b border-border/60 px-4 bg-background/85 backdrop-blur-xl gap-3 flex-shrink-0 shadow-sm shadow-border/20">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <div className="h-4 w-px bg-border/50" />
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground/60 font-medium">AI Collective</span>
              {currentPage && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <span className="font-semibold text-foreground">{currentPage.title}</span>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-auto scrollbar-thin">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
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
