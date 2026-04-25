from __future__ import annotations

import threading


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
