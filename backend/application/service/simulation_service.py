from __future__ import annotations

from backend.application.ports.llm import LLMProvider
from backend.domain.models import SimulationStep
from backend.log import get_logger

logger = get_logger(__name__)


DEFAULT_STEPS: list[SimulationStep] = [
    SimulationStep(staff="Project Manager", msg="Analyzing task: \"{task}\"...", delay_ms=1200, phase=1),
    SimulationStep(staff="Project Manager", msg="Breaking down into subtasks and assigning to staff.", delay_ms=900, phase=1),
    SimulationStep(staff="Research Staff", msg="Searching for competitor benchmarks and best practices...", delay_ms=2000, phase=2),
    SimulationStep(staff="Research Staff", msg="Found 5 relevant data points. Passing to Dev and Marketing.", delay_ms=1500, phase=2),
    SimulationStep(staff="Developer Staff", msg="Scaffolding technical architecture based on research specs.", delay_ms=1800, phase=2),
    SimulationStep(staff="Marketing Staff", msg="Drafting high-conversion copy for key sections.", delay_ms=1600, phase=2),
    SimulationStep(staff="Developer Staff", msg="Implementation complete. Handing off for review.", delay_ms=1400, phase=2),
    SimulationStep(staff="Reviewer Staff", msg="Quality check: Validating consistency and performance.", delay_ms=2000, phase=3),
    SimulationStep(staff="Reviewer Staff", msg="All checks passed. Output meets quality threshold.", delay_ms=1000, phase=3),
    SimulationStep(staff="Project Manager", msg="Task complete. All deliverables finalized.", delay_ms=800, phase=4),
]


class SimulationService:
    def __init__(self, llm: LLMProvider | None = None):
        self._llm = llm

    @staticmethod
    def _default_steps(task_description: str) -> list[SimulationStep]:
        return [
            SimulationStep(staff=s.staff, msg=s.msg.format(task=task_description), delay_ms=s.delay_ms, phase=s.phase)
            for s in DEFAULT_STEPS
        ]

    async def plan(self, task_description: str) -> list[SimulationStep]:
        if not self._llm:
            return self._default_steps(task_description)

        system = (
            "You are a multi-staff workflow planner. "
            "Return ONLY valid JSON with this shape: {\"steps\": [{\"staff\": str, \"msg\": str, \"delay_ms\": int, \"phase\": int}]} "
            "Where phase is 1..4 (Planning/Execution/Review/Complete). Provide 8-12 steps."
        )
        user = (
            "Task description:\n" + task_description + "\n\n" +
            "Generate an staff collaboration plan for these roles: Project Manager, Research Staff, Developer Staff, Marketing Staff, Reviewer Staff."
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
                staff = str(item.get("staff", ""))
                msg = str(item.get("msg", ""))
                delay_ms = int(item.get("delay_ms", 1200))
                phase = item.get("phase")
                phase_int = int(phase) if phase is not None else None
                if not staff or not msg:
                    continue
                steps.append(SimulationStep(staff=staff, msg=msg, delay_ms=max(100, delay_ms), phase=phase_int))
            if len(steps) < 4:
                raise ValueError("Too few valid steps")
            return steps
        except Exception:
            # Fallback to default deterministic steps — log so an LLM/provider
            # misconfiguration is distinguishable from "model returned junk".
            logger.warning("Simulation LLM planning failed; using default steps", exc_info=True)
            return self._default_steps(task_description)
