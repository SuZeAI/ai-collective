"""Regression tests for server/domain/staff/_graph_runtime.py's working-memory
auto-capture helpers.

Bug found during a manual full-system pass (2026-07-12): both
`record_turn_in_memory` and `record_guidance_in_memory` called
`working_memory_store.record_note(staff_member=...)`, but the real keyword
argument is `staff` (see `working_memory_store.record_note`'s signature, and
`server/domain/tools/memory_tool.py` which already called it correctly).
Every staff-graph turn silently failed to persist to working memory -- the
`TypeError` was swallowed by a broad `except Exception` and only ever
surfaced in a warning log, so this never showed up as a request failure.
"""

from __future__ import annotations

import uuid

from server.domain.staff._graph_runtime import (
    record_guidance_in_memory,
    record_turn_in_memory,
)
from server.infra import working_memory_store


def test_record_turn_in_memory_persists_a_note():
    meeting_id = f"conv_{uuid.uuid4().hex}"
    record_turn_in_memory(meeting_id, staff_name="Researcher", turn=1, content="Found the answer")

    memory = working_memory_store.get_memory(meeting_id)
    assert memory is not None
    assert len(memory.notes) == 1
    assert memory.notes[0].staff == "Researcher"
    assert memory.notes[0].content == "Found the answer"


def test_record_guidance_in_memory_persists_a_pinned_note():
    meeting_id = f"conv_{uuid.uuid4().hex}"
    record_guidance_in_memory(meeting_id, "Focus on the budget section only")

    memory = working_memory_store.get_memory(meeting_id)
    assert memory is not None
    assert len(memory.notes) == 1
    note = memory.notes[0]
    assert note.staff == "user"
    assert note.kind == "guidance"
    assert note.pinned is True


def test_record_turn_in_memory_is_a_no_op_for_blank_input():
    meeting_id = f"conv_{uuid.uuid4().hex}"
    record_turn_in_memory(meeting_id, staff_name="X", turn=1, content="   ")
    assert working_memory_store.get_memory(meeting_id).notes == []
