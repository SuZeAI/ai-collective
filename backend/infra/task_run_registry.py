from __future__ import annotations

import threading
from uuid import uuid4

from backend.log import get_logger

logger = get_logger(__name__)

# Soft cap: registrations are always paired with unregister() in finally blocks,
# so growth past this points to a leak (a forgotten unregister) worth flagging.
_LEAK_WARN_THRESHOLD = 1000

# Cap on queued-but-not-yet-consumed human messages per run. Protects against
# a client flooding the queue faster than staff turns can drain it.
_MAX_PENDING_USER_MESSAGES = 50


class _RunHandle:
    """Per-run control handle: a cancel flag plus a human-in-the-loop inbox.

    User messages posted while the run is streaming are queued here and
    drained by the next staff node, so mid-run guidance lands in the context
    of every subsequent staff turn.
    """

    __slots__ = ("_event", "_messages", "_msg_lock", "_pause_event", "_requests")

    def __init__(self) -> None:
        self._event = threading.Event()
        self._messages: list[dict[str, str]] = []
        self._msg_lock = threading.Lock()
        self._pause_event = threading.Event()
        # ask_user tool: open question slots, request_id -> answer (None until
        # the user responds). Guarded by _msg_lock.
        self._requests: dict[str, str | None] = {}

    def cancel(self) -> None:
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()

    def pause(self) -> None:
        """Hold the run: staff nodes wait at their turn boundary until resume."""
        self._pause_event.set()

    def resume(self) -> None:
        self._pause_event.clear()

    @property
    def paused(self) -> bool:
        # A cancelled run is never "paused" — waiters must fall through and exit.
        return self._pause_event.is_set() and not self._event.is_set()

    def post_message(self, content: str) -> str | None:
        """Queue a human message for the next staff turn. Returns its id."""
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

    # -- ask_user tool: question/answer slots ---------------------------- #

    def open_request(self, request_id: str) -> None:
        with self._msg_lock:
            self._requests[request_id] = None

    def answer_request(self, request_id: str, response: str) -> bool:
        """Record the user's answer. False when the request is unknown/closed."""
        with self._msg_lock:
            if request_id not in self._requests:
                return False
            self._requests[request_id] = response
            return True

    def take_response(self, request_id: str) -> str | None:
        """Pop the answer if the user has responded; None while still waiting."""
        with self._msg_lock:
            response = self._requests.get(request_id)
            if response is not None:
                del self._requests[request_id]
            return response

    def close_request(self, request_id: str) -> None:
        with self._msg_lock:
            self._requests.pop(request_id, None)


# Backwards-compatible alias: callers historically held a "_CancelFlag".
_CancelFlag = _RunHandle

_active: dict[str, _RunHandle] = {}
_lock = threading.Lock()


def register(task_id: str) -> _RunHandle:
    handle = _RunHandle()
    with _lock:
        old = _active.get(task_id)
        if old is not None and not old.cancelled:
            # A previous run for this task is still marked active — e.g. the
            # client disconnected and restarted before that run's own cleanup
            # ran. Cancel it now: once we overwrite the registry entry below,
            # `signal_cancel`/`signal_pause` can only ever reach the new
            # handle, so without this the old run would keep executing in
            # the background, unstoppable, and future Pause/Stop clicks
            # would silently do nothing.
            logger.warning(
                "task_run_registry.register: task_id=%s already had an active "
                "handle — preempting/cancelling it before installing the new one",
                task_id,
            )
            old.cancel()
        _active[task_id] = handle
        active_count = len(_active)
    logger.info("task_run_registry.register: task_id=%s registered | active_runs=%d", task_id, active_count)
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
        logger.info("task_run_registry.signal_cancel: task_id=%s cancelled", task_id)
    else:
        logger.warning(
            "task_run_registry.signal_cancel: task_id=%s has no active handle — "
            "nothing to cancel (run already ended, or was never registered)",
            task_id,
        )


def unregister(task_id: str, handle: "_RunHandle | None" = None) -> None:
    """Remove a run's registry entry.

    When ``handle`` is given, only removes it if it's still the same handle
    registered under ``task_id`` — a stale run finishing *after* the task was
    restarted (new handle registered for a new run) must not evict the new
    run's entry, or every later pause/stop for it would silently no-op.
    """
    with _lock:
        if handle is not None and _active.get(task_id) is not handle:
            logger.info(
                "task_run_registry.unregister: task_id=%s skipped — a newer "
                "run's handle is now registered, this one is stale",
                task_id,
            )
            return
        _active.pop(task_id, None)
    logger.info("task_run_registry.unregister: task_id=%s removed", task_id)


def has_active_run(task_id: str) -> bool:
    with _lock:
        return task_id in _active


def signal_pause(task_id: str) -> bool:
    """Hold an active run at its next turn boundary. False when not active."""
    with _lock:
        handle = _active.get(task_id)
    if not handle or handle.cancelled:
        logger.warning(
            "task_run_registry.signal_pause: task_id=%s has no active, non-cancelled "
            "handle — nothing to hold",
            task_id,
        )
        return False
    handle.pause()
    logger.info("task_run_registry.signal_pause: task_id=%s held", task_id)
    return True


def signal_resume(task_id: str) -> bool:
    """Release a held run so the next staff turn proceeds. False when not active."""
    with _lock:
        handle = _active.get(task_id)
    if not handle:
        logger.warning("task_run_registry.signal_resume: task_id=%s has no active handle", task_id)
        return False
    handle.resume()
    logger.info("task_run_registry.signal_resume: task_id=%s resumed", task_id)
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


def is_cancelled(task_id: str) -> bool:
    """True when the run is gone or its cancel flag is set (waiters must exit)."""
    with _lock:
        handle = _active.get(task_id)
    return handle is None or handle.cancelled


# -- ask_user tool: question/answer slots -------------------------------- #

def open_user_request(task_id: str, request_id: str) -> bool:
    """Register an open ask_user question on an active run."""
    with _lock:
        handle = _active.get(task_id)
    if not handle or handle.cancelled:
        return False
    handle.open_request(request_id)
    return True


def answer_user_request(task_id: str, request_id: str, response: str) -> str:
    """Record the user's answer to an open question.

    Returns ``"ok"``, ``"no_run"`` (run finished/stopped) or
    ``"unknown_request"`` (request already answered, timed out, or never
    existed) so the API can surface the right error.
    """
    with _lock:
        handle = _active.get(task_id)
    if not handle or handle.cancelled:
        return "no_run"
    return "ok" if handle.answer_request(request_id, response) else "unknown_request"


def take_user_response(task_id: str, request_id: str) -> str | None:
    """Pop the user's answer if present; None while still waiting/inactive."""
    with _lock:
        handle = _active.get(task_id)
    if not handle:
        return None
    return handle.take_response(request_id)


def close_user_request(task_id: str, request_id: str) -> None:
    with _lock:
        handle = _active.get(task_id)
    if handle:
        handle.close_request(request_id)
