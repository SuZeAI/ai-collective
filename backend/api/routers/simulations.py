from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import current_user_dep, get_simulation_service
from backend.api.schemas.common import SimulationPlanRequest, SimulationPlanResponse, SimulationStepSchema
from backend.app.service.simulation_service import SimulationService


router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.post("/plan", response_model=SimulationPlanResponse)
async def plan(
    req: SimulationPlanRequest,
    service: SimulationService = Depends(get_simulation_service),
    _user=Depends(current_user_dep),
) -> SimulationPlanResponse:
    steps = await service.plan(req.task_description)
    return SimulationPlanResponse(
        steps=[SimulationStepSchema(staff=s.staff, msg=s.msg, delay_ms=s.delay_ms, phase=s.phase) for s in steps]
    )
