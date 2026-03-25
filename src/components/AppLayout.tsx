import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Layout, Users, MessageSquare, CheckCircle2, BarChart3, Cpu, Play, Wrench } from "lucide-react";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Layout,
    iconText: "text-sky-700",
    iconSurface: "bg-sky-100/85",
    iconActive: "from-sky-500 to-blue-600",
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Cpu,
    iconText: "text-emerald-700",
    iconSurface: "bg-emerald-100/90",
    iconActive: "from-emerald-500 to-teal-600",
  },
  {
    title: "Skills",
    url: "/skills",
    icon: Wrench,
    iconText: "text-amber-700",
    iconSurface: "bg-amber-100/90",
    iconActive: "from-amber-500 to-orange-600",
  },
  {
    title: "Teams",
    url: "/teams",
    icon: Users,
    iconText: "text-indigo-700",
    iconSurface: "bg-indigo-100/85",
    iconActive: "from-indigo-500 to-violet-600",
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: CheckCircle2,
    iconText: "text-lime-700",
    iconSurface: "bg-lime-100/90",
    iconActive: "from-lime-500 to-emerald-600",
  },
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessageSquare,
    iconText: "text-cyan-700",
    iconSurface: "bg-cyan-100/85",
    iconActive: "from-cyan-500 to-sky-600",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    iconText: "text-fuchsia-700",
    iconSurface: "bg-fuchsia-100/85",
    iconActive: "from-fuchsia-500 to-pink-600",
  },
  {
    title: "Playground",
    url: "/playground",
    icon: Play,
    iconText: "text-rose-700",
    iconSurface: "bg-rose-100/90",
    iconActive: "from-rose-500 to-red-600",
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full bg-transparent">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <div className="p-4 flex items-center gap-2 border-b border-sidebar-border/70">
              <Link to="/" className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg bg-[linear-gradient(135deg,hsl(var(--hero-a)),hsl(var(--hero-b)))]">
                  <Activity className="text-primary-foreground w-4 h-4" />
                </div>
                <span className="font-bold text-lg tracking-tight text-foreground group-data-[collapsible=icon]:hidden">AI Collective</span>
              </Link>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive} className="h-10 rounded-xl transition-all duration-200">
                          <Link to={item.url} className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",
                                isActive
                                  ? `border-transparent text-white bg-gradient-to-br ${item.iconActive} shadow-[0_10px_18px_-10px_rgba(15,23,42,0.75)]`
                                  : `border-sidebar-border/70 ${item.iconSurface} ${item.iconText}`,
                              )}
                            >
                              <item.icon className="h-4 w-4" strokeWidth={2.1} />
                            </span>
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <header className="h-14 flex items-center border-b border-border/70 px-4 bg-card/80 backdrop-blur-md">
            <SidebarTrigger />
          </header>
          <main className="flex-1 min-h-0 overflow-auto">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
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
