"""Remote sandbox backend — delegates Pod lifecycle to the K8s/k3s provisioner service.

Architecture:
    ┌────────────┐  HTTP   ┌─────────────┐  K8s API  ┌──────────┐
    │  backend   │ ──────▶ │ provisioner │ ────────▶ │  k3s     │
    │  (this)    │         │   :8002     │           │  :6443   │
    └────────────┘         └─────────────┘           └────┬─────┘
                                                          │ creates
                           ┌─────────────┐          ┌─────▼──────┐
                           │   backend   │ ────────▶ │  sandbox  │
                           │             │  direct   │  Pod(s)   │
                           └─────────────┘ NodePort  └───────────┘
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import requests

from .backend import SandboxBackend
from .sandbox_info import SandboxInfo

logger = logging.getLogger(__name__)

# create_sandbox returns as soon as K8s allocates the NodePort — which can
# happen before the Pod's container has even started, let alone finished
# booting its internal HTTP server. Without waiting here, the *first*
# exec_command against a freshly created sandbox can race the container
# startup and get connection-refused (server not listening yet) or 404
# (server up but a subsystem, e.g. shell, not registered yet).
_READY_POLL_TIMEOUT_SECONDS = 30.0
_READY_POLL_INTERVAL_SECONDS = 1.0
# Extra buffer after the info endpoint first responds, since that alone
# doesn't guarantee every subsystem (e.g. shell/exec) has finished init.
_READY_GRACE_SECONDS = 1.5


class RemoteSandboxBackend(SandboxBackend):
    """Backend that delegates sandbox lifecycle to the K8s provisioner service.

    Configure with SANDBOX_PROVISIONER_URL pointing to the provisioner service
    that dynamically creates per-sandbox Pods + NodePort Services in k3s.
    """

    def __init__(self, provisioner_url: str):
        self._provisioner_url = provisioner_url.rstrip("/")

    @property
    def provisioner_url(self) -> str:
        return self._provisioner_url

    # ── SandboxBackend interface ──────────────────────────────────────────────

    def create(
        self,
        thread_id: Optional[str],
        sandbox_id: str,
        extra_mounts: Optional[list[tuple[str, str, bool]]] = None,
    ) -> SandboxInfo:
        """POST /api/sandboxes → create Pod + Service."""
        try:
            resp = requests.post(
                f"{self._provisioner_url}/api/sandboxes",
                json={"sandbox_id": sandbox_id, "thread_id": thread_id or sandbox_id},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Provisioner created sandbox %s: url=%s", sandbox_id, data["sandbox_url"])
            self._wait_until_reachable(data["sandbox_url"])
            return SandboxInfo(sandbox_id=sandbox_id, sandbox_url=data["sandbox_url"])
        except requests.RequestException as exc:
            raise RuntimeError(f"Provisioner create failed for {sandbox_id}: {exc}") from exc

    def _wait_until_reachable(self, sandbox_url: str) -> None:
        """Poll the sandbox's own info endpoint until it answers, or timeout.

        Best-effort: never raises. If the deadline is hit we still return and
        let the caller's first real request surface whatever is actually
        wrong, rather than turning a slow-but-fine boot into a hard failure.
        """
        deadline = time.monotonic() + _READY_POLL_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            try:
                resp = requests.get(f"{sandbox_url}/v1/sandbox", timeout=3)
                if resp.ok:
                    time.sleep(_READY_GRACE_SECONDS)
                    return
            except requests.RequestException:
                pass
            time.sleep(_READY_POLL_INTERVAL_SECONDS)
        logger.warning(
            "Sandbox at %s did not answer within %ss; proceeding anyway",
            sandbox_url, _READY_POLL_TIMEOUT_SECONDS,
        )

    def destroy(self, info: SandboxInfo) -> None:
        """DELETE /api/sandboxes/{id} → destroy Pod + Service."""
        try:
            resp = requests.delete(
                f"{self._provisioner_url}/api/sandboxes/{info.sandbox_id}",
                timeout=15,
            )
            if resp.ok:
                logger.info("Provisioner destroyed sandbox %s", info.sandbox_id)
            else:
                logger.warning("Provisioner destroy returned %s: %s", resp.status_code, resp.text)
        except requests.RequestException as exc:
            logger.warning("Provisioner destroy failed for %s: %s", info.sandbox_id, exc)

    def is_alive(self, info: SandboxInfo) -> bool:
        """GET /api/sandboxes/{id} → check Pod phase."""
        try:
            resp = requests.get(
                f"{self._provisioner_url}/api/sandboxes/{info.sandbox_id}",
                timeout=10,
            )
            if resp.ok:
                return resp.json().get("status") == "Running"
        except requests.RequestException:
            pass
        return False

    def discover(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """GET /api/sandboxes/{id} → discover existing sandbox."""
        try:
            resp = requests.get(
                f"{self._provisioner_url}/api/sandboxes/{sandbox_id}",
                timeout=10,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            return SandboxInfo(sandbox_id=sandbox_id, sandbox_url=data["sandbox_url"])
        except requests.RequestException as exc:
            logger.debug("Provisioner discover failed for %s: %s", sandbox_id, exc)
            return None

    def list_running(self) -> list[SandboxInfo]:
        """GET /api/sandboxes → list all running sandboxes from provisioner."""
        try:
            resp = requests.get(f"{self._provisioner_url}/api/sandboxes", timeout=10)
            resp.raise_for_status()
            return [
                SandboxInfo(sandbox_id=s["sandbox_id"], sandbox_url=s["sandbox_url"])
                for s in resp.json().get("sandboxes", [])
            ]
        except requests.RequestException as exc:
            logger.warning("Failed to list sandboxes from provisioner: %s", exc)
            return []
