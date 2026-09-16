from __future__ import annotations

import threading

from server.infra.task_queue import RabbitMQTaskQueue


def _make_queue() -> RabbitMQTaskQueue:
    """Bypass __init__ (which opens a real RabbitMQ connection) to unit-test submit()."""
    q = object.__new__(RabbitMQTaskQueue)
    q._fn_registry = {}
    q._registry_lock = threading.Lock()
    q._running = set()
    q._running_lock = threading.Lock()
    q._published: list[str] = []
    q._publish = lambda task_id: q._published.append(task_id)
    return q


def test_submit_registers_and_publishes_when_not_running():
    q = _make_queue()

    pos = q.submit("t1", lambda: None)

    assert pos == 0
    assert "t1" in q._fn_registry
    assert q._published == ["t1"]


def test_submit_skips_when_task_already_running():
    q = _make_queue()
    q._running.add("t1")

    pos = q.submit("t1", lambda: None)

    assert pos == 0
    assert "t1" not in q._fn_registry
    assert q._published == []
