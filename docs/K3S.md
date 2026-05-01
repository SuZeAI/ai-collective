# k3s Setup Guide for Automi Sandbox

End-to-end setup on Ubuntu/Debian without Docker.

---

## Requirements

| | Minimum |
|---|---|
| OS | Ubuntu 20.04/22.04/24.04, Debian 10/11/12 |
| Disk | 10 GB+ (sandbox image is large) |
| Python | 3.10+ |
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
# your-host   Ready    control-plane,master   1m    v1.29.x+k3s1
```

---

## 2. Set up kubeconfig

k3s writes kubeconfig to `/etc/rancher/k3s/k3s.yaml` (root-only). Copy it for your user:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER ~/.kube/config
chmod 600 ~/.kube/config

# Verify
kubectl get nodes
```

---

## 3. Create namespace

```bash
kubectl create namespace automi
```

---

## 4. Pre-pull sandbox image

The sandbox image is large (~1-3 GB). Pull it before running to avoid startup timeouts:

```bash
sudo k3s ctr images pull \
  enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest
```

---

## 5. Run the Provisioner

Install dependencies:

```bash
cd /path/to/AUTOCOPILOT/docker/provisioner
```

Set environment variables:

```bash
export KUBECONFIG_PATH=$HOME/.kube/config
export K8S_NAMESPACE=automi
export NODE_HOST=localhost
export SKILLS_HOST_PATH=/absolute/path/to/skills
export THREADS_HOST_PATH=/absolute/path/to/backend/.automi/threads
```

Note: No need to set `K8S_API_SERVER` when running directly on the host — `127.0.0.1:6443` is reachable without any override.

Start provisioner:

```bash
uvicorn app:app --host 0.0.0.0 --port 8002
```

Verify:

```bash
curl http://localhost:8002/health
# {"status": "ok"}

curl http://localhost:8002/api/sandboxes
# {"sandboxes": [], "count": 0}
```

---

## 6. Configure the Gateway

In `config.yaml`:

```yaml
sandbox:
  use: automi.community.aio_sandbox:AioSandboxProvider
  provisioner_url: http://localhost:8002
```

Note: Port `6443` is the k3s API server, not the provisioner.

Start gateway:

```bash
cd /path/to/AUTOCOPILOT/backend
PYTHONPATH=. uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001
```

---

## 7. Verify the Full Flow

```bash
# Create a sandbox
curl -X POST http://localhost:8002/api/sandboxes \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id":"test-001","thread_id":"automi"}'

# Watch pod come up
kubectl get pod -n automi -w

# Check sandbox status
curl http://localhost:8002/api/sandboxes/test-001

# Clean up
curl -X DELETE http://localhost:8002/api/sandboxes/test-001
```

---

## Troubleshooting

**Provisioner can't find kubeconfig**

`/root/.kube/config` is the root user path. Fix:
```bash
export KUBECONFIG_PATH=$HOME/.kube/config
```

**Pod stuck in `ContainerCreating`**

Usually the image is still being pulled. Check events:
```bash
kubectl describe pod -n automi <pod-name>
```
Pre-pull the image (step 4) to avoid this.

**Gateway: "failed to become ready within timeout"**

Same cause — image not ready yet. Pre-pull the image and restart.

**NodePort unreachable**
```bash
sudo ufw allow 30000:32767/tcp
```

---

## Uninstall

```bash
sudo /usr/local/bin/k3s-uninstall.sh
rm -rf ~/.kube
```
