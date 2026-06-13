"""Local container backend — manages sandbox containers using Docker on the local machine."""
from __future__ import annotations

import json
import logging
import os
import subprocess
from datetime import datetime
from typing import Optional

from backend.api.settings import settings
from .backend import SandboxBackend
from .sandbox_info import SandboxInfo

logger = logging.getLogger(__name__)

DEFAULT_CONTAINER_PREFIX = "ai-collective-sandbox"
DEFAULT_IMAGE = "enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest"
DEFAULT_BASE_PORT = 8080


def _parse_docker_timestamp(raw: str) -> float:
    """Parse Docker's ISO 8601 timestamp into a Unix epoch float."""
    if not raw:
        return 0.0
    try:
        s = raw.strip()
        if "." in s:
            dot_pos = s.index(".")
            tz_start = dot_pos + 1
            while tz_start < len(s) and s[tz_start].isdigit():
                tz_start += 1
            frac = s[dot_pos + 1: tz_start][:6]
            tz_suffix = s[tz_start:]
            s = s[: dot_pos + 1] + frac + tz_suffix
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s).timestamp()
    except (ValueError, TypeError) as e:
        logger.debug("Could not parse docker timestamp %r: %s", raw, e)
        return 0.0


def _get_free_port(start: int = DEFAULT_BASE_PORT) -> int:
    """Find a free TCP port starting from `start`."""
    import socket
    port = start
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("No free ports found")


class LocalContainerBackend(SandboxBackend):
    """Backend that manages sandbox containers locally using Docker."""

    def __init__(
        self,
        *,
        image: str = DEFAULT_IMAGE,
        base_port: int = DEFAULT_BASE_PORT,
        container_prefix: str = DEFAULT_CONTAINER_PREFIX,
        environment: Optional[dict[str, str]] = None,
    ):
        self._image = image
        self._base_port = base_port
        self._container_prefix = container_prefix
        self._environment = environment or {}

    # ── SandboxBackend interface ──────────────────────────────────────────────

    def create(
        self,
        thread_id: Optional[str],
        sandbox_id: str,
        extra_mounts: Optional[list[tuple[str, str, bool]]] = None,
    ) -> SandboxInfo:
        container_name = f"{self._container_prefix}-{sandbox_id}"
        next_port = self._base_port

        for _ in range(10):
            port = _get_free_port(start=next_port)
            try:
                container_id = self._start_container(container_name, port, extra_mounts)
                break
            except RuntimeError as exc:
                err = str(exc).lower()
                if "port is already allocated" in err or "address already in use" in err:
                    next_port = port + 1
                    continue
                if "already in use by container" in err or "conflict. the container name" in err:
                    existing = self.discover(sandbox_id)
                    if existing:
                        return existing
                raise
        else:
            raise RuntimeError("Could not start sandbox: all candidate ports are allocated")

        sandbox_host = settings.sandbox.host
        return SandboxInfo(
            sandbox_id=sandbox_id,
            sandbox_url=f"http://{sandbox_host}:{port}",
            container_name=container_name,
            container_id=container_id,
        )

    def destroy(self, info: SandboxInfo) -> None:
        stop_target = info.container_id or info.container_name
        if stop_target:
            try:
                subprocess.run(
                    ["docker", "stop", stop_target],
                    capture_output=True, text=True, check=True,
                )
                logger.info("Stopped container %s", stop_target)
            except subprocess.CalledProcessError as e:
                logger.warning("Failed to stop container %s: %s", stop_target, e.stderr)

    def is_alive(self, info: SandboxInfo) -> bool:
        if info.container_name:
            return self._is_container_running(info.container_name)
        return False

    def discover(self, sandbox_id: str) -> Optional[SandboxInfo]:
        container_name = f"{self._container_prefix}-{sandbox_id}"
        if not self._is_container_running(container_name):
            return None
        port = self._get_container_port(container_name)
        if port is None:
            return None
        sandbox_host = settings.sandbox.host
        return SandboxInfo(
            sandbox_id=sandbox_id,
            sandbox_url=f"http://{sandbox_host}:{port}",
            container_name=container_name,
        )

    def list_running(self) -> list[SandboxInfo]:
        try:
            result = subprocess.run(
                ["docker", "ps", "--filter", f"name={self._container_prefix}-", "--format", "{{.Names}}"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode != 0 or not result.stdout.strip():
                return []
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return []

        container_names = [
            name.strip() for name in result.stdout.strip().splitlines()
            if name.strip().startswith(self._container_prefix + "-")
        ]
        if not container_names:
            return []

        try:
            inspect_result = subprocess.run(
                ["docker", "inspect", *container_names],
                capture_output=True, text=True, timeout=15,
            )
            entries = json.loads(inspect_result.stdout or "[]")
        except Exception:
            return []

        infos: list[SandboxInfo] = []
        sandbox_host = settings.sandbox.host
        for entry in entries:
            name = (entry.get("Name") or "").lstrip("/")
            if not name.startswith(self._container_prefix + "-"):
                continue
            sandbox_id = name[len(self._container_prefix) + 1:]
            created_at = _parse_docker_timestamp(entry.get("Created", ""))
            host_port: Optional[int] = None
            try:
                ports = (entry.get("NetworkSettings") or {}).get("Ports") or {}
                bindings = ports.get("8080/tcp") or []
                if bindings:
                    host_port = int(bindings[0].get("HostPort", 0)) or None
            except (ValueError, TypeError, AttributeError):
                pass
            sandbox_url = f"http://{sandbox_host}:{host_port}" if host_port else ""
            infos.append(SandboxInfo(
                sandbox_id=sandbox_id,
                sandbox_url=sandbox_url,
                container_name=name,
                created_at=created_at,
            ))
        return infos

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _start_container(
        self,
        container_name: str,
        port: int,
        extra_mounts: Optional[list[tuple[str, str, bool]]] = None,
    ) -> str:
        cmd = [
            "docker", "run",
            "--security-opt", "seccomp=unconfined",
            "--rm", "-d",
            "-p", f"{port}:8080",
            "--name", container_name,
        ]
        for key, value in self._environment.items():
            cmd.extend(["-e", f"{key}={value}"])
        if extra_mounts:
            for host_path, container_path, read_only in extra_mounts:
                mount_spec = f"type=bind,src={host_path},dst={container_path}"
                if read_only:
                    mount_spec += ",readonly"
                cmd.extend(["--mount", mount_spec])
        cmd.append(self._image)

        logger.info("Starting sandbox container: %s", " ".join(cmd))
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to start sandbox container: {e.stderr}") from e

    def _is_container_running(self, container_name: str) -> bool:
        try:
            result = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Running}}", container_name],
                capture_output=True, text=True, timeout=5,
            )
            return result.returncode == 0 and result.stdout.strip().lower() == "true"
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return False

    def _get_container_port(self, container_name: str) -> Optional[int]:
        try:
            result = subprocess.run(
                ["docker", "port", container_name, "8080"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                return int(result.stdout.strip().split(":")[-1])
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError):
            pass
        return None
