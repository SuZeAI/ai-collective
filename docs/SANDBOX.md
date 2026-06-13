# Sandbox modes

The sandbox is where agent-issued shell commands and file operations run.
`SANDBOX_MODE` (in `config.yml › sandbox`, overridable via `.env`) selects
*how* and *where* that execution happens. There are **three** modes:

| Mode | Implementation | Where commands run | Isolation | Needs |
|------|----------------|--------------------|-----------|-------|
| `local` | `LocalSandboxAdapter` | Subprocess **inside the backend process** | None | `SANDBOX_WORKSPACE` (optional) |
| `docker` | `LocalContainerBackend` | One **Docker container per sandbox**, started by the backend | Container | Docker socket (`/var/run/docker.sock`) |
| `k8s` | `RemoteSandboxBackend` → provisioner | One **Pod per sandbox on k3s/Kubernetes** | Pod + NodePort | `SANDBOX_PROVISIONER_URL` + a running provisioner |

Selection happens in `backend/infrastructure/sandbox/factory.py`
(`local` → `LocalSandboxAdapter`; anything else → the provider, whose
`_create_backend` picks `RemoteSandboxBackend` for `k8s` and
`LocalContainerBackend` otherwise).

---

## `local` (default)

Runs each command as a subprocess on the same host as the backend, under
`SANDBOX_WORKSPACE` (defaults to `~/sandbox_workspace`). No containerization,
no isolation. Simplest option, intended for development.

```yaml
# config.yml
sandbox:
  SANDBOX_MODE: local
```

## `docker`

The backend starts its **own** AIO-sandbox Docker container per sandbox
(`docker run`, container name `<SANDBOX_CONTAINER_PREFIX>-<id>`), maps a free
host port starting from `SANDBOX_BASE_PORT`, and talks to the container's HTTP
API. A warm pool keeps released containers around (`SANDBOX_REPLICAS`,
`SANDBOX_IDLE_TIMEOUT`).

Requires the backend to have access to the Docker daemon. In Docker Compose
this means the Docker socket must be mounted into the backend container:
- **prod** (`docker/docker-compose.yaml`) mounts it → `docker` mode works.
- **dev** (`docker/docker-compose-dev.yaml`) does **not** mount it → only
  `local` and `k8s` are usable in the dev stack.

> The standalone `sandbox` Compose profile (the `sandbox` service) is **not**
> this mode. It is a separate, manually-started container for debugging and is
> not wired to any `SANDBOX_MODE` in the current code.

## `k8s`

The backend sends HTTP requests to the **provisioner**, which creates a Pod and
a NodePort Service on k3s/Kubernetes for each sandbox. Set:

```yaml
# config.yml
sandbox:
  SANDBOX_MODE: k8s
```
```dotenv
# .env
SANDBOX_PROVISIONER_URL=http://provisioner:8002   # backend running in Docker
# or http://localhost:8002 when the backend runs on the host
```

See **[K3S.md](./K3S.md)** for the full k3s setup.

---

## `k8s` is a mode — k3s and the provisioner are not modes

A common confusion: there is no `k3s` sandbox mode. The layering is:

```
SANDBOX_MODE=k8s          ← how the backend talks to sandboxes (RemoteSandboxBackend)
        │ HTTP
        ▼
   provisioner :8002       ← FastAPI service that manages Pod lifecycle
        │ Kubernetes API
        ▼
      k3s                  ← the Kubernetes distribution that actually runs the Pods
```

- **`k8s`** is the only sandbox mode in this triplet; it selects the
  `RemoteSandboxBackend`.
- The **provisioner** (`docker/provisioner/app.py`, default port `8002`) is a
  standalone service. In Compose it is the `provisioner` **profile** — start it
  with `make dev-provisioner` / `make prod-provisioner`.
- **k3s** is just the cluster hosting the Pods. The provisioner only matters
  when `SANDBOX_MODE=k8s`.

So `make dev-provisioner` starts **only** the provisioner (not the standalone
`sandbox` container) — the sandboxes themselves come up as k3s Pods.

### Pre-pulled images

The Pod spec uses `imagePullPolicy: IfNotPresent`, so an image you pre-pulled
into k3s with `sudo k3s ctr images pull <image>` (containerd namespace
`k8s.io`) is reused — no registry pull at Pod start. But `SKILLS_HOST_PATH` and
`THREADS_HOST_PATH` are **hostPath** mounts on the k3s node and must already
exist, otherwise Pods get stuck in `FailedMount`/`ContainerCreating`.

---

## Related config keys (`config.yml › sandbox` / `.env`)

| Key | Mode | Meaning |
|-----|------|---------|
| `SANDBOX_TIMEOUT` | all | Per-command timeout (seconds) |
| `SANDBOX_WORKSPACE` | local | Workspace dir for subprocess execution |
| `SANDBOX_IMAGE` | docker, k8s | AIO sandbox container image |
| `SANDBOX_BASE_PORT` | docker | First host port for sandbox containers |
| `SANDBOX_CONTAINER_PREFIX` | docker | Container name prefix |
| `SANDBOX_REPLICAS` | docker, k8s | Warm-pool size |
| `SANDBOX_IDLE_TIMEOUT` | docker, k8s | Seconds before an idle sandbox is destroyed |
| `SANDBOX_HOST` | docker | Host used to reach sandbox containers |
| `SANDBOX_PROVISIONER_URL` | k8s | URL of the provisioner service |
