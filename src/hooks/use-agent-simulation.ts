import { useState, useCallback } from "react";

export interface SimMessage {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

export function useAgentSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const runSimulation = useCallback(async (taskDescription: string) => {
    setIsSimulating(true);
    setMessages([]);
    setCurrentStep(1);

    type BackendStep = { agent: string; msg: string; delay_ms: number; phase?: number | null };
    const localSteps: BackendStep[] = [
      { agent: "Project Manager", msg: `Analyzing task: "${taskDescription}"...`, delay_ms: 1200, phase: 1 },
      { agent: "Project Manager", msg: "Breaking down into subtasks and assigning to agents.", delay_ms: 900, phase: 1 },
      { agent: "Research Agent", msg: "Searching for competitor benchmarks and best practices...", delay_ms: 2000, phase: 2 },
      { agent: "Research Agent", msg: "Found 5 relevant data points. Passing to Dev and Marketing.", delay_ms: 1500, phase: 2 },
      { agent: "Developer Agent", msg: "Scaffolding technical architecture based on research specs.", delay_ms: 1800, phase: 2 },
      { agent: "Marketing Agent", msg: "Drafting high-conversion copy for key sections.", delay_ms: 1600, phase: 2 },
      { agent: "Developer Agent", msg: "Implementation complete. Handing off for review.", delay_ms: 1400, phase: 2 },
      { agent: "Reviewer Agent", msg: "Quality check: Validating consistency and performance.", delay_ms: 2000, phase: 3 },
      { agent: "Reviewer Agent", msg: "All checks passed. Output meets quality threshold.", delay_ms: 1000, phase: 3 },
      { agent: "Project Manager", msg: "Task complete. All deliverables finalized.", delay_ms: 800, phase: 4 },
    ];

    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
    let steps: BackendStep[] = localSteps;
    try {
      const res = await fetch(`${apiBase}/simulations/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_description: taskDescription }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.steps && Array.isArray(data.steps) && data.steps.length > 0) {
          steps = data.steps;
        }
      }
    } catch {
      // ignore; fallback to localSteps
    }

    for (let i = 0; i < steps.length; i++) {
      await new Promise((res) => setTimeout(res, steps[i].delay_ms));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: steps[i].agent,
          content: steps[i].msg,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);
      const phase = steps[i].phase;
      if (typeof phase === "number" && phase >= 1 && phase <= 4) {
        setCurrentStep(phase);
      } else {
        if (i === 1) setCurrentStep(2);
        if (i === 6) setCurrentStep(3);
        if (i === 8) setCurrentStep(4);
      }
    }

    setIsSimulating(false);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setCurrentStep(0);
    setIsSimulating(false);
  }, []);

  return { isSimulating, messages, currentStep, runSimulation, reset };
}
