"""Side effects that follow a department becoming active: activating its
staff and seeding the initial kickoff conversation. Shared by the manual
department-creation flow and the AI Office Designer's apply step."""

from __future__ import annotations

import time
from dataclasses import replace
from datetime import datetime, timezone

from server.app.service.meeting_service import MeetingService
from server.app.service.staff_service import StaffService
from server.domain.enums import StaffStatus
from server.domain.models import Department, Message


def activate_department_staff(staff_ids: list[str], staff_service: StaffService) -> None:
    by_id = {s.id: s for s in staff_service.list_staff()}
    for staff_id in staff_ids:
        staff = by_id.get(staff_id)
        if staff is None:
            continue
        if staff.status != StaffStatus.active:
            staff_service.upsert_staff(replace(staff, status=StaffStatus.active))


def seed_department_kickoff_messages(
    department: Department, staff_service: StaffService, conv_service: MeetingService
) -> None:
    if not department.staff:
        return

    by_id = {s.id: s for s in staff_service.list_staff()}
    roster = [by_id[staff_id] for staff_id in department.staff if staff_id in by_id]
    if not roster:
        return

    lines = [
        f"Department {department.name} is now active. Let's align on goals and deliverables.",
        "I will break down responsibilities and coordinate the first execution cycle.",
        "Acknowledged. I am ready and starting my assigned part now.",
    ]
    base_ts = int(time.time() * 1000)
    task_ref = f"department:{department.id}"

    for idx, text in enumerate(lines):
        speaker = roster[idx % len(roster)]
        conv_service.add_message(
            Message(
                id=f"m{base_ts + idx}",
                staff_id=speaker.id,
                content=text,
                timestamp=datetime.now(timezone.utc).replace(microsecond=0),
                task_id=task_ref,
            )
        )
