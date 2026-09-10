from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException

from server.domain.errors import NotFoundError
from server.domain.models import can_delete, can_modify, is_visible_to

if TYPE_CHECKING:
    from server.app.service.task_service import TaskService

_DEFAULT_MODIFY_DETAIL = "Only the default (admin) account can edit shared default items"
_DEFAULT_DELETE_DETAIL = "Only the default (admin) account can delete shared default items"


def require_modifiable(existing, owner_id: str, label: str, *, detail: str = _DEFAULT_MODIFY_DETAIL) -> None:
    """Shared owner/visibility gate for upsert (create-or-edit) endpoints.

    No-op if ``existing`` is None (caller is creating a brand-new entity).
    Otherwise raises ``NotFoundError`` (-> 404) if ``existing`` is invisible to
    ``owner_id``, or ``HTTPException`` (403) if visible but not modifiable.
    """
    if existing is None:
        return
    if not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"{label} not found")
    if not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail=detail)


def require_deletable(existing, owner_id: str, label: str, *, detail: str = _DEFAULT_DELETE_DETAIL) -> None:
    """Shared owner/visibility gate for delete endpoints. See ``require_modifiable``."""
    if existing is None:
        return
    if not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"{label} not found")
    if not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail=detail)


def require_task_visible(task_service: "TaskService", task_id: str, owner_id: str, *, label: str = "Task") -> None:
    """Raise 404 unless task_id exists and is visible to owner_id.

    Task ids double as meeting/conversation ids; without this check any
    caller who can guess or enumerate a task id could read, inject into, or
    control another owner's meeting/run.
    """
    try:
        task = task_service.get_task(task_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    if not is_visible_to(owner_id, task.owner_id):
        raise HTTPException(status_code=404, detail=f"{label} not found")
