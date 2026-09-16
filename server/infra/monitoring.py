from __future__ import annotations

import threading
import time


class RequestMetrics:
    """In-memory, process-local HTTP request counters for the admin page.

    Reset on restart by design — this is a live health signal, not an audit
    log (token usage, by contrast, is persisted).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.started_at = time.time()
        self.total_requests = 0
        self.error_requests = 0
        self.total_latency_ms = 0.0

    def record(self, status_code: int, latency_ms: float) -> None:
        with self._lock:
            self.total_requests += 1
            if status_code >= 500:
                self.error_requests += 1
            self.total_latency_ms += latency_ms

    def snapshot(self) -> dict:
        with self._lock:
            total = self.total_requests
            errors = self.error_requests
            avg_latency = (self.total_latency_ms / total) if total else 0.0
        return {
            "uptime_seconds": time.time() - self.started_at,
            "total_requests": total,
            "error_requests": errors,
            "error_rate": (errors / total) if total else 0.0,
            "avg_latency_ms": avg_latency,
        }


request_metrics = RequestMetrics()
