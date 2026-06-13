# k3s Setup Guide for ai-collective Sandbox

How to run the `k8s` sandbox mode: sandboxes run as Pods on a local k3s
cluster, created on demand by the **provisioner** service. For how the modes
fit together, see **[SANDBOX.md](./SANDBOX.md)**.

```
backend ──HTTP──▸ provisioner :8002 ──k8s API──▸ k3s ──▸ sandbox Pod (+ NodePort)
   ▲                                                              │
   └──────────────── direct, NODE_HOST:NodePort ─────────────────┘
```

---

## Requirements

| | Minimum |
|---|---|
| OS | Ubuntu 20.04/22.04/24.04, Debian 10/11/12 |
| Disk | 10 GB+ (sandbox image is large) |
| Access | `sudo` or `root` |

---

## 1. Install k3s

```bash
curl -sfL https://get.k3s.io | sh -
```

Verify:

```bash
sudo systemctl status k3s
sudo k3s kubectl get nodes
# NAME        STATUS   ROLES                  AGE   VERSION
# your-host   Ready    control-plane,master   1m    v1.x+k3s1
```

---

## 2. Set up kubeconfig

k3s writes kubeconfig to `/etc/rancher/k3s/k3s.yaml` (root-only). Copy it for
your user:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER ~/.kube/config
chmod 600 ~/.kube/config

kubectl get nodes   # verify
```

The `server:` line in this file points at `https://127.0.0.1:6443`. That is
fine when the provisioner runs on the host, but **not** when it runs inside
Docker — see step 5.

---

## 3. Pre-pull the sandbox image (recommended)

The sandbox image is large (~1–3 GB). Pull it into k3s before first run so Pods
start fast (the Pod spec uses `imagePullPolicy: IfNotPresent`, so a pre-pulled
image is reused):

```bash
sudo k3s ctr images pull \
  enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest
```

> `k3s ctr` pulls into containerd namespace `k8s.io`, which is what the kubelet
> uses — that is why the Pod reuses it without contacting the registry.

The `ai-collective` namespace does **not** need to be created manually; the
provisioner creates it on startup (`K8S_NAMESPACE`, default `ai-collective`).

---

## 4. Configure the backend

In `config.yml`:

```yaml
sandbox:
  SANDBOX_MODE: k8s
```

In `.env`:

```dotenv
SANDBOX_PROVISIONER_URL=http://provisioner:8002   # backend runs in Docker (Compose)
# SANDBOX_PROVISIONER_URL=http://localhost:8002   # backend runs directly on the host
```

---

## 5. Run the provisioner

### Option A — via Docker Compose (recommended)

```bash
make dev-provisioner     # dev stack + provisioner only
# or: make prod-provisioner
```

Because the provisioner runs **inside a container**, it cannot reach k3s using
the kubeconfig's `127.0.0.1:6443`, and the backend container cannot reach
NodePorts via `localhost`. Set these in `.env` (defaults already wire
`host.docker.internal` to the host gateway via `extra_hosts`):

```dotenv
KUBECONFIG=/home/<user>/.kube/config              # absolute path to the kubeconfig FILE
K8S_API_SERVER=https://host.docker.internal:6443  # how the container reaches host k3s
NODE_HOST=host.docker.internal                    # how the backend reaches NodePorts
SKILLS_HOST_PATH=/abs/path/to/skills              # hostPath on the k3s node (must exist)
THREADS_HOST_PATH=/abs/path/to/backend/.ai-collective/threads
```

> Compose does not expand `~`, so `KUBECONFIG` must be an absolute path. It is
> mounted to `/root/.kube/config` inside the provisioner.

### Option B — directly on the host

```bash
cd docker/provisioner
export KUBECONFIG_PATH=$HOME/.kube/config
export K8S_NAMESPACE=ai-collective
export NODE_HOST=localhost
export SKILLS_HOST_PATH=/absolute/path/to/skills
export THREADS_HOST_PATH=/absolute/path/to/backend/.ai-collective/threads
uvicorn app:app --host 0.0.0.0 --port 8002
```

On the host, `127.0.0.1:6443` is reachable, so **do not** set `K8S_API_SERVER`,
and use `NODE_HOST=localhost`.

Verify either way:

```bash
curl http://localhost:8002/health        # {"status": "ok"}
curl http://localhost:8002/api/sandboxes  # {"sandboxes": [], "count": 0}
```

---

## 6. Verify the full flow

```bash
# Create a sandbox
curl -X POST http://localhost:8002/api/sandboxes \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id":"test-001","thread_id":"ai-collective"}'

# Watch the Pod come up
kubectl get pod -n ai-collective -w

# Check status, then clean up
curl http://localhost:8002/api/sandboxes/test-001
curl -X DELETE http://localhost:8002/api/sandboxes/test-001
```

---

## Troubleshooting

**Provisioner crash-loops: `No kubeconfig at /root/.kube/config`**

The kubeconfig is not mounted. With Compose, set `KUBECONFIG` to an **absolute**
path (compose does not expand `~`). Confirm it landed:
```bash
docker exec ai-collective-provisioner-dev grep server /root/.kube/config
```

**`/health` resets / k8s client init fails: `Service host/port is not set`**

The container is trying to reach `127.0.0.1:6443` (its own loopback). Set
`K8S_API_SERVER=https://host.docker.internal:6443` (the `extra_hosts` entry maps
`host.docker.internal` to the host gateway on Linux). Confirm k3s listens on the
host: `sudo ss -ltnp | grep 6443`.

**Pod stuck in `ContainerCreating` / `FailedMount`**

A `hostPath` (`SKILLS_HOST_PATH` / `THREADS_HOST_PATH`) does not exist on the
k3s node. Create the directories, or check:
```bash
kubectl describe pod -n ai-collective <pod-name>
```

**Pod stuck pulling the image**

Pre-pull it (step 3). With `imagePullPolicy: IfNotPresent` a pre-pulled image is
used without contacting the registry.

**Backend can't reach the sandbox (NodePort) even though the Pod is Running**

`NODE_HOST` is wrong. From a Dockerized backend use `host.docker.internal`
(with the `extra_hosts` host-gateway mapping); on the host use `localhost`. If
NodePorts are firewalled: `sudo ufw allow 30000:32767/tcp`.

---

## Uninstall

```bash
sudo /usr/local/bin/k3s-uninstall.sh
rm -rf ~/.kube
```
