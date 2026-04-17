from __future__ import annotations

from enum import Enum


class EventType(str, Enum):
	"""Canonical event types emitted by agent graph streaming."""

	AGENT_START = "agent_start"
	AGENT_TURN_START = "agent_turn_start"
	CONTEXT_BUILDING = "context_building"
	CONTEXT_RETRIEVED = "context_retrieved"
	LLM_REQUEST_START = "llm_request_start"
	LLM_RESPONSE_COMPLETE = "llm_response_complete"
	MESSAGE_INGESTED = "message_ingested"
	TURN_COMPLETE = "turn_complete"
	# Parallel / supervisor-worker events
	SUPERVISOR_PLAN = "supervisor_plan"
	PARALLEL_DISPATCH = "parallel_dispatch"
	WORKER_TASK_START = "worker_task_start"
	WORKER_TASK_COMPLETE = "worker_task_complete"
	SYNTHESIS_START = "synthesis_start"

