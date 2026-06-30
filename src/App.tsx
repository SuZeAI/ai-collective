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
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Dashboard from "@/pages/Dashboard";
import AgentBuilder from "@/pages/AgentBuilder";
import Skills from "./pages/Skills";
import TeamBuilder from "@/pages/TeamBuilder";
import TaskManager from "@/pages/TaskManager";
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
                <Route path="/agents" element={<WithLayout><AgentBuilder /></WithLayout>} />
                <Route path="/skills" element={<WithLayout><Skills /></WithLayout>} />
                <Route path="/teams" element={<WithLayout><TeamBuilder /></WithLayout>} />
                <Route path="/tasks" element={<WithLayout><TaskManager /></WithLayout>} />
                <Route path="/conversations" element={<WithLayout><Conversations /></WithLayout>} />
                <Route path="/analytics" element={<WithLayout><AnalyticsPage /></WithLayout>} />
                <Route path="/consumption" element={<WithLayout><ConsumptionMonitoring /></WithLayout>} />
                <Route path="/playground" element={<WithLayout><Playground /></WithLayout>} />
                <Route path="/workspaces" element={<WithLayout><Workspaces /></WithLayout>} />
                <Route path="/office-builder" element={<WithLayout><OfficeBuilder /></WithLayout>} />
                <Route path="/virtual-office" element={<WithLayout><VirtualOffice /></WithLayout>} />
                <Route path="/marketplace" element={<WithLayout><Marketplace /></WithLayout>} />
                <Route path="/documents" element={<WithLayout><DocumentLibrary /></WithLayout>} />
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
