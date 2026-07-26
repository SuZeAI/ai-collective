# Sandbox modes

The sandbox is where agent-issued shell commands and file operations run.
`sandbox.mode` in `config.yml` selects *how* and *where* that execution
happens (shipped as a literal `local`/`k8s` value, not a `${VAR}` reference —
edit `config.yml` directly to change it, `.env` has no effect unless you add
one yourself). There are **two** modes:

| Mode | Implementation | Where commands run | Isolation | Needs |
|------|----------------|--------------------|-----------|-------|
| `local` | `LocalSandboxAdapter` | Subprocess **inside the backend process** | None | `sandbox.workspace` (optional) |
| `k8s` | `RemoteSandboxBackend` → provisioner | One **Pod per sandbox on k3s/Kubernetes** | Pod + NodePort | `sandbox.provisioner_url` + a running provisioner |

Selection happens in `backend/infrastructure/sandbox/factory.py`
(`local` → `LocalSandboxAdapter`; anything else → `AioSandboxProvider`, which
requires `sandbox.mode=k8s` and raises otherwise).

---

## `local` (default)

Runs each command as a subprocess on the same host as the backend, under
`sandbox.workspace` (defaults to `~/sandbox_workspace`). No containerization,
no isolation. Simplest option, intended for development.

```yaml
# config.yml
sandbox:
  mode: local
```

## `k8s`

The backend sends HTTP requests to the **provisioner**, which creates a Pod and
a NodePort Service on k3s/Kubernetes for each sandbox. Set:

```yaml
# config.yml
sandbox:
  mode: k8s
  provisioner_url: http://provisioner:8002   # backend running in Docker
  # or http://localhost:8002 when the backend runs on the host
```

See **[K3S.md](./K3S.md)** for the full k3s setup.

---

## `k8s` is a mode — k3s and the provisioner are not modes

A common confusion: there is no `k3s` sandbox mode. The layering is:

```
sandbox.mode=k8s          ← how the backend talks to sandboxes (RemoteSandboxBackend)
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
  standalone service, configured via its own OS-level env vars (`SKILLS_HOST_PATH`,
  `THREADS_HOST_PATH`, `WORKSPACE_PVC_NAME` — read directly via `os.environ`,
  not through the backend's `config.yml`-based `Settings`). In Compose it is
  the `provisioner` **profile** — start it with `make dev-provisioner` /
  `make prod-provisioner`.
- **k3s** is just the cluster hosting the Pods. The provisioner only matters
  when `sandbox.mode=k8s`.

So `make dev-provisioner` starts **only** the provisioner (not the standalone
`sandbox` container) — the sandboxes themselves come up as k3s Pods.

### Pre-pulled images

The Pod spec uses `imagePullPolicy: IfNotPresent`, so an image you pre-pulled
into k3s with `sudo k3s ctr images pull <image>` (containerd namespace
`k8s.io`) is reused — no registry pull at Pod start. `SKILLS_HOST_PATH` and
`THREADS_HOST_PATH` are **hostPath** mounts on the k3s node; both use
`DirectoryOrCreate`, so a not-yet-existing path just mounts empty rather than
failing the Pod.

### Host-visible `/workspace`

Each Pod's `/workspace` — the same path sandbox tools and the backup/restore
push path already use inside the container — is hostPath-mounted (or PVC, if
`WORKSPACE_PVC_NAME` is set) at `{THREADS_HOST_PATH}/{thread_id}/workspace`.
An init container (`workspace-init`, running as root) `chmod -R 0777`s it
before the sandbox container starts, since kubelet creates hostPath dirs as
`root:root 0755` and the sandbox image runs as a non-root user. This makes
files agents write visible on the k3s node's filesystem live, in addition to
the MinIO push/restore path (which remains the only durable option when the
node doesn't share a filesystem with the backend, e.g. a real remote cluster).

---

## Related config keys

`config.yml › sandbox` (backend `Settings`, via `SandboxSettings`):

| Key | Mode | Meaning |
|-----|------|---------|
| `sandbox.timeout` | all | Per-command timeout (seconds) |
| `sandbox.workspace` | local | Workspace dir for subprocess execution |
| `sandbox.image` | k8s | AIO sandbox container image |
| `sandbox.replicas` | k8s | Warm-pool size |
| `sandbox.idle_timeout` | k8s | Seconds before an idle sandbox is destroyed |
| `sandbox.provisioner_url` | k8s | URL of the provisioner service |

Provisioner-only, read from OS env vars directly by `docker/provisioner/app.py`
(not part of the backend's `config.yml`/`Settings`, so `.env`'s `env_file`
wiring in Compose is what actually delivers them):

| Var | Mode | Meaning |
|-----|------|---------|
| `SKILLS_HOST_PATH` | k8s (provisioner) | hostPath on the k3s node mounted read-only at `/mnt/skills` |
| `THREADS_HOST_PATH` | k8s (provisioner) | hostPath on the k3s node under which each Pod's `/workspace` is mounted |
| `WORKSPACE_PVC_NAME` | k8s (provisioner) | Use a PVC instead of hostPath for `/workspace`, when set |
