from __future__ import annotations

import threading
from uuid import uuid4

from backend.log import get_logger

logger = get_logger(__name__)

# Soft cap: registrations are always paired with unregister() in finally blocks,
# so growth past this points to a leak (a forgotten unregister) worth flagging.
_LEAK_WARN_THRESHOLD = 1000

# Cap on queued-but-not-yet-consumed human messages per run. Protects against
# a client flooding the queue faster than agent turns can drain it.
_MAX_PENDING_USER_MESSAGES = 50


class _RunHandle:
    """Per-run control handle: a cancel flag plus a human-in-the-loop inbox.

    User messages posted while the run is streaming are queued here and
    drained by the next agent node, so mid-run guidance lands in the context
    of every subsequent agent turn.
    """

    __slots__ = ("_event", "_messages", "_msg_lock", "_pause_event")

    def __init__(self) -> None:
        self._event = threading.Event()
        self._messages: list[dict[str, str]] = []
        self._msg_lock = threading.Lock()
        self._pause_event = threading.Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()

    def pause(self) -> None:
        """Hold the run: agent nodes wait at their turn boundary until resume."""
        self._pause_event.set()

    def resume(self) -> None:
        self._pause_event.clear()

    @property
    def paused(self) -> bool:
        # A cancelled run is never "paused" — waiters must fall through and exit.
        return self._pause_event.is_set() and not self._event.is_set()

    def post_message(self, content: str) -> str | None:
        """Queue a human message for the next agent turn. Returns its id."""
        with self._msg_lock:
            if len(self._messages) >= _MAX_PENDING_USER_MESSAGES:
                return None
            message_id = uuid4().hex
            self._messages.append({"id": message_id, "content": content})
            return message_id

    def drain_messages(self) -> list[dict[str, str]]:
        """Atomically take all pending human messages (FIFO order)."""
        with self._msg_lock:
            pending = self._messages
            self._messages = []
            return pending


# Backwards-compatible alias: callers historically held a "_CancelFlag".
_CancelFlag = _RunHandle

_active: dict[str, _RunHandle] = {}
_lock = threading.Lock()


def register(task_id: str) -> _RunHandle:
    handle = _RunHandle()
    with _lock:
        _active[task_id] = handle
        active_count = len(_active)
    if active_count > _LEAK_WARN_THRESHOLD:
        logger.warning(
            "task_run_registry has %d active runs — possible leak (missing unregister)",
            active_count,
        )
    return handle


def signal_cancel(task_id: str) -> None:
    with _lock:
        handle = _active.get(task_id)
    if handle:
        handle.cancel()


def unregister(task_id: str) -> None:
    with _lock:
        _active.pop(task_id, None)


def has_active_run(task_id: str) -> bool:
    with _lock:
        return task_id in _active


def signal_pause(task_id: str) -> bool:
    """Hold an active run at its next turn boundary. False when not active."""
    with _lock:
        handle = _active.get(task_id)
    if not handle or handle.cancelled:
        return False
    handle.pause()
    return True


def signal_resume(task_id: str) -> bool:
    """Release a held run so the next agent turn proceeds. False when not active."""
    with _lock:
        handle = _active.get(task_id)
    if not handle:
        return False
    handle.resume()
    return True


def is_paused(task_id: str) -> bool:
    """True while an active, non-cancelled run is held at a turn boundary."""
    with _lock:
        handle = _active.get(task_id)
    return bool(handle and handle.paused)


def post_user_message(task_id: str, content: str) -> str | None:
    """Queue a human-in-the-loop message for an active run.

    Returns the queued message id, or ``None`` when the run is not active
    (already finished/cancelled) or its inbox is full — the caller should
    surface that to the user instead of silently dropping guidance.
    """
    with _lock:
        handle = _active.get(task_id)
    if not handle or handle.cancelled:
        return None
    return handle.post_message(content)


def drain_user_messages(task_id: str) -> list[dict[str, str]]:
    """Take all pending human messages for a run (empty when none/inactive)."""
    with _lock:
        handle = _active.get(task_id)
    if not handle:
        return []
    return handle.drain_messages()
