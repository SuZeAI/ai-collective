"""No pytest-asyncio in this repo, so async paths are driven via ``asyncio.run()``."""

from __future__ import annotations

import asyncio

from server.app.service.simulation_service import SimulationService, DEFAULT_STEPS


def _run(coro):
    return asyncio.run(coro)


class _FakeLLM:
    def __init__(self, response: dict | Exception):
        self._response = response

    async def generate_json(self, *, system: str, user: str) -> dict:
        if isinstance(self._response, Exception):
            raise self._response
        return self._response


def test_plan_without_llm_returns_default_steps_formatted_with_task():
    service = SimulationService(llm=None)
    steps = _run(service.plan("Ship the release"))

    assert len(steps) == len(DEFAULT_STEPS)
    assert steps[0].staff == "Project Manager"
    assert "Ship the release" in steps[0].msg
    assert steps[0].phase == 1


def test_plan_with_llm_returns_parsed_steps():
    fake_llm = _FakeLLM(
        {
            "steps": [
                {"staff": "Project Manager", "msg": "Plan it", "delay_ms": 500, "phase": 1},
                {"staff": "Developer Staff", "msg": "Build it", "delay_ms": 500, "phase": 2},
                {"staff": "Reviewer Staff", "msg": "Review it", "delay_ms": 500, "phase": 3},
                {"staff": "Project Manager", "msg": "Ship it", "delay_ms": 500, "phase": 4},
            ]
        }
    )
    service = SimulationService(llm=fake_llm)
    steps = _run(service.plan("Custom task"))

    assert len(steps) == 4
    assert steps[0].staff == "Project Manager"
    assert steps[0].msg == "Plan it"


def test_plan_with_llm_falls_back_on_invalid_response():
    fake_llm = _FakeLLM({"steps": "not-a-list"})
    service = SimulationService(llm=fake_llm)
    steps = _run(service.plan("Fallback task"))

    assert len(steps) == len(DEFAULT_STEPS)
    assert "Fallback task" in steps[0].msg


def test_plan_with_llm_falls_back_on_exception():
    fake_llm = _FakeLLM(RuntimeError("provider down"))
    service = SimulationService(llm=fake_llm)
    steps = _run(service.plan("Error task"))

    assert len(steps) == len(DEFAULT_STEPS)
    assert "Error task" in steps[0].msg


def test_plan_with_llm_drops_incomplete_steps_and_clamps_delay():
    fake_llm = _FakeLLM(
        {
            "steps": [
                {"staff": "Project Manager", "msg": "Plan it", "delay_ms": 10, "phase": 1},
                {"staff": "", "msg": "missing staff, should be skipped"},
                {"msg": "missing staff key entirely"},
                {"staff": "Developer Staff", "msg": "Build it", "delay_ms": 500, "phase": 2},
                {"staff": "Reviewer Staff", "msg": "Review it", "delay_ms": 500, "phase": 3},
                {"staff": "Project Manager", "msg": "Ship it", "delay_ms": 500, "phase": 4},
            ]
        }
    )
    service = SimulationService(llm=fake_llm)
    steps = _run(service.plan("Clamp task"))

    # 2 of the 6 raw items are invalid (missing staff) and dropped, leaving 4 -- enough to pass the len(steps) < 4 check
    assert len(steps) == 4
    assert steps[0].delay_ms == 100  # clamped up from 10 via max(100, delay_ms)
