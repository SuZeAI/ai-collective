import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import AgentBuilder from "@/pages/AgentBuilder";
import TeamBuilder from "@/pages/TeamBuilder";
import TaskManager from "@/pages/TaskManager";
import Conversations from "@/pages/Conversations";
import AnalyticsPage from "@/pages/AnalyticsPage";
import Playground from "@/pages/Playground";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function DashboardRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="agents" element={<AgentBuilder />} />
        <Route path="teams" element={<TeamBuilder />} />
        <Route path="tasks" element={<TaskManager />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="playground" element={<Playground />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<DashboardRoutes />} />
          <Route path="/agents" element={<DashboardRoutes />} />
          <Route path="/teams" element={<DashboardRoutes />} />
          <Route path="/tasks" element={<DashboardRoutes />} />
          <Route path="/conversations" element={<DashboardRoutes />} />
          <Route path="/analytics" element={<DashboardRoutes />} />
          <Route path="/playground" element={<DashboardRoutes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
