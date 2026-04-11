import logging
import time
from datetime import datetime

from backend.infrastructure.event_bus import event_bus
from backend.domain.models import Task, Message
from backend.domain.enums import TaskStatus
from backend.api.deps import (
    get_task_service,
    get_team_service,
    get_agent_service,
    get_conversation_service,
)
from backend.application.service.task_service import TaskService
from backend.application.service.team_service import TeamService
from backend.application.service.agent_service import AgentService
from backend.application.service.conversation_service import ConversationService
from dataclasses import replace

logger = logging.getLogger(__name__)

def _run_team_conversation_loop(
    task: Task,
    task_service: TaskService,
    team_service: TeamService,
    agent_service: AgentService,
    conv_service: ConversationService,
) -> Task:
    if task.status != TaskStatus.in_progress:
        return task

    try:
        team = team_service.get_team(task.team_id)
        team_agent_ids = [aid for aid in team.agents]
    except Exception:
        team_agent_ids = []

    participants: list[str] = []
    for aid in team_agent_ids:
        try:
            agent_service.get_agent(aid)
            participants.append(aid)
        except Exception:
            continue
    if not participants:
        participants = [aid for aid in task.assigned_agents if aid]
    if not participants:
        return task

    messages = [
        "Starting execution for this task. Sharing plan and splitting responsibilities.",
        "Received. I am processing my part and will report intermediate results.",
        "Update: progress is moving. Syncing blockers and dependencies now.",
        "Reviewing outputs and validating quality before final handoff.",
    ]

    max_steps = 10
    progress = max(0, min(100, int(task.progress)))
    base_ts = int(time.time() * 1000)

    for step in range(max_steps):
        if progress >= 100:
            break
        speaker = participants[step % len(participants)]
        text = messages[step % len(messages)]
        conv_service.add_message(
            Message(
                id=f"m{base_ts + step}",
                agent_id=speaker,
                content=f"[Step {step + 1}/{max_steps}] {text}",
                timestamp=datetime.utcnow().replace(microsecond=0),
                task_id=task.id,
            )
        )

        remaining_steps = max_steps - step
        increment = max(8, (100 - progress + remaining_steps - 1) // remaining_steps)
        progress = min(100, progress + increment)

    status = task.status
    if progress >= 100:
        status = TaskStatus.completed
        conv_service.add_message(
            Message(
                id=f"m{base_ts + max_steps + 1}",
                agent_id=participants[0],
                content="Task completed. Team has finalized all deliverables.",
                timestamp=datetime.utcnow().replace(microsecond=0),
                task_id=task.id,
            )
        )

    updated = replace(task, progress=progress, status=status)
    return task_service.upsert_task(updated)


async def handle_task_in_progress(payload: dict):
    task_id = payload.get("task_id")
    if not task_id:
        return

    logger.info(f"Processing background task_in_progress for task {task_id}")

    # Manually resolve services for background processes
    task_service = get_task_service()
    team_service = get_team_service()
    agent_service = get_agent_service()
    conv_service = get_conversation_service()

    try:
        task = task_service.get_task(task_id)
        _run_team_conversation_loop(
            task,
            task_service,
            team_service,
            agent_service,
            conv_service
        )
        logger.info(f"Successfully processed background task {task_id}")
    except Exception as e:
        logger.error(f"Failed handling background task {task_id}: {e}", exc_info=True)


async def setup_event_handlers():
    await event_bus.subscribe("task.in_progress", handle_task_in_progress)
