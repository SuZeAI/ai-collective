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

    const steps = [
      { agent: "Project Manager", msg: `Analyzing task: "${taskDescription}"...`, delay: 1200 },
      { agent: "Project Manager", msg: "Breaking down into subtasks and assigning to agents.", delay: 900 },
      { agent: "Research Agent", msg: "Searching for competitor benchmarks and best practices...", delay: 2000 },
      { agent: "Research Agent", msg: "Found 5 relevant data points. Passing to Dev and Marketing.", delay: 1500 },
      { agent: "Developer Agent", msg: "Scaffolding technical architecture based on research specs.", delay: 1800 },
      { agent: "Marketing Agent", msg: "Drafting high-conversion copy for key sections.", delay: 1600 },
      { agent: "Developer Agent", msg: "Implementation complete. Handing off for review.", delay: 1400 },
      { agent: "Reviewer Agent", msg: "Quality check: Validating consistency and performance.", delay: 2000 },
      { agent: "Reviewer Agent", msg: "All checks passed. Output meets quality threshold.", delay: 1000 },
      { agent: "Project Manager", msg: "Task complete. All deliverables finalized.", delay: 800 },
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((res) => setTimeout(res, steps[i].delay));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: steps[i].agent,
          content: steps[i].msg,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);
      if (i === 1) setCurrentStep(2);
      if (i === 6) setCurrentStep(3);
      if (i === 8) setCurrentStep(4);
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
