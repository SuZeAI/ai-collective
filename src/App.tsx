import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import AgentBuilder from "@/pages/AgentBuilder";
import Skills from "./pages/Skills";
import TeamBuilder from "@/pages/TeamBuilder";
import TaskManager from "@/pages/TaskManager";
import Conversations from "@/pages/Conversations";
import AnalyticsPage from "@/pages/AnalyticsPage";
import Playground from "@/pages/Playground";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function WithLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<WithLayout><Dashboard /></WithLayout>} />
          <Route path="/agents" element={<WithLayout><AgentBuilder /></WithLayout>} />
          <Route path="/skills" element={<WithLayout><Skills /></WithLayout>} />
          <Route path="/teams" element={<WithLayout><TeamBuilder /></WithLayout>} />
          <Route path="/tasks" element={<WithLayout><TaskManager /></WithLayout>} />
          <Route path="/conversations" element={<WithLayout><Conversations /></WithLayout>} />
          <Route path="/analytics" element={<WithLayout><AnalyticsPage /></WithLayout>} />
          <Route path="/playground" element={<WithLayout><Playground /></WithLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
