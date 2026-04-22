from __future__ import annotations

import concurrent.futures
import json
import threading
from abc import ABC, abstractmethod
from collections import deque
from typing import Callable

from backend.log import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------


class ITaskQueue(ABC):
    @abstractmethod
    def submit(self, task_id: str, fn: Callable[[], None]) -> int:
        """Submit *fn* for execution under *task_id*.

        Returns 0 if started immediately, or 1-based queue position if waiting.
        """

    @abstractmethod
    def cancel(self, task_id: str) -> None:
        """Remove *task_id* from the waiting queue.

        Does NOT stop a task that is already running — use task_run_registry for that.
        """

    @abstractmethod
    def queue_position(self, task_id: str) -> int | None:
        """Return 0 if running, 1-based position if waiting, None if not tracked."""

    @abstractmethod
    def status(self) -> dict:
        """Return a snapshot of the queue state."""


# ---------------------------------------------------------------------------
# Memory backend (default)
# ---------------------------------------------------------------------------


class MemoryTaskQueue(ITaskQueue):
    """Bounded concurrency queue backed by a ``ThreadPoolExecutor``.

    At most *max_concurrent* tasks run simultaneously.  Excess tasks wait in a
    FIFO deque and are started automatically as running slots free up.

    This is the default backend — no extra dependencies required.
    Set ``TASK_QUEUE_BACKEND=memory`` (or leave unset) in your .env.
    """

    def __init__(self, max_concurrent: int = 3) -> None:
        self._max = max_concurrent
        self._running: set[str] = set()
        self._waiting: deque[tuple[str, Callable[[], None]]] = deque()
        self._lock = threading.Lock()
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_concurrent + 2,
            thread_name_prefix="task-worker",
        )

    def submit(self, task_id: str, fn: Callable[[], None]) -> int:
        with self._lock:
            if task_id in self._running:
                logger.debug("[Queue/memory] submit skip — task_id=%s already running", task_id)
                return 0
            # De-dup: remove any stale waiting entry for this id
            self._waiting = deque(
                (tid, f) for tid, f in self._waiting if tid != task_id
            )
            if len(self._running) < self._max:
                self._running.add(task_id)
                self._executor.submit(self._run_wrapped, task_id, fn)
                logger.info(
                    "[Queue/memory] task STARTED immediately | task_id=%s | running=%d/%d",
                    task_id, len(self._running), self._max,
                )
                return 0
            self._waiting.append((task_id, fn))
            pos = len(self._waiting)
            logger.info(
                "[Queue/memory] task QUEUED | task_id=%s | queue_position=%d | running=%d/%d",
                task_id, pos, len(self._running), self._max,
            )
            return pos

    def cancel(self, task_id: str) -> None:
        with self._lock:
            before = len(self._waiting)
            self._waiting = deque(
                (tid, f) for tid, f in self._waiting if tid != task_id
            )
            removed = before - len(self._waiting)
        if removed:
            logger.info("[Queue/memory] task REMOVED from queue | task_id=%s", task_id)
        else:
            logger.debug("[Queue/memory] cancel called but task_id=%s was not in queue", task_id)

    def queue_position(self, task_id: str) -> int | None:
        with self._lock:
            if task_id in self._running:
                return 0
            for i, (tid, _) in enumerate(self._waiting):
                if tid == task_id:
                    return i + 1
            return None

    def status(self) -> dict:
        with self._lock:
            return {
                "backend": "memory",
                "maxConcurrent": self._max,
                "running": list(self._running),
                "queued": [tid for tid, _ in self._waiting],
                "runningCount": len(self._running),
                "queuedCount": len(self._waiting),
            }

    # ------------------------------------------------------------------
    # Internal

    def _run_wrapped(self, task_id: str, fn: Callable[[], None]) -> None:
        logger.info("[Queue/memory] worker ENTER | task_id=%s", task_id)
        try:
            fn()
        except Exception:
            logger.exception("[Queue/memory] UNHANDLED ERROR in task | task_id=%s", task_id)
        finally:
            self._on_complete(task_id)

    def _on_complete(self, task_id: str) -> None:
        with self._lock:
            self._running.discard(task_id)
            logger.info(
                "[Queue/memory] worker EXIT | task_id=%s | remaining_running=%d | waiting=%d",
                task_id, len(self._running), len(self._waiting),
            )
            if self._waiting:
                next_id, next_fn = self._waiting.popleft()
                self._running.add(next_id)
                logger.info(
                    "[Queue/memory] dequeued next task | task_id=%s | queue_remaining=%d",
                    next_id, len(self._waiting),
                )
                self._executor.submit(self._run_wrapped, next_id, next_fn)


