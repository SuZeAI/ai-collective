import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RunEngineProvider } from "@/contexts/RunEngineContext";
import { AppLayout } from "@/components/AppLayout";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

// Every route is code-split so a first-time visitor only downloads the app
// shell + whichever page they land on, instead of all ~40 pages (including
// admin monitoring, the virtual-office canvas, and the full marketing site)
// up front. AuthCallback/NotFound stay eager — they're tiny and one is the
// OAuth redirect target, where an extra chunk fetch just adds latency.
import AuthCallback from "@/pages/AuthCallback";
import NotFound from "@/pages/NotFound";
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const Profile = lazy(() => import("@/pages/Profile"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const StaffBuilder = lazy(() => import("@/pages/StaffBuilder"));
const Skills = lazy(() => import("@/pages/Skills"));
const DepartmentBuilder = lazy(() => import("@/pages/DepartmentBuilder"));
const TaskManager = lazy(() => import("@/pages/TaskManager"));
const Projects = lazy(() => import("@/pages/Projects"));
const Backlog = lazy(() => import("@/pages/Backlog"));
const Roadmap = lazy(() => import("@/pages/Roadmap"));
const Reports = lazy(() => import("@/pages/Reports"));
const Meetings = lazy(() => import("@/pages/Meetings"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const Playground = lazy(() => import("@/pages/Playground"));
const Companies = lazy(() => import("@/pages/Companies"));
const Platform = lazy(() => import("@/pages/Platform"));
const OfficeBuilder = lazy(() => import("@/pages/OfficeBuilder"));
const VirtualOffice = lazy(() => import("@/pages/VirtualOffice"));
const CompanyHierarchy = lazy(() => import("@/pages/CompanyHierarchy"));
const Recruiting = lazy(() => import("@/pages/Recruiting"));
const DocumentLibrary = lazy(() => import("@/pages/DocumentLibrary"));
const Settings = lazy(() => import("@/pages/Settings"));
const AdminMonitoring = lazy(() => import("@/pages/AdminMonitoring"));
const ConsumptionMonitoring = lazy(() => import("@/pages/ConsumptionMonitoring"));
const Docs = lazy(() => import("@/pages/Docs"));
const MeetCollective = lazy(() => import("@/pages/marketing/MeetCollective"));
const Pricing = lazy(() => import("@/pages/marketing/Pricing"));
const Solutions = lazy(() => import("@/pages/marketing/Solutions"));
const Resources = lazy(() => import("@/pages/marketing/Resources"));
const Changelog = lazy(() => import("@/pages/marketing/Changelog"));
const ContactSales = lazy(() => import("@/pages/marketing/ContactSales"));
const SupportCenter = lazy(() => import("@/pages/marketing/SupportCenter"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

// Used inside AuthenticatedLayout, around just the <Outlet/> — sized to the
// content pane (not the viewport) so a lazy page's first-load chunk fetch
// only blanks that pane, not the whole screen (which would otherwise flash
// AppLayout's sidebar out since it shared the outer <Suspense> boundary).
function ContentFallback() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

const queryClient = new QueryClient();

// apiFetch (src/lib/api.ts) dispatches this on any 401 response so an expired/
// invalid token logs the user out everywhere, not just wherever the failing
// call happened to be made. Mounted once, outside <Routes>, so it isn't torn
// down/rebuilt on every navigation.
function AuthTokenExpiryHandler() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { toast } = useToast();
  useEffect(() => {
    const handleExpired = () => {
      toast({ title: t.auth.sessionExpiredTitle, description: t.auth.sessionExpiredDesc, variant: "destructive" });
      logout();
      queryClient.clear();
    };
    window.addEventListener("auth:token-expired", handleExpired);
    return () => window.removeEventListener("auth:token-expired", handleExpired);
  }, [logout, queryClient, t, toast]);
  return null;
}

// Single persistent shell for every authenticated route, mounted once as a
// layout route (see the <Route element={<AuthenticatedLayout />}> group
// below) instead of per-page — each page used to wrap its own <AppLayout>,
// so <Routes> fully unmounted/remounted the sidebar (company list, active
// office highlight, …) on every navigation, flashing "All"/losing selection
// state for a frame. With Outlet, AppLayout stays mounted across page changes.
function AuthenticatedLayout() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <AppLayout>
      <Suspense fallback={<ContentFallback />}>
        <Outlet />
      </Suspense>
    </AppLayout>
  );
}

// Company-specific pages (create/manage tasks, projects, staff, …) make no sense
// in the "All" (Overall) scope, which is monitoring-only. The sidebar already
// hides them there; this guards stray deep links / typed URLs by sending the
// user back to the monitoring overview with a hint to pick a company.
function RequireCompany({ children }: { children: React.ReactNode }) {
  const scope = useCompanyScope();
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

// Catalog pages (Departments / Staff / Skills / Document Library) are reachable
// inside a company (per-company data) AND, for admins only, in the "All" scope —
// where they curate the shared "default" catalog that feeds Recruiting. Non-admins
// in "All" are bounced like any other company-only page.
function RequireCompanyOrAdmin({ children }: { children: React.ReactNode }) {
  const scope = useCompanyScope();
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

// Admin-only pages: authenticated AND role admin/system, else back to dashboard.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin" && user?.role !== "system") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthTokenExpiryHandler />
            <Toaster />
            {/* Lives above the router so in-flight task runs survive navigation. */}
            <RunEngineProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                {/* Layout route: <AppLayout> mounts once for every page below and
                    persists across navigation between them (only the <Outlet/>
                    content swaps), instead of remounting the sidebar per-page. */}
                <Route element={<AuthenticatedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/staff" element={<RequireCompanyOrAdmin><StaffBuilder /></RequireCompanyOrAdmin>} />
                  <Route path="/skills" element={<RequireCompanyOrAdmin><Skills /></RequireCompanyOrAdmin>} />
                  <Route path="/departments" element={<RequireCompanyOrAdmin><DepartmentBuilder /></RequireCompanyOrAdmin>} />
                  <Route path="/tasks" element={<RequireCompany><TaskManager /></RequireCompany>} />
                  <Route path="/projects" element={<RequireCompany><Projects /></RequireCompany>} />
                  <Route path="/projects/:key/board" element={<RequireCompany><TaskManager /></RequireCompany>} />
                  <Route path="/projects/:key/backlog" element={<RequireCompany><Backlog /></RequireCompany>} />
                  <Route path="/projects/:key/roadmap" element={<RequireCompany><Roadmap /></RequireCompany>} />
                  <Route path="/projects/:key/reports" element={<RequireCompany><Reports /></RequireCompany>} />
                  <Route path="/meetings" element={<RequireCompany><Meetings /></RequireCompany>} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/consumption" element={<ConsumptionMonitoring />} />
                  <Route path="/playground" element={<RequireCompany><Playground /></RequireCompany>} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="/platform" element={<RequireCompany><Platform /></RequireCompany>} />
                  <Route path="/office-builder" element={<OfficeBuilder />} />
                  <Route path="/virtual-office" element={<RequireCompany><VirtualOffice /></RequireCompany>} />
                  <Route path="/org-chart" element={<RequireCompany><CompanyHierarchy /></RequireCompany>} />
                  <Route path="/recruiting" element={<RequireCompany><Recruiting /></RequireCompany>} />
                  <Route path="/documents" element={<RequireCompanyOrAdmin><DocumentLibrary /></RequireCompanyOrAdmin>} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin/monitoring" element={<RequireAdmin><AdminMonitoring /></RequireAdmin>} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
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
              </Suspense>
            </BrowserRouter>
            </RunEngineProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
