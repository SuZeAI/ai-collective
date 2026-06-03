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
	SUBAGENT_START = "subagent_start"
	SUBAGENT_COMPLETE = "subagent_complete"
	TURN_COMPLETE = "turn_complete"