# ---------------------------------------------------------------------------
# RabbitMQ backend
# ---------------------------------------------------------------------------


class RabbitMQTaskQueue(ITaskQueue):
    """Task queue backed by RabbitMQ for durability and multi-instance support.

    Requires the ``pika`` package (``pip install pika``).
    Set ``TASK_QUEUE_BACKEND=rabbitmq`` and ``RABBITMQ_URL=amqp://...`` in .env.

    Architecture:
    - ``submit()`` stores ``fn`` locally by task_id, then publishes the task_id
      to RabbitMQ.  This means the worker must run in the same process (fn is not
      serialized across processes).
    - A background consumer thread picks up task_ids from RabbitMQ, looks up the
      local fn, and executes it in a bounded ThreadPoolExecutor.
    - ``cancel()`` removes the fn from the local registry.  If the consumer receives
      the message after cancellation, it simply discards it (no-op).
    - RabbitMQ provides ordering and durability: pending tasks survive process
      restarts IF the fn_registry is also persisted (not done here — for full
      durability use a proper worker architecture).
    """

    _QUEUE_NAME = "ai_collective_tasks"

    def __init__(self, rabbitmq_url: str, max_concurrent: int = 3) -> None:
        try:
            import pika  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                "Package 'pika' is not installed. Run: pip install pika"
            ) from exc

        self._url = rabbitmq_url
        self._max_concurrent = max_concurrent

        # Local fn registry — maps task_id → callable
        self._fn_registry: dict[str, Callable[[], None]] = {}
        self._registry_lock = threading.Lock()

        # Track what is currently executing (for status reporting)
        self._running: set[str] = set()
        self._running_lock = threading.Lock()

        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_concurrent + 2,
            thread_name_prefix="task-worker-rmq",
        )

        # Start consumer in background thread
        self._consumer_thread = threading.Thread(
            target=self._consume_loop, daemon=True, name="rabbitmq-consumer"
        )
        self._consumer_thread.start()

    # ------------------------------------------------------------------
    # Public API

    def submit(self, task_id: str, fn: Callable[[], None]) -> int:
        with self._registry_lock:
            self._fn_registry[task_id] = fn
        logger.info("[Queue/rabbitmq] task PUBLISHED | task_id=%s | queue=%s", task_id, self._QUEUE_NAME)
        self._publish(task_id)
        return 0  # exact position inside RabbitMQ queue is not tracked here

    def cancel(self, task_id: str) -> None:
        with self._registry_lock:
            removed = self._fn_registry.pop(task_id, None)
        if removed is not None:
            logger.info("[Queue/rabbitmq] task CANCELLED (fn deregistered) | task_id=%s", task_id)
        else:
            logger.debug("[Queue/rabbitmq] cancel called but task_id=%s not in fn_registry", task_id)

    def queue_position(self, task_id: str) -> int | None:
        with self._running_lock:
            if task_id in self._running:
                return 0
        return None  # exact queue position is not available from RabbitMQ

    def status(self) -> dict:
        with self._running_lock:
            running = list(self._running)
        with self._registry_lock:
            pending = [tid for tid in self._fn_registry if tid not in self._running]
        return {
            "backend": "rabbitmq",
            "maxConcurrent": self._max_concurrent,
            "running": running,
            "queued": pending,
            "runningCount": len(running),
            "queuedCount": len(pending),
        }

    # ------------------------------------------------------------------
    # Internal

    def _publish(self, task_id: str) -> None:
        import pika

        params = pika.URLParameters(self._url)
        try:
            conn = pika.BlockingConnection(params)
            channel = conn.channel()
            channel.queue_declare(queue=self._QUEUE_NAME, durable=True)
            channel.basic_publish(
                exchange="",
                routing_key=self._QUEUE_NAME,
                body=json.dumps({"task_id": task_id}).encode(),
                properties=pika.BasicProperties(delivery_mode=2),  # persistent
            )
            conn.close()
            logger.debug("[Queue/rabbitmq] message published OK | task_id=%s", task_id)
        except Exception:
            logger.exception("[Queue/rabbitmq] PUBLISH FAILED | task_id=%s — falling back to direct executor", task_id)
            # Fall back: execute directly so task doesn't get lost
            with self._registry_lock:
                fn = self._fn_registry.pop(task_id, None)
            if fn is not None:
                self._executor.submit(self._run_wrapped, task_id, fn)

    def _consume_loop(self) -> None:
        import pika

        while True:
            try:
                params = pika.URLParameters(self._url)
                conn = pika.BlockingConnection(params)
                channel = conn.channel()
                channel.queue_declare(queue=self._QUEUE_NAME, durable=True)
                channel.basic_qos(prefetch_count=self._max_concurrent)
                channel.basic_consume(
                    queue=self._QUEUE_NAME,
                    on_message_callback=self._on_message,
                )
                logger.info("[Queue/rabbitmq] consumer started | queue=%s | max_concurrent=%d", self._QUEUE_NAME, self._max_concurrent)
                channel.start_consuming()
            except Exception:
                logger.exception("[Queue/rabbitmq] consumer connection lost — reconnecting in 5 s")
                import time
                time.sleep(5)

    def _on_message(self, channel, method, _properties, body: bytes) -> None:
        try:
            task_id = json.loads(body)["task_id"]
        except Exception:
            logger.warning("[Queue/rabbitmq] malformed message body, acking and skipping: %r", body[:200])
            channel.basic_ack(delivery_tag=method.delivery_tag)
            return

        with self._registry_lock:
            fn = self._fn_registry.pop(task_id, None)

        channel.basic_ack(delivery_tag=method.delivery_tag)

        if fn is None:
            logger.info("[Queue/rabbitmq] message received but task already CANCELLED | task_id=%s", task_id)
            return

        logger.info("[Queue/rabbitmq] dispatching task to executor | task_id=%s", task_id)
        self._executor.submit(self._run_wrapped, task_id, fn)

    def _run_wrapped(self, task_id: str, fn: Callable[[], None]) -> None:
        with self._running_lock:
            self._running.add(task_id)
        logger.info("[Queue/rabbitmq] worker ENTER | task_id=%s", task_id)
        try:
            fn()
        except Exception:
            logger.exception("[Queue/rabbitmq] UNHANDLED ERROR in task | task_id=%s", task_id)
        finally:
            with self._running_lock:
                self._running.discard(task_id)
            logger.info("[Queue/rabbitmq] worker EXIT | task_id=%s | remaining_running=%d", task_id, len(self._running))


