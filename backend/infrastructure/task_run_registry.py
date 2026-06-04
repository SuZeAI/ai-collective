from __future__ import annotations

import threading

from backend.log import get_logger

logger = get_logger(__name__)

# Soft cap: registrations are always paired with unregister() in finally blocks,
# so growth past this points to a leak (a forgotten unregister) worth flagging.
_LEAK_WARN_THRESHOLD = 1000


class _CancelFlag:
    __slots__ = ("_event",)

    def __init__(self) -> None:
        self._event = threading.Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()


_active: dict[str, _CancelFlag] = {}
_lock = threading.Lock()


def register(task_id: str) -> _CancelFlag:
    flag = _CancelFlag()
    with _lock:
        _active[task_id] = flag
        active_count = len(_active)
    if active_count > _LEAK_WARN_THRESHOLD:
        logger.warning(
            "task_run_registry has %d active runs — possible leak (missing unregister)",
            active_count,
        )
    return flag


def signal_cancel(task_id: str) -> None:
    with _lock:
        flag = _active.get(task_id)
    if flag:
        flag.cancel()


def unregister(task_id: str) -> None:
    with _lock:
        _active.pop(task_id, None)


def has_active_run(task_id: str) -> bool:
    with _lock:
        return task_id in _active
