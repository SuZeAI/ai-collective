from __future__ import annotations

import json

from backend.application.ports.llm import LLMProvider
from backend.domain.models import SimulationStep


DEFAULT_STEPS: list[SimulationStep] = [
    SimulationStep(agent="Project Manager", msg="Analyzing task: \"{task}\"...", delay_ms=1200, phase=1),
    SimulationStep(agent="Project Manager", msg="Breaking down into subtasks and assigning to agents.", delay_ms=900, phase=1),
    SimulationStep(agent="Research Agent", msg="Searching for competitor benchmarks and best practices...", delay_ms=2000, phase=2),
    SimulationStep(agent="Research Agent", msg="Found 5 relevant data points. Passing to Dev and Marketing.", delay_ms=1500, phase=2),
    SimulationStep(agent="Developer Agent", msg="Scaffolding technical architecture based on research specs.", delay_ms=1800, phase=2),
    SimulationStep(agent="Marketing Agent", msg="Drafting high-conversion copy for key sections.", delay_ms=1600, phase=2),
    SimulationStep(agent="Developer Agent", msg="Implementation complete. Handing off for review.", delay_ms=1400, phase=2),
    SimulationStep(agent="Reviewer Agent", msg="Quality check: Validating consistency and performance.", delay_ms=2000, phase=3),
    SimulationStep(agent="Reviewer Agent", msg="All checks passed. Output meets quality threshold.", delay_ms=1000, phase=3),
    SimulationStep(agent="Project Manager", msg="Task complete. All deliverables finalized.", delay_ms=800, phase=4),
]


class SimulationService:
    def __init__(self, llm: LLMProvider | None = None):
        self._llm = llm

    async def plan(self, task_description: str) -> list[SimulationStep]:
        if not self._llm:
            return [
                SimulationStep(agent=s.agent, msg=s.msg.format(task=task_description), delay_ms=s.delay_ms, phase=s.phase)
                for s in DEFAULT_STEPS
            ]

        system = (
            "You are a multi-agent workflow planner. "
            "Return ONLY valid JSON with this shape: {\"steps\": [{\"agent\": str, \"msg\": str, \"delay_ms\": int, \"phase\": int}]} "
            "Where phase is 1..4 (Planning/Execution/Review/Complete). Provide 8-12 steps."
        )
        user = (
            "Task description:\n" + task_description + "\n\n" +
            "Generate an agent collaboration plan for these roles: Project Manager, Research Agent, Developer Agent, Marketing Agent, Reviewer Agent."
        )
        try:
            data = await self._llm.generate_json(system=system, user=user)
            steps_raw = data.get("steps") if isinstance(data, dict) else None
            if not isinstance(steps_raw, list) or len(steps_raw) == 0:
                raise ValueError("No steps")
            steps: list[SimulationStep] = []
            for item in steps_raw:
                if not isinstance(item, dict):
                    continue
                agent = str(item.get("agent", ""))
                msg = str(item.get("msg", ""))
                delay_ms = int(item.get("delay_ms", 1200))
                phase = item.get("phase")
                phase_int = int(phase) if phase is not None else None
                if not agent or not msg:
                    continue
                steps.append(SimulationStep(agent=agent, msg=msg, delay_ms=max(100, delay_ms), phase=phase_int))
            if len(steps) < 4:
                raise ValueError("Too few valid steps")
            return steps
        except Exception:
            # Fallback to default deterministic steps
            return [
                SimulationStep(agent=s.agent, msg=s.msg.format(task=task_description), delay_ms=s.delay_ms, phase=s.phase)
                for s in DEFAULT_STEPS
            ]