# ---------------------------------------------------------------------------
# Factory + module-level singleton
# ---------------------------------------------------------------------------


def create_task_queue(
    backend: str = "memory",
    max_concurrent: int = 3,
    rabbitmq_url: str | None = None,
) -> ITaskQueue:
    """Return a task queue instance for the given backend.

    backend: "memory" (default) | "rabbitmq"
    """
    if backend == "rabbitmq":
        if not rabbitmq_url:
            raise ValueError("RABBITMQ_URL must be set when TASK_QUEUE_BACKEND=rabbitmq")
        q = RabbitMQTaskQueue(rabbitmq_url, max_concurrent=max_concurrent)
        logger.info("[Queue] initialised RabbitMQ backend | url=%s | max_concurrent=%d", rabbitmq_url, max_concurrent)
        return q
    q = MemoryTaskQueue(max_concurrent=max_concurrent)
    logger.info("[Queue] initialised memory backend | max_concurrent=%d", max_concurrent)
    return q


# Lazy singleton — initialised by deps.py on first import; tests can replace it.
_queue: ITaskQueue | None = None
_queue_lock = threading.Lock()


def _get_queue() -> ITaskQueue:
    global _queue
    if _queue is None:
        with _queue_lock:
            if _queue is None:
                _queue = MemoryTaskQueue(max_concurrent=3)
    return _queue


def _set_queue(q: ITaskQueue) -> None:
    """Called by deps.py to inject the configured queue at startup."""
    global _queue
    _queue = q


def submit(task_id: str, fn: Callable[[], None]) -> int:
    return _get_queue().submit(task_id, fn)


def cancel(task_id: str) -> None:
    _get_queue().cancel(task_id)


def queue_position(task_id: str) -> int | None:
    return _get_queue().queue_position(task_id)


def status() -> dict:
    return _get_queue().status()
