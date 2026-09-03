import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface SimMessage {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

export function useStaffSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const runSimulation = useCallback(async (taskDescription: string) => {
    setIsSimulating(true);
    setMessages([]);
    setCurrentStep(1);

    try {
      const data = await api.simulatePlan(taskDescription);
      const steps = data?.steps || [];

      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error("No simulation steps returned from API");
      }

      for (let i = 0; i < steps.length; i++) {
        await new Promise((res) => setTimeout(res, steps[i].delay_ms || 1000));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + i,
            role: steps[i].staff,
            content: steps[i].msg,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        ]);

        const phase = steps[i].phase;
        if (typeof phase === "number" && phase >= 1 && phase <= 4) {
          setCurrentStep(phase);
        }
      }
    } catch (error) {
      console.error("Simulation error:", error);
      setMessages([
        {
          id: Date.now(),
          role: "System",
          content: `Error: ${error instanceof Error ? error.message : "Failed to run simulation. Please make sure the backend API is running."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);
    } finally {
      setIsSimulating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setCurrentStep(0);
    setIsSimulating(false);
  }, []);

  return { isSimulating, messages, currentStep, runSimulation, reset };
}
