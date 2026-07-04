import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RunEngineProvider } from "@/contexts/RunEngineContext";
import { AppLayout } from "@/components/AppLayout";
import { useWorkspaceScope } from "@/hooks/use-workspace-scope";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Dashboard from "@/pages/Dashboard";
import AgentBuilder from "@/pages/AgentBuilder";
import Skills from "./pages/Skills";
import TeamBuilder from "@/pages/TeamBuilder";
import TaskManager from "@/pages/TaskManager";
import Projects from "@/pages/Projects";
import Backlog from "@/pages/Backlog";
import Roadmap from "@/pages/Roadmap";
import Reports from "@/pages/Reports";
import Conversations from "@/pages/Conversations";
import AnalyticsPage from "@/pages/AnalyticsPage";
import Playground from "@/pages/Playground";
import Workspaces from "@/pages/Workspaces";
import OfficeBuilder from "@/pages/OfficeBuilder";
import VirtualOffice from "@/pages/VirtualOffice";
import Marketplace from "@/pages/Marketplace";
import DocumentLibrary from "@/pages/DocumentLibrary";
import Settings from "@/pages/Settings";
import AdminMonitoring from "@/pages/AdminMonitoring";
import ConsumptionMonitoring from "@/pages/ConsumptionMonitoring";
import Docs from "@/pages/Docs";
import NotFound from "@/pages/NotFound";
import AuthCallback from "@/pages/AuthCallback";
import MeetCollective from "@/pages/marketing/MeetCollective";
import Pricing from "@/pages/marketing/Pricing";
import Solutions from "@/pages/marketing/Solutions";
import Resources from "@/pages/marketing/Resources";
import Changelog from "@/pages/marketing/Changelog";
import ContactSales from "@/pages/marketing/ContactSales";
import SupportCenter from "@/pages/marketing/SupportCenter";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function WithLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  );
}

// Company-specific pages (create/manage tasks, projects, staff, …) make no sense
// in the "All" (Overall) scope, which is monitoring-only. The sidebar already
// hides them there; this guards stray deep links / typed URLs by sending the
// user back to the monitoring overview with a hint to pick a company.
function RequireCompany({ children }: { children: React.ReactNode }) {
  const scope = useWorkspaceScope();
  const { t } = useLanguage();
  const { toast } = useToast();
  // `isOverall` is reliable immediately (true only when no office is selected),
  // so gating on it avoids a blank flash on company pages while membership loads.
  useEffect(() => {
    if (scope.isOverall) toast({ description: t.nav.selectCompanyToManage });
  }, [scope.isOverall, toast, t]);
  if (scope.isOverall) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function WithCompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireCompany>
        <AppLayout>{children}</AppLayout>
      </RequireCompany>
    </RequireAuth>
  );
}

// Catalog pages (Departments / Humans / Skills / Document Library) are reachable
// inside a company (per-company data) AND, for admins only, in the "All" scope —
// where they curate the shared "default" catalog that feeds Recruiting. Non-admins
// in "All" are bounced like any other company-only page.
function RequireCompanyOrAdmin({ children }: { children: React.ReactNode }) {
  const scope = useWorkspaceScope();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "system";
  useEffect(() => {
    if (scope.isOverall && !isAdmin) toast({ description: t.nav.selectCompanyToManage });
  }, [scope.isOverall, isAdmin, toast, t]);
  if (scope.isOverall && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function WithCatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireCompanyOrAdmin>
        <AppLayout>{children}</AppLayout>
      </RequireCompanyOrAdmin>
    </RequireAuth>
  );
}

// Admin-only pages: authenticated AND role admin/system, else back to dashboard.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== "admin" && user.role !== "system") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function WithAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <AppLayout>{children}</AppLayout>
    </RequireAdmin>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {/* Lives above the router so in-flight task runs survive navigation. */}
            <RunEngineProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/dashboard" element={<WithLayout><Dashboard /></WithLayout>} />
                <Route path="/agents" element={<WithCatalogLayout><AgentBuilder /></WithCatalogLayout>} />
                <Route path="/skills" element={<WithCatalogLayout><Skills /></WithCatalogLayout>} />
                <Route path="/teams" element={<WithCatalogLayout><TeamBuilder /></WithCatalogLayout>} />
                <Route path="/tasks" element={<WithCompanyLayout><TaskManager /></WithCompanyLayout>} />
                <Route path="/projects" element={<WithCompanyLayout><Projects /></WithCompanyLayout>} />
                <Route path="/projects/:key/board" element={<WithCompanyLayout><TaskManager /></WithCompanyLayout>} />
                <Route path="/projects/:key/backlog" element={<WithCompanyLayout><Backlog /></WithCompanyLayout>} />
                <Route path="/projects/:key/roadmap" element={<WithCompanyLayout><Roadmap /></WithCompanyLayout>} />
                <Route path="/projects/:key/reports" element={<WithCompanyLayout><Reports /></WithCompanyLayout>} />
                <Route path="/conversations" element={<WithCompanyLayout><Conversations /></WithCompanyLayout>} />
                <Route path="/analytics" element={<WithLayout><AnalyticsPage /></WithLayout>} />
                <Route path="/consumption" element={<WithLayout><ConsumptionMonitoring /></WithLayout>} />
                <Route path="/playground" element={<WithCompanyLayout><Playground /></WithCompanyLayout>} />
                <Route path="/workspaces" element={<WithLayout><Workspaces /></WithLayout>} />
                <Route path="/office-builder" element={<WithLayout><OfficeBuilder /></WithLayout>} />
                <Route path="/virtual-office" element={<WithCompanyLayout><VirtualOffice /></WithCompanyLayout>} />
                <Route path="/marketplace" element={<WithCompanyLayout><Marketplace /></WithCompanyLayout>} />
                <Route path="/documents" element={<WithCatalogLayout><DocumentLibrary /></WithCatalogLayout>} />
                <Route path="/settings" element={<WithLayout><Settings /></WithLayout>} />
                <Route path="/admin/monitoring" element={<WithAdminLayout><AdminMonitoring /></WithAdminLayout>} />
                <Route path="/profile" element={<WithLayout><Profile /></WithLayout>} />
                <Route path="/docs" element={<Docs />} />
                {/* Marketing pages */}
                <Route path="/meet" element={<MeetCollective />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/solutions" element={<Solutions />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/contact-sales" element={<ContactSales />} />
                <Route path="/support" element={<SupportCenter />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </RunEngineProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
