# KubeLab - Kubernetes on Proxmox with GitOps

## 1. Overview

Final group project for the Virtualization course: Proxmox VE on a physical machine, 4 VMs running k3s, and a full platform (MetalLB, Traefik, NFS storage, API + web + PostgreSQL, Prometheus, Loki, Promtail, Grafana, HPA, GitHub Actions, Argo CD app of apps and Doppler) managed from this monorepo.

- **Group:** 6
- **Domain:** `grupo6.lab`
- **Traefik load balancer IP:** `10.10.10.200`
- **Repository:** `https://github.com/<owner>/kubelab` (public), branch `main`

| Member | Name | Responsibilities | Branches |
|---|---|---|---|
| L | `<full name>` | Proxmox, hotspot network, VMs, k3s, NFS server (sections 6, 7, 8) | `feat/infra-proxmox`, `feat/infra-k3s` |
| V | `<full name>` | API and web code, application manifests (section 9) | `feat/api`, `feat/web`, `feat/k8s-apps` |
| P | `<full name>` | CI pipelines, Argo CD, Doppler, read-only users (sections 10, 11, 16) | `ci/pipelines`, `feat/argocd`, `feat/doppler` |
| R | `<full name>` | Platform, observability, teacher access (sections 12, 13, 16) | `feat/platform`, `feat/observability`, `docs/access` |
| All | - | Evidence, README, defense (sections 15, 17) | `docs/*` |

| Domain | Service |
|---|---|
| `app.grupo6.lab` | Web (React + nginx) |
| `api.grupo6.lab` | API (Node.js + Express) |
| `db.grupo6.lab` | PostgreSQL (TCP 5432) |
| `grafana.grupo6.lab` | Grafana |
| `prometheus.grupo6.lab` | Prometheus |
| `argocd.grupo6.lab` | Argo CD |

## 2. Architecture

### 2.1 Diagram

```
                              Internet
                                 ^
                                 | mobile data
                  +--------------+---------------+
                  | Android phone hotspot        |
                  | SSID kubelab-grupo6 (WPA2)   |
                  | variable subnet (DHCP)       |
                  +-------+---------------+------+
                          | WiFi          | WiFi
                          |               |
+-------------------------+--+   +--------+-------------------------------------+
| Teacher / team laptop      |   | Proxmox VE 9.2 (pve.grupo6.lab)              |
| hosts: *.grupo6.lab ->     |   |   <wifi_iface>  <IP_WIFI_PROXMOX> (DHCP)     |
|   <IP_WIFI_PROXMOX>        +-->|        |  DNAT in: 80, 5432 -> 10.10.10.200  |
| team only: SSH ProxyJump   |   |        |  NAT out: MASQUERADE                |
|   through the Proxmox host |   |   vmbr0 10.10.10.1/24 (bridge-ports none)    |
|                            |   |   NFS server /srv/nfs/kubelab                |
+----------------------------+   +--------+-------------------------------------+
                                          | 10.10.10.0/24 (no DHCP)
        +------------------+--------------+---+------------------+
        |                  |                  |                  |
  +-----+--------+   +-----+--------+   +-----+--------+   +-----+--------+
  | k3s-cp-01    |   | k3s-worker-01|   | k3s-worker-02|   | k3s-worker-03|
  | 10.10.10.11  |   | 10.10.10.21  |   | 10.10.10.22  |   | 10.10.10.23  |
  | NoSchedule   |   |              |   |              |   |              |
  +--------------+   +--------------+   +--------------+   +--------------+
                                 |
               MetalLB L2 (pool 10.10.10.200-10.10.10.220)
                                 |
               Traefik LoadBalancer 10.10.10.200 (:80 web, :5432 postgres)
                                 |
   +-----------------------------+------------------------------------------------+
   | IngressRoute    app.grupo6.lab         -> web:8080              (kubelab)    |
   | IngressRoute    api.grupo6.lab         -> api:3000              (kubelab)    |
   | IngressRouteTCP db.grupo6.lab:5432     -> postgres:5432         (kubelab)    |
   | IngressRoute    grafana.grupo6.lab     -> grafana:80            (monitoring) |
   | IngressRoute    prometheus.grupo6.lab  -> prometheus-server:80  (monitoring) |
   | IngressRoute    argocd.grupo6.lab      -> argocd-server:80      (argocd)     |
   +------------------------------------------------------------------------------+

Outside the cluster:

  developer laptop --PR / merge--> GitHub <owner>/kubelab (main)
                                          |
                                          v
                     GitHub Actions: test (Doppler config ci), build, push
                          |                                   |
                          v                                   v
  GHCR ghcr.io/<owner>/kubelab-{api,web}:<short-sha>   commit "ci(...): deploy image <short-sha>" to main

  Argo CD (in cluster)  --pulls main every 60s-->  GitHub <owner>/kubelab
  k3s nodes             --pull images----------->  GHCR

  Doppler project kubelab:
    config ci  --> GitHub Actions (dopplerhq/secrets-fetch-action)
    config prd --> Doppler Operator (in cluster) --> Kubernetes Secrets
```

### 2.2 Environment

| Component | Version / Value |
|---|---|
| Hardware | 1 physical machine, 6 GB RAM (5.7 GiB usable), 4 vCPU, 465 GB disk |
| Hypervisor | Proxmox VE 9.2 (ISO `proxmox-ve_9.2-1.iso`), repository `pve-no-subscription` (Debian trixie) |
| VM template | Ubuntu 24.04 cloud image `release-20261017` |
| Kubernetes | k3s `v1.36.5+k3s1` (without bundled traefik, servicelb, local-storage, metrics-server) |
| Argo CD | v3.5.6 (`install.yaml`, namespace `argocd`) |
| MetalLB | chart `metallb/metallb` 0.16.1 (L2, `frrk8s.enabled: false`) |
| Traefik | chart `traefik/traefik` 41.7.1 (Traefik v3.7.14) |
| NFS provisioner | chart `nfs-subdir-external-provisioner` 4.0.18 (image v4.0.2), StorageClass `nfs-client` (default) |
| metrics-server | chart 3.14.0 (v0.9.0) |
| Doppler Operator | chart `doppler/doppler-kubernetes-operator` 1.7.5 |
| Prometheus | chart `prometheus-community/prometheus` 29.37.0 |
| Loki | chart `grafana-community/loki` 18.15.1 (Monolithic) |
| Promtail | chart `grafana/promtail` 6.17.1 (image `grafana/promtail:3.6.11`) |
| Grafana | chart `grafana-community/grafana` 13.7.0 |
| Base images | `node:24.22.2-alpine`, `nginxinc/nginx-unprivileged:1.30.6-alpine`, `postgres:17.11-alpine` |
| API dependencies | `express@5`, `pg@8`, `prom-client@15`, dev `supertest` |
| Web | React (Vite), dev `vitest` |
| Package manager | pnpm 12.16.1 |
| Registry | GHCR `ghcr.io/<owner>/kubelab-api`, `ghcr.io/<owner>/kubelab-web` (public), tag = 7-char commit SHA |
| CI actions | `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `docker/login-action@v4`, `docker/setup-buildx-action@v4`, `docker/build-push-action@v7`, `dopplerhq/secrets-fetch-action@v2.0.0` |
| Secrets | Doppler project `kubelab`, configs `prd` (cluster) and `ci` (pipeline) |
| Load test | k6 1.8.2 (`grafana/k6:1.8.2`) |
| Helm (validation only) | v4.3.1 |

Namespaces: `argocd`, `metallb-system`, `traefik`, `nfs-provisioner`, `doppler-operator-system`, `kube-system` (metrics-server), `monitoring`, `kubelab` (api, web, postgres).

## 3. Node Inventory and Network

| VM ID | Name | IP | vCPU | RAM | Disk | Role |
|---|---|---|---|---|---|---|
| 9000 | ubuntu-2404-template | - | 2 | 2048 MB | 3.5 GB | template |
| 101 | k3s-cp-01 | 10.10.10.11 | 2 | 1280 MB | 25 GB | control plane (taint) |
| 111 | k3s-worker-01 | 10.10.10.21 | 2 | 1152 MB | 40 GB | worker |
| 112 | k3s-worker-02 | 10.10.10.22 | 2 | 1152 MB | 40 GB | worker |
| 113 | k3s-worker-03 | 10.10.10.23 | 2 | 1152 MB | 40 GB | worker |

| Network item | Value |
|---|---|
| Hotspot | Android, SSID `kubelab-grupo6` (WPA2), variable subnet |
| Proxmox WiFi | `<wifi_iface>`, DHCP from the hotspot (`<IP_WIFI_PROXMOX>`) |
| Cluster subnet | `10.10.10.0/24` on `vmbr0` (internal bridge, no DHCP) |
| Gateway | `10.10.10.1` (Proxmox host, NAT to the WiFi) |
| Published services | DNAT on the Proxmox WiFi address: ports 80 and 5432 are forwarded to Traefik (`10.10.10.200`) |
| DNS | `1.1.1.1 8.8.8.8` |
| Node IPs | `10.10.10.11`, `10.10.10.21-23` (static, cloud-init) |
| MetalLB pool | `10.10.10.200-10.10.10.220` (reserved, `autoAssign: false`) |
| Traefik | `10.10.10.200` |
| NFS server | `10.10.10.1:/srv/nfs/kubelab` |

![Proxmox web UI](docs/proxmox-web-ui.png)

![Proxmox VMs](docs/proxmox-vms.png)

![VM hardware and Cloud-Init](docs/proxmox-vm-hardware.png)

## 4. Repository Structure

```
.
├── README.md
├── .gitignore                      node_modules, dist, *.kubeconfig, .env
├── apps/
│   ├── api/                        package.json, pnpm-lock.yaml, Dockerfile, .dockerignore, src/, test/
│   └── web/                        package.json, pnpm-lock.yaml, Dockerfile, nginx.conf, index.html, vite.config.js, src/, test/
├── infra/
│   ├── proxmox/
│   │   ├── interfaces.example
│   │   ├── authorized_keys
│   │   ├── nfs-exports
│   │   ├── create-template.sh
│   │   ├── create-vms.sh
│   │   └── cloud-init/kubelab-vendor.yaml
│   └── k3s/
│       ├── server-config.yaml
│       ├── agent-config-worker-01.yaml
│       ├── agent-config-worker-02.yaml
│       ├── agent-config-worker-03.yaml
│       ├── install-server.sh
│       └── install-agent.sh
├── k8s/
│   ├── argocd/
│   │   ├── install/                kustomization.yaml, namespace.yaml, install.yaml, argocd-cm.yaml,
│   │   │                           argocd-cmd-params-cm.yaml, argocd-rbac-cm.yaml
│   │   ├── routes/ingressroute.yaml
│   │   ├── root.yaml
│   │   └── apps/                   namespaces.yaml, metallb.yaml, nfs-provisioner.yaml, metrics-server.yaml,
│   │                               doppler-operator.yaml, metallb-config.yaml, doppler-secrets.yaml,
│   │                               traefik.yaml, argocd.yaml, argocd-routes.yaml, database.yaml,
│   │                               prometheus.yaml, loki.yaml, promtail.yaml, grafana.yaml,
│   │                               observability-routes.yaml, api.yaml, web.yaml
│   ├── platform/
│   │   ├── namespaces/             kubelab.yaml, monitoring.yaml
│   │   ├── metallb/values.yaml
│   │   ├── metallb-config/         ipaddresspool.yaml, l2advertisement.yaml
│   │   ├── traefik/values.yaml
│   │   ├── nfs-provisioner/values.yaml
│   │   ├── metrics-server/values.yaml
│   │   ├── doppler-operator/values.yaml
│   │   └── doppler-secrets/        postgres.yaml, api.yaml, grafana.yaml
│   ├── apps/
│   │   ├── database/               kustomization.yaml, statefulset.yaml, services.yaml, ingressroutetcp.yaml,
│   │   │                           init-job.yaml, migrations/001_create_products.sql, migrations/002_readonly_role.sql
│   │   ├── api/                    kustomization.yaml, deployment.yaml, service.yaml, hpa.yaml, pdb.yaml, ingressroute.yaml
│   │   └── web/                    kustomization.yaml, deployment.yaml, service.yaml, hpa.yaml, pdb.yaml, ingressroute.yaml
│   └── observability/
│       ├── prometheus/values.yaml
│       ├── loki/values.yaml
│       ├── promtail/values.yaml
│       ├── grafana/
│       │   ├── values.yaml
│       │   └── manifests/          kustomization.yaml, kubelab-overview.json, viewer-user-job.yaml
│       └── routes/                 grafana.yaml, prometheus.yaml, kustomization.yaml
├── loadtest/api-load.js
├── .github/workflows/              api.yml, web.yml
└── docs/                           hosts.txt, proxmox.md, cluster.md, access.md, doppler.md, ia.md, *.png
```

## 5. Rebuild from Scratch

Ordered checklist. Everything after step 8 is applied by Argo CD from this repository.

| Step | Action | Section |
|---|---|---|
| 1 | Configure the hotspot and test client-to-client ping | 6.1 |
| 2 | Install Proxmox VE 9.2, repositories and packages | 7.1, 7.2 |
| 3 | Configure the routed network with DNAT (`/etc/network/interfaces`) and team SSH access | 6.2, 6.3, 6.4 |
| 4 | Create the cloud-init template and the 4 VMs | 7.3 - 7.5 |
| 5 | Install k3s (server and 3 agents) and the NFS server on the host | 8 |
| 6 | Create the Doppler project, configs `prd` and `ci`, and the GitHub secret `DOPPLER_TOKEN` | 11.1, 11.2 |
| 7 | Bootstrap Argo CD and apply the root Application | 10.3, 10.4 |
| 8 | Create the Doppler service token Secret (after Argo CD creates `doppler-operator-system`) | 11.3 |
| 9 | Wait until all Applications are `Synced` and `Healthy` | 10.5 |
| 10 | Set the Argo CD read-only password and publish the GHCR packages | 16.3, 10.1 |

The only manual `kubectl` commands in the whole project:

```bash
kubectl apply --server-side --force-conflicts -k k8s/argocd/install
kubectl wait -n argocd --for=condition=Ready pod --all --timeout=300s
kubectl apply -f k8s/argocd/root.yaml

read -rs DOPPLER_SERVICE_TOKEN
kubectl create secret generic doppler-token-secret -n doppler-operator-system \
  --from-literal=serviceToken="$DOPPLER_SERVICE_TOKEN"
unset DOPPLER_SERVICE_TOKEN
```

```bash
kubectl get applications -n argocd
```

## 6. Network and Team Access

### 6.1 Hotspot

| Setting | Value |
|---|---|
| SSID | `kubelab-grupo6` |
| Security | WPA2 (password shared in person) |
| Auto turn-off | Disabled |
| Mobile data | On, phone charging |

From two laptops connected to the hotspot:

```bash
ping <other_laptop_ip>
```

![Ping between two hotspot clients](docs/hotspot-ping.png)

### 6.2 Routed Network on the Proxmox Host

`/etc/network/interfaces` (reference without the WiFi key: [infra/proxmox/interfaces.example](infra/proxmox/interfaces.example)):

```
auto lo
iface lo inet loopback

iface <nic_ethernet> inet manual

auto <wifi_iface>
iface <wifi_iface> inet dhcp
    wpa-ssid kubelab-grupo6
    wpa-psk <HOTSPOT_PSK_HEX>
    post-up iw dev <wifi_iface> set power_save off

auto vmbr0
iface vmbr0 inet static
    address 10.10.10.1/24
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    post-up   echo 1 > /proc/sys/net/ipv4/ip_forward
    post-up   iptables -t nat -A POSTROUTING -s 10.10.10.0/24 -o <wifi_iface> -j MASQUERADE
    post-down iptables -t nat -D POSTROUTING -s 10.10.10.0/24 -o <wifi_iface> -j MASQUERADE
    post-up   iptables -t nat -A PREROUTING -i <wifi_iface> -m addrtype --dst-type LOCAL -p tcp -m multiport --dports 80,5432 -j DNAT --to-destination 10.10.10.200
    post-down iptables -t nat -D PREROUTING -i <wifi_iface> -m addrtype --dst-type LOCAL -p tcp -m multiport --dports 80,5432 -j DNAT --to-destination 10.10.10.200
```

Generate `<HOTSPOT_PSK_HEX>` on the host (copy only the `psk=` line without quotes; it stays only on the host):

```bash
wpa_passphrase kubelab-grupo6
```

Apply (disconnect USB tethering first):

```bash
ifreload -a
ip -4 addr show <wifi_iface>
ip route
ping -c3 1.1.1.1
ip -br addr
iptables -t nat -S POSTROUTING
iptables -t nat -S PREROUTING
```

The Proxmox firewall stays disabled. Proxmox UI: `https://<IP_WIFI_PROXMOX>:8006` from any laptop on the hotspot.

![Proxmox routed network](docs/proxmox-network.png)

### 6.3 Service Publishing with DNAT

The teacher only consumes services, so no laptop needs a route to `10.10.10.0/24`. The Proxmox host forwards the ports of Traefik that arrive on its WiFi address to the MetalLB IP `10.10.10.200`. The rules are the two `PREROUTING` lines of the `vmbr0` block in section 6.2.

| Port | Forwarded to | Used by |
|---|---|---|
| 80 | `10.10.10.200:80` (Traefik `web`) | `app`, `api`, `grafana`, `prometheus` and `argocd` |
| 5432 | `10.10.10.200:5432` (Traefik `postgres`) | `db.grupo6.lab` (IngressRouteTCP) |

- `-i <wifi_iface>`: only traffic entering through the hotspot WiFi.
- `-m addrtype --dst-type LOCAL`: only packets addressed to the Proxmox host itself, so the rule does not depend on the hotspot subnet.
- Ports 22 and 8006 are not forwarded: they stay with the Proxmox host. Port 443 is not published because the `websecure` entrypoint is disabled (section 12.3).
- The `Host` header is not changed: Traefik still chooses the service by the domain the browser requested.

`<IP_WIFI_PROXMOX>` changes when the hotspot is restarted: read it again on the host with `ip -br addr show <wifi_iface>`. The rules keep working; only [docs/hosts.txt](docs/hosts.txt) and the `HostName` of `kubelab-pve` in each `~/.ssh/config` are updated.

```bash
iptables -t nat -S PREROUTING
iptables -t nat -L PREROUTING -v -n
```

From a laptop on the hotspot, once Traefik is running (section 12.3):

```bash
curl -i http://<IP_WIFI_PROXMOX>
```

![Proxmox DNAT and MASQUERADE rules](docs/proxmox-dnat.png)

### 6.4 Team SSH Access

No static route is used. Each member enters the Proxmox host with their own user and key, and jumps from there to the VMs (`ProxyJump`).

Each member (L, V, P) creates a lab key on their own laptop (different from the GitHub key), checks it and sends only the public key line to R:

```bash
ssh-keygen -t ed25519 -C "<initial>@kubelab" -f ~/.ssh/kubelab_ed25519
cat ~/.ssh/kubelab_ed25519.pub
ssh-keygen -l -f ~/.ssh/kubelab_ed25519.pub
```

The host key is generated once (the private key never leaves the host):

```bash
ssh-keygen -t ed25519 -f /root/.ssh/kubelab -N ""
```

On the host, one file per member is stored and validated (4 fingerprints expected):

```bash
mkdir -p /root/kubelab-setup/keys
nano /root/kubelab-setup/keys/l.pub
nano /root/kubelab-setup/keys/v.pub
nano /root/kubelab-setup/keys/p.pub
grep 'racm@kubelab' /root/kubelab-setup/authorized_keys > /root/kubelab-setup/keys/r.pub
for member in l v p r; do ssh-keygen -l -f /root/kubelab-setup/keys/$member.pub; done
```

The keys of L, V and P are added to the 4 existing VMs without duplicating lines, and to the template for future VMs:

```bash
cat /root/kubelab-setup/keys/{l,v,p}.pub > /root/kubelab-setup/team_keys.pub
for ip in 10.10.10.11 10.10.10.21 10.10.10.22 10.10.10.23; do
  ssh -i /root/.ssh/kubelab ubuntu@$ip 'cat >> ~/.ssh/authorized_keys && sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys' < /root/kubelab-setup/team_keys.pub
done

cat /root/kubelab-setup/team_keys.pub >> /root/kubelab-setup/authorized_keys
sort -u /root/kubelab-setup/authorized_keys -o /root/kubelab-setup/authorized_keys
ssh-keygen -l -f /root/kubelab-setup/authorized_keys
qm set 9000 --sshkeys /root/kubelab-setup/authorized_keys
```

The 5 public keys (host plus 4 members) are stored in [infra/proxmox/authorized_keys](infra/proxmox/authorized_keys). Private keys never leave each laptop.

One Linux user per member on the Proxmox host (traceability in `/var/log/auth.log`):

```bash
apt install -y sudo
for member in l v p r; do
  adduser --disabled-password --gecos "" "$member"
  usermod -aG sudo "$member"
  install -d -m 700 -o "$member" -g "$member" /home/$member/.ssh
  install -m 600 -o "$member" -g "$member" /root/kubelab-setup/keys/$member.pub /home/$member/.ssh/authorized_keys
done
passwd <initial>
```

Each member chooses their own `sudo` password in person.

After every member logs in with their key, `/etc/ssh/sshd_config.d/kubelab.conf`:

```
PasswordAuthentication no
PermitRootLogin prohibit-password
```

```bash
systemctl reload ssh
```

Proxmox UI users (one per member):

```bash
pveum user add <initial>@pve
pveum passwd <initial>@pve
pveum acl modify / --users <initial>@pve --roles PVEAdmin
```

`~/.ssh/config` on each laptop (Windows: `C:\Users\<user>\.ssh\config`):

```
Host kubelab-pve
    HostName <IP_WIFI_PROXMOX>
    User <initial>
    IdentityFile ~/.ssh/kubelab_ed25519

Host kubelab-cp
    HostName 10.10.10.11
    User ubuntu
    ProxyJump kubelab-pve
    IdentityFile ~/.ssh/kubelab_ed25519

Host kubelab-worker-01
    HostName 10.10.10.21
    User ubuntu
    ProxyJump kubelab-pve
    IdentityFile ~/.ssh/kubelab_ed25519

Host kubelab-worker-02
    HostName 10.10.10.22
    User ubuntu
    ProxyJump kubelab-pve
    IdentityFile ~/.ssh/kubelab_ed25519

Host kubelab-worker-03
    HostName 10.10.10.23
    User ubuntu
    ProxyJump kubelab-pve
    IdentityFile ~/.ssh/kubelab_ed25519
```

```bash
ssh kubelab-pve hostname
ssh kubelab-cp hostname
ssh kubelab-worker-01 hostname
scp <file> kubelab-cp:~/
```

Expected: `pve`, `k3s-cp-01` and `k3s-worker-01`. When the hotspot changes the Proxmox IP, only `HostName` of `kubelab-pve` is updated.

### 6.5 kubectl from a Laptop

The kubeconfig is an admin credential: never committed (`*.kubeconfig` is in `.gitignore`) or shared by chat. It is used through an SSH tunnel, so the kubeconfig keeps `server: https://127.0.0.1:6443` (k3s includes `127.0.0.1` in its certificate).

```bash
scp kubelab-cp:/etc/rancher/k3s/k3s.yaml ~/.kube/kubelab.kubeconfig
```

Tunnel in another terminal, open while `kubectl` is used:

```bash
ssh -N -L 6443:10.10.10.11:6443 kubelab-pve
```

```bash
export KUBECONFIG=~/.kube/kubelab.kubeconfig
kubectl get nodes
```

Code and YAML are edited on the laptops and reach the cluster through PR + Argo CD. SSH to the servers is only for infrastructure (sections 7 and 8), diagnostics and read-only `kubectl get/describe/logs`.

![Team SSH and kubectl access](docs/team-ssh-access.png)

### 6.6 Team Git Workflow

Each member works from their own laptop and GitHub account (never from the Proxmox host or the VMs):

```bash
ssh-keygen -t ed25519 -C "<github_user>@github" -f ~/.ssh/github_ed25519
# Add ~/.ssh/github_ed25519.pub in GitHub: Settings, SSH and GPG keys
git clone git@github.com:<owner>/kubelab.git
cd kubelab
git config user.name "<Full Name>"
git config user.email "<GitHub account email>"
echo "PLAN.md" >> .git/info/exclude
```

Per task:

```bash
git switch main && git pull
git switch -c feat/<task>
git push -u origin feat/<task>
```

- Small Conventional Commits; PR to `main` reviewed by another member.
- Merge with "Create a merge commit" or "Rebase and merge". No "Squash and merge" (keeps individual authorship).
- Before each session: `git pull` on `main` and `git rebase main` on the own branch (the pipeline commits image tags to `main`).

### 6.7 MetalLB Pool and Traefik IP

The range `10.10.10.200-10.10.10.220` is reserved for MetalLB (no DHCP in `10.10.10.0/24`). Traefik requests `10.10.10.200` (section 12.3).

```bash
kubectl get ipaddresspool,l2advertisement -n metallb-system
kubectl get svc -n traefik
```

On the Proxmox host (`10.10.10.200` is only reachable from the internal network):

```bash
curl -i http://10.10.10.200
```

![Traefik LoadBalancer Service](docs/traefik-loadbalancer.png)

## 7. Proxmox and VMs

### 7.1 Installation

| Setting | Value |
|---|---|
| ISO | `proxmox-ve_9.2-1.iso` (SHA256 checked against the download page) |
| Disk | Full disk, default ext4/LVM (LVM-thin `local-lvm`) |
| Country / time zone | `America/Guatemala` |
| Hostname | `pve.grupo6.lab` |
| Installer network | Ethernet NIC, `10.10.10.1/24`, gateway `10.10.10.254`, DNS `1.1.1.1` (replaced in 6.2) |

If the machine has no Ethernet NIC, USB tethering from the phone is used during installation.

### 7.2 Repositories and Packages

Temporary internet over USB tethering:

```bash
ip -br link
dhclient -v <usb_iface>
sed -i 's/^Enabled: yes/Enabled: no/' /etc/apt/sources.list.d/pve-enterprise.sources 2>/dev/null || true
cat /etc/apt/sources.list.d/*.sources
```

`/etc/apt/sources.list.d/proxmox.sources` (also disable `ceph.sources` if it points to enterprise):

```
Types: deb
URIs: http://download.proxmox.com/debian/pve
Suites: trixie
Components: pve-no-subscription
Signed-By: /usr/share/keyrings/proxmox-archive-keyring.gpg
```

```bash
apt update && apt full-upgrade -y && apt install -y wpasupplicant iw nfs-kernel-server git
pveversion
iw dev
```

### 7.3 Cloud-init Snippet

[infra/proxmox/cloud-init/kubelab-vendor.yaml](infra/proxmox/cloud-init/kubelab-vendor.yaml):

```yaml
#cloud-config
timezone: America/Guatemala
package_update: true
packages:
  - qemu-guest-agent
  - nfs-common
runcmd:
  - systemctl enable --now qemu-guest-agent
```

```bash
cp /root/kubelab/infra/proxmox/cloud-init/kubelab-vendor.yaml /var/lib/vz/snippets/
pvesm set local --content iso,vztmpl,backup,snippets
```

### 7.4 Template

On the host (the repository is cloned read-only; nothing is committed from the host):

```bash
git clone https://github.com/<owner>/kubelab.git /root/kubelab
```

[infra/proxmox/create-template.sh](infra/proxmox/create-template.sh):

```bash
#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_ID=9000
IMAGE_URL=https://cloud-images.ubuntu.com/releases/noble/release-20261017/ubuntu-24.04-server-cloudimg-amd64.img
IMAGE_FILE=/var/lib/vz/template/ubuntu-24.04-server-cloudimg-amd64.img
SSH_PUBLIC_KEYS=/root/kubelab/infra/proxmox/authorized_keys

wget -O "$IMAGE_FILE" "$IMAGE_URL"

qm create "$TEMPLATE_ID" --name ubuntu-2404-template --ostype l26 \
  --memory 2048 --cores 2 --cpu host \
  --net0 virtio,bridge=vmbr0 \
  --scsihw virtio-scsi-single --agent enabled=1 \
  --serial0 socket --vga serial0
qm set "$TEMPLATE_ID" --scsi0 "local-lvm:0,import-from=${IMAGE_FILE}"
qm set "$TEMPLATE_ID" --ide2 local-lvm:cloudinit --boot order=scsi0
qm set "$TEMPLATE_ID" --ciuser ubuntu --sshkeys "$SSH_PUBLIC_KEYS" \
  --nameserver "1.1.1.1 8.8.8.8" --searchdomain grupo6.lab \
  --cicustom "vendor=local:snippets/kubelab-vendor.yaml"
qm template "$TEMPLATE_ID"
```

```bash
cd /root/kubelab
bash infra/proxmox/create-template.sh
```

Verify the image checksum against `SHA256SUMS` in `https://cloud-images.ubuntu.com/releases/noble/release-20261017/`.

### 7.5 VMs

[infra/proxmox/create-vms.sh](infra/proxmox/create-vms.sh):

```bash
#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_ID=9000
GATEWAY=10.10.10.1

create_vm() {
  local vm_id=$1 name=$2 ip_address=$3 cores=$4 memory_mb=$5 balloon_mb=$6 disk_size=$7
  qm clone "$TEMPLATE_ID" "$vm_id" --name "$name" --full
  qm set "$vm_id" --cores "$cores" --memory "$memory_mb" --balloon "$balloon_mb" --onboot 1 \
    --ipconfig0 "ip=${ip_address}/24,gw=${GATEWAY}"
  qm resize "$vm_id" scsi0 "$disk_size"
  qm start "$vm_id"
}

create_vm 101 k3s-cp-01     10.10.10.11 2 1280 1024 25G
create_vm 111 k3s-worker-01 10.10.10.21 2 1152 896 40G
create_vm 112 k3s-worker-02 10.10.10.22 2 1152 896 40G
create_vm 113 k3s-worker-03 10.10.10.23 2 1152 896 40G
```

```bash
bash infra/proxmox/create-vms.sh
qm list
ssh -i /root/.ssh/kubelab ubuntu@10.10.10.21 'hostname; ip -4 -br addr; ping -c1 1.1.1.1; cloud-init status'
```

Repeat the last command for `10.10.10.11`, `.22` and `.23` (expected `status: done`). Screenshots of the VMs: section 3.

## 8. Kubernetes Distribution (k3s)

### 8.1 Why k3s

- CNCF-certified Kubernetes distribution in a single binary.
- About 500 MB less RAM per node than kubeadm (important on a 6 GB host).
- Server install and worker join with one command each.
- containerd and flannel included.
- Bundled Traefik, ServiceLB, local-path and metrics-server are disabled; our own versions are installed from this repository by Argo CD.

Details: [docs/cluster.md](docs/cluster.md).

### 8.2 Control Plane

[infra/k3s/server-config.yaml](infra/k3s/server-config.yaml) (copied to `/etc/rancher/k3s/config.yaml`):

```yaml
node-ip: 10.10.10.11
tls-san:
  - 10.10.10.11
  - k3s-cp-01
write-kubeconfig-mode: "0644"
disable:
  - traefik
  - servicelb
  - local-storage
  - metrics-server
node-taint:
  - node-role.kubernetes.io/control-plane=true:NoSchedule
```

[infra/k3s/install-server.sh](infra/k3s/install-server.sh):

```bash
#!/usr/bin/env bash
set -euo pipefail
sudo mkdir -p /etc/rancher/k3s
sudo cp server-config.yaml /etc/rancher/k3s/config.yaml
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.5+k3s1 sh -s - server
```

```bash
scp -r infra/k3s kubelab-cp:~/
ssh kubelab-cp
cd ~/k3s && bash install-server.sh
sudo k3s kubectl get nodes
```

### 8.3 Workers

[infra/k3s/agent-config-worker-01.yaml](infra/k3s/agent-config-worker-01.yaml) (`-02` uses `10.10.10.22`, `-03` uses `10.10.10.23`):

```yaml
server: https://10.10.10.11:6443
node-ip: 10.10.10.21
```

[infra/k3s/install-agent.sh](infra/k3s/install-agent.sh):

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${K3S_TOKEN:?export K3S_TOKEN first}"
CONFIG_FILE=$1
sudo mkdir -p /etc/rancher/k3s
sudo cp "$CONFIG_FILE" /etc/rancher/k3s/config.yaml
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.5+k3s1 K3S_TOKEN="$K3S_TOKEN" sh -s - agent
```

Read the join token on the control plane (never stored in the repository):

```bash
sudo cat /var/lib/rancher/k3s/server/node-token
```

On each worker (example worker-01):

```bash
scp -r infra/k3s kubelab-worker-01:~/
ssh kubelab-worker-01
read -rs K3S_TOKEN; export K3S_TOKEN
cd ~/k3s && bash install-agent.sh agent-config-worker-01.yaml
```

### 8.4 NFS Server on the Proxmox Host

```bash
lvs
lvcreate -V 60G -T pve/data -n nfs-kubelab
mkfs.ext4 /dev/pve/nfs-kubelab
mkdir -p /srv/nfs/kubelab
echo "/dev/pve/nfs-kubelab /srv/nfs/kubelab ext4 defaults 0 2" >> /etc/fstab
mount -a
cp infra/proxmox/nfs-exports /etc/exports.d/kubelab.exports
exportfs -ra && exportfs -v
```

[infra/proxmox/nfs-exports](infra/proxmox/nfs-exports):

```
/srv/nfs/kubelab 10.10.10.0/24(rw,sync,no_subtree_check,no_root_squash)
```

From a worker:

```bash
showmount -e 10.10.10.1
```

### 8.5 Verification

```bash
kubectl get nodes -o wide
kubectl describe node k3s-cp-01 | grep Taints
```

Expected: 4 nodes `Ready`, version `v1.36.5+k3s1`, taint `node-role.kubernetes.io/control-plane=true:NoSchedule` on `k3s-cp-01`.

![k3s nodes](docs/k3s-nodes.png)

## 9. Applications

Entity: `products` (inventory). Node.js 24, ESM, pnpm.

### 9.1 API (`apps/api`)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Readiness: runs `SELECT 1`, returns 200 or 503 |
| GET | `/health/live` | Liveness, no database check |
| GET | `/metrics` | Prometheus metrics: default metrics, `http_requests_total{method,route,status_code}`, `http_request_duration_seconds` |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create (`name` required, `quantity >= 0`, `price >= 0`) |
| GET | `/api/products/:id` | Get one (404 if missing) |
| PUT | `/api/products/:id` | Update (404 if missing) |
| DELETE | `/api/products/:id` | Delete (404 if missing) |

- One JSON log line per request to stdout (collected by Promtail).
- `DATABASE_URL` from the Secret `api-credentials` (Doppler).
- Closes the database pool on `SIGTERM`.
- Tests: `test/products.test.js` (`node:test` + supertest, in-memory repository) and `test/integration.test.js` (real PostgreSQL in CI, skipped without `DATABASE_URL`).

```bash
cd apps/api
pnpm add express@5 pg@8 prom-client@15
pnpm add -D supertest
pnpm install
pnpm test
cd ../..
docker build -t kubelab-api:dev apps/api
```

Files: [apps/api/package.json](apps/api/package.json), [apps/api/src/app.js](apps/api/src/app.js), [apps/api/src/routes/products.js](apps/api/src/routes/products.js), [apps/api/src/metrics.js](apps/api/src/metrics.js), [apps/api/Dockerfile](apps/api/Dockerfile)

```bash
curl -s http://api.grupo6.lab/health
curl -s -X POST http://api.grupo6.lab/api/products -H "Content-Type: application/json" -d '{"name":"keyboard","quantity":10,"price":25.50}'
curl -s http://api.grupo6.lab/api/products
curl -s -X PUT http://api.grupo6.lab/api/products/1 -H "Content-Type: application/json" -d '{"name":"keyboard","quantity":8,"price":25.50}'
curl -s -X DELETE http://api.grupo6.lab/api/products/1
curl -s http://api.grupo6.lab/metrics | grep http_requests_total
```

### 9.2 Web (`apps/web`)

React (Vite) client that lists, creates, edits and deletes products through relative `/api/products` calls. nginx serves the static build and proxies `/api/` to the internal API Service.

```bash
cd apps
pnpm create vite@latest web --template react
cd web
pnpm add -D vitest
pnpm test
cd ../..
docker build -t kubelab-web:dev apps/web
```

[apps/web/nginx.conf](apps/web/nginx.conf):

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;

    location /api/ {
        proxy_pass http://api.kubelab.svc.cluster.local:3000;
    }

    location = /healthz {
        access_log off;
        return 200 "ok\n";
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Files: [apps/web/src/App.jsx](apps/web/src/App.jsx), [apps/web/src/api/products.js](apps/web/src/api/products.js), [apps/web/Dockerfile](apps/web/Dockerfile)

### 9.3 Database (`k8s/apps/database`)

| Resource | Configuration |
|---|---|
| StatefulSet `postgres` | 1 replica, `postgres:17.11-alpine`, `serviceName: postgres-headless`, `envFrom: secretRef postgres-credentials`, `PGDATA=/var/lib/postgresql/data/pgdata` |
| Volume | `volumeClaimTemplates` `data` 5Gi (default StorageClass `nfs-client`) |
| Probes | readiness and liveness `exec: pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"` |
| Resources | requests 100m / 256Mi, limit 512Mi |
| Services | ClusterIP `postgres` (5432), headless `postgres-headless` (`clusterIP: None`) |
| Job `db-init` | Argo CD `PostSync` hook, `hook-delete-policy: BeforeHookCreation`, runs the migrations |
| ConfigMap `db-migrations` | `configMapGenerator` with the `.sql` files (name hash changes when a SQL file changes) |

[k8s/apps/database/migrations/001_create_products.sql](k8s/apps/database/migrations/001_create_products.sql):

```sql
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

[k8s/apps/database/migrations/002_readonly_role.sql](k8s/apps/database/migrations/002_readonly_role.sql):

```sql
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'readonly_user', :'readonly_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'readonly_user') \gexec
GRANT CONNECT ON DATABASE kubelab TO :"readonly_user";
GRANT USAGE ON SCHEMA public TO :"readonly_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"readonly_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO :"readonly_user";
```

[k8s/apps/database/init-job.yaml](k8s/apps/database/init-job.yaml) command (`PGHOST=postgres`, `PGUSER`/`PGPASSWORD`/`PGDATABASE` from `postgres-credentials`):

```sh
psql -v ON_ERROR_STOP=1 -f /migrations/001_create_products.sql &&
psql -v ON_ERROR_STOP=1 -v readonly_user="$DB_READONLY_USER" -v readonly_password="$DB_READONLY_PASSWORD" -f /migrations/002_readonly_role.sql
```

[k8s/apps/database/ingressroutetcp.yaml](k8s/apps/database/ingressroutetcp.yaml):

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRouteTCP
metadata:
  name: postgres
  namespace: kubelab
spec:
  entryPoints:
    - postgres
  routes:
    - match: HostSNI(`*`)
      services:
        - name: postgres
          port: 5432
```

Files: [k8s/apps/database/statefulset.yaml](k8s/apps/database/statefulset.yaml), [k8s/apps/database/services.yaml](k8s/apps/database/services.yaml), [k8s/apps/database/kustomization.yaml](k8s/apps/database/kustomization.yaml)

```bash
kubectl get sts,pvc,job -n kubelab
psql "host=db.grupo6.lab port=5432 dbname=kubelab user=docente sslmode=disable" -c '\dt'
```

### 9.4 API and Web Manifests

| Setting | api | web |
|---|---|---|
| Image | `ghcr.io/<owner>/kubelab-api` (tag set by kustomize) | `ghcr.io/<owner>/kubelab-web` (tag set by kustomize) |
| `replicas` field | Not set (managed by the HPA) | Not set (managed by the HPA) |
| Strategy | `RollingUpdate`, `maxUnavailable: 0`, `maxSurge: 1` | `RollingUpdate`, `maxUnavailable: 0`, `maxSurge: 1` |
| Port / Service | `api` ClusterIP 3000 | `web` ClusterIP 8080 |
| Readiness probe | `GET /health` | `GET /healthz` |
| Liveness probe | `GET /health/live` | `GET /healthz` |
| Requests | `cpu: 100m`, `memory: 128Mi` | `cpu: 50m`, `memory: 32Mi` |
| Limits | `cpu: 500m`, `memory: 256Mi` | `cpu: 250m`, `memory: 128Mi` |
| Secret | `envFrom: secretRef api-credentials` | - |
| Annotations | Pod: `prometheus.io/scrape: "true"`, `prometheus.io/port: "3000"`, `prometheus.io/path: /metrics`; Deployment: `secrets.doppler.com/reload: "true"` | - |
| HPA / PDB | Section 14 | Section 14 |
| IngressRoute | ``Host(`api.grupo6.lab`)`` | ``Host(`app.grupo6.lab`)`` |

[k8s/apps/api/ingressroute.yaml](k8s/apps/api/ingressroute.yaml):

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: api
  namespace: kubelab
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`api.grupo6.lab`)
      kind: Rule
      services:
        - name: api
          port: 3000
```

[k8s/apps/api/kustomization.yaml](k8s/apps/api/kustomization.yaml) (image tag updated by the pipeline):

```yaml
images:
  - name: ghcr.io/<owner>/kubelab-api
    newTag: <short-sha>
```

Files: [k8s/apps/api/deployment.yaml](k8s/apps/api/deployment.yaml), [k8s/apps/api/service.yaml](k8s/apps/api/service.yaml), [k8s/apps/web/deployment.yaml](k8s/apps/web/deployment.yaml), [k8s/apps/web/ingressroute.yaml](k8s/apps/web/ingressroute.yaml)

```bash
kubectl get deploy,hpa,pdb,ingressroute -n kubelab
curl http://api.grupo6.lab/health
```

![kubelab namespace resources](docs/kubelab-resources.png)

![Web CRUD in the browser](docs/browser-web-crud.png)

![API health in the browser](docs/browser-api-health.png)

## 10. CI/CD and GitOps

### 10.1 Flow

```
1. PR merged into main with changes in apps/api (or apps/web)
2. GitHub Actions: tests (Doppler config ci + PostgreSQL container), build,
   push ghcr.io/<owner>/kubelab-api:<short-sha>
3. GitHub Actions: kustomize edit set image in k8s/apps/api/kustomization.yaml,
   commit "ci(api): deploy image <short-sha>" to main
4. Argo CD detects the new commit (reconciliation every 60s) and syncs the api Application
5. Kubernetes RollingUpdate (maxUnavailable: 0); Argo CD shows Synced and Healthy
```

A change only in `k8s/` does not run any workflow: Argo CD applies it directly.

Repository settings:

| Setting | Value |
|---|---|
| Visibility | Public (teacher added as collaborator) |
| Ruleset on `main` | Block force pushes, Restrict deletions |
| Actions, Workflow permissions | Read and write |
| GHCR packages `kubelab-api`, `kubelab-web` | Public (no `imagePullSecrets`) |
| Actions secret | `DOPPLER_TOKEN` (section 11.2) |

### 10.2 Workflow

[.github/workflows/api.yml](.github/workflows/api.yml) ([.github/workflows/web.yml](.github/workflows/web.yml) is the same with `web` instead of `api` and without PostgreSQL):

```yaml
name: api

on:
  push:
    branches: [main]
    paths:
      - "apps/api/**"
      - ".github/workflows/api.yml"
  pull_request:
    paths:
      - "apps/api/**"
      - ".github/workflows/api.yml"

permissions:
  contents: write
  packages: write

concurrency:
  group: deploy-manifests
  cancel-in-progress: false

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/kubelab-api

jobs:
  test:
    runs-on: ubuntu-24.04
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v7
      - uses: dopplerhq/secrets-fetch-action@v2.0.0
        with:
          doppler-token: ${{ secrets.DOPPLER_TOKEN }}
          inject-env-vars: true
      - name: Start PostgreSQL
        run: |
          docker run -d --name postgres -p 5432:5432 \
            -e POSTGRES_DB -e POSTGRES_USER -e POSTGRES_PASSWORD \
            postgres:17.11-alpine
          until docker exec postgres pg_isready -U "$POSTGRES_USER"; do sleep 2; done
          docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < ../../k8s/apps/database/migrations/001_create_products.sql
      - uses: pnpm/action-setup@v6
        with:
          package_json_file: apps/api/package.json
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: apps/api/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}

  build-and-deploy:
    if: github.event_name == 'push'
    needs: test
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - name: Short commit hash
        run: echo "SHORT_SHA=${GITHUB_SHA::7}" >> "$GITHUB_ENV"
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v7
        with:
          context: apps/api
          push: true
          tags: ${{ env.IMAGE_NAME }}:${{ env.SHORT_SHA }}
      - name: Update image tag in manifests
        working-directory: k8s/apps/api
        run: kustomize edit set image "${IMAGE_NAME}=${IMAGE_NAME}:${SHORT_SHA}"
      - name: Commit manifest change
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add k8s/apps/api/kustomization.yaml
          git commit -m "ci(api): deploy image ${SHORT_SHA}"
          git pull --rebase origin main
          git push origin HEAD:main
```

- Pushes made with `GITHUB_TOKEN` do not trigger other workflows (no loop).
- The shared `concurrency` group prevents the api and web pipelines from pushing manifests at the same time.

![GitHub Actions runs](docs/github-actions-runs.png)

![GHCR packages with SHA tags](docs/ghcr-packages.png)

### 10.3 Argo CD Installation

```bash
curl -fL -o k8s/argocd/install/install.yaml https://raw.githubusercontent.com/argoproj/argo-cd/v3.5.6/manifests/install.yaml
```

[k8s/argocd/install/kustomization.yaml](k8s/argocd/install/kustomization.yaml):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: argocd
resources:
  - namespace.yaml
  - install.yaml
patches:
  - path: argocd-cmd-params-cm.yaml
  - path: argocd-cm.yaml
  - path: argocd-rbac-cm.yaml
```

[k8s/argocd/install/argocd-cmd-params-cm.yaml](k8s/argocd/install/argocd-cmd-params-cm.yaml):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cmd-params-cm
data:
  server.insecure: "true"
```

[k8s/argocd/install/argocd-cm.yaml](k8s/argocd/install/argocd-cm.yaml):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
data:
  url: http://argocd.grupo6.lab
  timeout.reconciliation: 60s
  accounts.docente: login
  resource.customizations.health.argoproj.io_Application: |
    hs = {}
    hs.status = "Progressing"
    hs.message = ""
    if obj.status ~= nil and obj.status.health ~= nil then
      hs.status = obj.status.health.status
      if obj.status.health.message ~= nil then
        hs.message = obj.status.health.message
      end
    end
    return hs
```

[k8s/argocd/install/argocd-rbac-cm.yaml](k8s/argocd/install/argocd-rbac-cm.yaml):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
data:
  policy.csv: "g, docente, role:readonly"
```

The `Application` health check makes the sync waves wait until each child Application is `Healthy`.

[k8s/argocd/routes/ingressroute.yaml](k8s/argocd/routes/ingressroute.yaml):

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: argocd
  namespace: argocd
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`argocd.grupo6.lab`)
      kind: Rule
      services:
        - name: argocd-server
          port: 80
```

Bootstrap (manual, only once):

```bash
kubectl apply --server-side --force-conflicts -k k8s/argocd/install
kubectl wait -n argocd --for=condition=Ready pod --all --timeout=300s
```

Before Traefik exists:

```bash
kubectl port-forward -n argocd svc/argocd-server 8080:80
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
```

### 10.4 Root Application (App of Apps)

[k8s/argocd/root.yaml](k8s/argocd/root.yaml):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<owner>/kubelab.git
    targetRevision: main
    path: k8s/argocd/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```bash
kubectl apply -f k8s/argocd/root.yaml
```

### 10.5 Applications and Sync Waves

All child Applications use `automated: {prune: true, selfHeal: true}` and `syncOptions: [CreateNamespace=true, ServerSideApply=true]`.

| File (`k8s/argocd/apps/`) | Source | Namespace | Wave |
|---|---|---|---|
| `namespaces.yaml` | `k8s/platform/namespaces` | - | -10 |
| `metallb.yaml` | chart metallb 0.16.1 + `$values/k8s/platform/metallb/values.yaml` | `metallb-system` | -9 |
| `nfs-provisioner.yaml` | chart 4.0.18 + values | `nfs-provisioner` | -9 |
| `metrics-server.yaml` | chart 3.14.0 + values | `kube-system` | -9 |
| `doppler-operator.yaml` | chart 1.7.5 + values | `doppler-operator-system` | -9 |
| `metallb-config.yaml` | `k8s/platform/metallb-config` | `metallb-system` | -8 |
| `doppler-secrets.yaml` | `k8s/platform/doppler-secrets` | `doppler-operator-system` | -8 |
| `traefik.yaml` | chart 41.7.1 + values | `traefik` | -7 |
| `argocd.yaml` | `k8s/argocd/install` (Argo CD manages itself) | `argocd` | -6 |
| `argocd-routes.yaml` | `k8s/argocd/routes` | `argocd` | -6 |
| `database.yaml` | `k8s/apps/database` | `kubelab` | 0 |
| `prometheus.yaml`, `loki.yaml`, `promtail.yaml` | charts + values | `monitoring` | 0 |
| `grafana.yaml` | chart 13.7.0 + values + `k8s/observability/grafana/manifests` (dashboards and job) | `monitoring` | 0 |
| `observability-routes.yaml` | `k8s/observability/routes` | `monitoring` | 0 |
| `api.yaml`, `web.yaml` | `k8s/apps/api`, `k8s/apps/web` | `kubelab` | 1 |

Chart with values from this repository (multi-source), [k8s/argocd/apps/traefik.yaml](k8s/argocd/apps/traefik.yaml):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: traefik
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "-7"
spec:
  project: default
  sources:
    - repoURL: https://traefik.github.io/charts
      chart: traefik
      targetRevision: 41.7.1
      helm:
        releaseName: traefik
        valueFiles:
          - $values/k8s/platform/traefik/values.yaml
    - repoURL: https://github.com/<owner>/kubelab.git
      targetRevision: main
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: traefik
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

Folder from this repository, [k8s/argocd/apps/api.yaml](k8s/argocd/apps/api.yaml):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  project: default
  source:
    repoURL: https://github.com/<owner>/kubelab.git
    targetRevision: main
    path: k8s/apps/api
  destination:
    server: https://kubernetes.default.svc
    namespace: kubelab
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

```bash
kubectl get applications -n argocd
```

## 11. Secrets (Doppler)

Doppler is the only source of credentials. Argo CD only versions `DopplerSecret` resources (which keys and where), never values. Procedure without values: [docs/doppler.md](docs/doppler.md).

### 11.1 Doppler Project

Project `kubelab`. Passwords are generated, alphanumeric, 24+ characters.

Config `prd` (cluster):

| Key | Value | Kubernetes Secret |
|---|---|---|
| `POSTGRES_DB` | `kubelab` | `postgres-credentials` (`kubelab`) |
| `POSTGRES_USER` | `kubelab` | `postgres-credentials` (`kubelab`) |
| `POSTGRES_PASSWORD` | generated | `postgres-credentials` (`kubelab`) |
| `DB_READONLY_USER` | `docente` | `postgres-credentials` (`kubelab`) |
| `DB_READONLY_PASSWORD` | generated | `postgres-credentials` (`kubelab`) |
| `DATABASE_URL` | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres.kubelab.svc.cluster.local:5432/${POSTGRES_DB}` (Doppler references) | `api-credentials` (`kubelab`) |
| `GRAFANA_ADMIN_USER` | `admin` | `grafana-credentials` (`monitoring`) |
| `GRAFANA_ADMIN_PASSWORD` | generated | `grafana-credentials` (`monitoring`) |
| `GRAFANA_VIEWER_USER` | `docente` | `grafana-credentials` (`monitoring`) |
| `GRAFANA_VIEWER_PASSWORD` | generated | `grafana-credentials` (`monitoring`) |
| `ARGOCD_READONLY_PASSWORD` | generated | - (set once with the `argocd` CLI, section 16.3) |

Config `ci` (pipeline tests): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (test values).

### 11.2 GitHub Actions Secret

Service token of the `ci` config stored as the repository secret `DOPPLER_TOKEN` (Settings, Secrets and variables, Actions). Used by `dopplerhq/secrets-fetch-action@v2.0.0` (section 10.2).

### 11.3 Doppler Token in the Cluster (the only manual Secret)

Read-only service token of the `prd` config, created after Argo CD has created the namespace `doppler-operator-system`:

```bash
kubectl get ns doppler-operator-system
read -rs DOPPLER_SERVICE_TOKEN
kubectl create secret generic doppler-token-secret -n doppler-operator-system \
  --from-literal=serviceToken="$DOPPLER_SERVICE_TOKEN"
unset DOPPLER_SERVICE_TOKEN
```

### 11.4 DopplerSecret

[k8s/platform/doppler-secrets/postgres.yaml](k8s/platform/doppler-secrets/postgres.yaml):

```yaml
apiVersion: secrets.doppler.com/v1alpha1
kind: DopplerSecret
metadata:
  name: postgres-credentials
  namespace: doppler-operator-system
spec:
  tokenSecret:
    name: doppler-token-secret
  managedSecret:
    name: postgres-credentials
    namespace: kubelab
    type: Opaque
  secrets:
    - POSTGRES_DB
    - POSTGRES_USER
    - POSTGRES_PASSWORD
    - DB_READONLY_USER
    - DB_READONLY_PASSWORD
  resyncSeconds: 60
```

| File | Managed Secret | Namespace | Keys |
|---|---|---|---|
| [postgres.yaml](k8s/platform/doppler-secrets/postgres.yaml) | `postgres-credentials` | `kubelab` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_READONLY_USER`, `DB_READONLY_PASSWORD` |
| [api.yaml](k8s/platform/doppler-secrets/api.yaml) | `api-credentials` | `kubelab` | `DATABASE_URL` |
| [grafana.yaml](k8s/platform/doppler-secrets/grafana.yaml) | `grafana-credentials` | `monitoring` | `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, `GRAFANA_VIEWER_USER`, `GRAFANA_VIEWER_PASSWORD` |

Verification (key names only, never values):

```bash
kubectl get dopplersecrets -n doppler-operator-system
kubectl get secret -n kubelab postgres-credentials -o jsonpath='{.data}' | python3 -c 'import json,sys; print(list(json.load(sys.stdin)))'
kubectl get secret -n kubelab api-credentials -o jsonpath='{.data}' | python3 -c 'import json,sys; print(list(json.load(sys.stdin)))'
kubectl get secret -n monitoring grafana-credentials -o jsonpath='{.data}' | python3 -c 'import json,sys; print(list(json.load(sys.stdin)))'
```

![DopplerSecrets and synced keys](docs/doppler-secrets.png)

Repository history check (no real matches expected):

```bash
git log -p | grep -iE 'password|dp\.st\.|token|BEGIN .*PRIVATE'
```

## 12. Platform

### 12.1 Namespaces

[k8s/platform/namespaces/kubelab.yaml](k8s/platform/namespaces/kubelab.yaml), [k8s/platform/namespaces/monitoring.yaml](k8s/platform/namespaces/monitoring.yaml):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kubelab
---
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
```

### 12.2 MetalLB

[k8s/platform/metallb/values.yaml](k8s/platform/metallb/values.yaml):

```yaml
frrk8s:
  enabled: false
```

[k8s/platform/metallb-config/ipaddresspool.yaml](k8s/platform/metallb-config/ipaddresspool.yaml), [k8s/platform/metallb-config/l2advertisement.yaml](k8s/platform/metallb-config/l2advertisement.yaml):

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: kubelab-pool
  namespace: metallb-system
spec:
  addresses:
    - 10.10.10.200-10.10.10.220
  autoAssign: false
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: kubelab-l2
  namespace: metallb-system
spec:
  ipAddressPools:
    - kubelab-pool
```

```bash
kubectl get pods -n metallb-system
kubectl get ipaddresspool,l2advertisement -n metallb-system
```

### 12.3 Traefik

[k8s/platform/traefik/values.yaml](k8s/platform/traefik/values.yaml):

```yaml
deployment:
  replicas: 2
service:
  type: LoadBalancer
  annotations:
    metallb.io/loadBalancerIPs: 10.10.10.200
ports:
  web:
    port: 8000
    exposedPort: 80
  websecure:
    expose:
      default: false
  postgres:
    port: 5432
    exposedPort: 5432
    protocol: TCP
    expose:
      default: true
providers:
  kubernetesCRD:
    enabled: true
  kubernetesIngress:
    enabled: false
accessLog:
  enabled: true
ingressRoute:
  dashboard:
    enabled: false
resources:
  requests:
    cpu: 100m
    memory: 64Mi
  limits:
    memory: 256Mi
```

```bash
kubectl get svc -n traefik
curl -i http://10.10.10.200
```

Expected: `EXTERNAL-IP 10.10.10.200`, ports 80 and 5432, and a Traefik 404 for requests without a matching host. `curl` runs on the Proxmox host; from a laptop on the hotspot, `curl -i http://<IP_WIFI_PROXMOX>` returns the same 404 through the DNAT of section 6.3.

### 12.4 NFS Provisioner

[k8s/platform/nfs-provisioner/values.yaml](k8s/platform/nfs-provisioner/values.yaml):

```yaml
nfs:
  server: 10.10.10.1
  path: /srv/nfs/kubelab
storageClass:
  name: nfs-client
  defaultClass: true
  reclaimPolicy: Retain
  archiveOnDelete: true
  pathPattern: "${.PVC.namespace}-${.PVC.name}"
```

```bash
kubectl get storageclass
ls /srv/nfs/kubelab
```

### 12.5 metrics-server

[k8s/platform/metrics-server/values.yaml](k8s/platform/metrics-server/values.yaml):

```yaml
args:
  - --kubelet-insecure-tls
```

```bash
kubectl top nodes
```

### 12.6 Doppler Operator

[k8s/platform/doppler-operator/values.yaml](k8s/platform/doppler-operator/values.yaml):

```yaml
{}
```

## 13. Observability

### 13.1 Prometheus

[k8s/observability/prometheus/values.yaml](k8s/observability/prometheus/values.yaml) (based on personal-project-01: no ingress, 8Gi volume, `kubernetes-pods` job active without drops):

```yaml
server:
  retention: "3d"
  persistentVolume:
    enabled: true
    size: 8Gi
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      memory: 1Gi

scrapeConfigs:
  prometheus-pushgateway:
    enabled: false
  kubernetes-services:
    enabled: false

alertmanager:
  enabled: false
prometheus-pushgateway:
  enabled: false

kube-state-metrics:
  enabled: true
prometheus-node-exporter:
  enabled: true
```

The `kubernetes-pods` job scrapes the API through its `prometheus.io/*` pod annotations.

### 13.2 Loki

[k8s/observability/loki/values.yaml](k8s/observability/loki/values.yaml) (Monolithic, filesystem, 72h retention):

```yaml
deploymentMode: Monolithic

loki:
  auth_enabled: false
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: filesystem
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  limits_config:
    retention_period: 72h
  compactor:
    retention_enabled: true
    delete_request_store: filesystem

singleBinary:
  replicas: 1
  persistence:
    enabled: true
    size: 8Gi
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      memory: 1Gi

gateway:
  enabled: false
chunksCache:
  enabled: false
resultsCache:
  enabled: false
lokiCanary:
  enabled: false
test:
  enabled: false
minio:
  enabled: false

backend:
  replicas: 0
read:
  replicas: 0
write:
  replicas: 0
```

### 13.3 Promtail

[k8s/observability/promtail/values.yaml](k8s/observability/promtail/values.yaml) (logs from all namespaces; the default tolerations cover the control plane taint, 4 pods):

```yaml
image:
  tag: 3.6.11

config:
  clients:
    - url: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    memory: 256Mi
```

### 13.4 Grafana

[k8s/observability/grafana/values.yaml](k8s/observability/grafana/values.yaml) (admin credentials from the Doppler-managed Secret `grafana-credentials`):

```yaml
admin:
  existingSecret: grafana-credentials
  userKey: GRAFANA_ADMIN_USER
  passwordKey: GRAFANA_ADMIN_PASSWORD

testFramework:
  enabled: false

grafana.ini:
  server:
    root_url: http://grafana.grupo6.lab

persistence:
  enabled: true
  size: 2Gi

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    memory: 512Mi

datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        uid: prometheus
        access: proxy
        url: http://prometheus-server.monitoring.svc.cluster.local
        isDefault: true
        editable: false
      - name: Loki
        type: loki
        uid: loki
        access: proxy
        url: http://loki.monitoring.svc.cluster.local:3100
        editable: false

dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
      - name: kubelab
        orgId: 1
        folder: KubeLab
        type: file
        disableDeletion: true
        editable: false
        options:
          path: /var/lib/grafana/dashboards/kubelab

dashboardsConfigMaps:
  kubelab: grafana-dashboards
```

[k8s/observability/grafana/manifests/kustomization.yaml](k8s/observability/grafana/manifests/kustomization.yaml):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: monitoring
generatorOptions:
  disableNameSuffixHash: true
resources:
  - viewer-user-job.yaml
configMapGenerator:
  - name: grafana-dashboards
    files:
      - kubelab-overview.json
```

Viewer user: [k8s/observability/grafana/manifests/viewer-user-job.yaml](k8s/observability/grafana/manifests/viewer-user-job.yaml), a `PostSync` Job (`curlimages/curl:8.23.0`) that calls `POST /api/admin/users` with the admin credentials from `grafana-credentials`, sets the Viewer role, and exits OK on 412 (user already exists).

Admin password (not stored in this repository):

```bash
kubectl -n monitoring get secret grafana-credentials -o jsonpath='{.data.GRAFANA_ADMIN_PASSWORD}' | base64 -d; echo
```

### 13.5 Dashboard `KubeLab Overview`

[k8s/observability/grafana/manifests/kubelab-overview.json](k8s/observability/grafana/manifests/kubelab-overview.json) (data sources uid `prometheus` and `loki`):

| Panel | Query |
|---|---|
| CPU by pod (`kubelab`) | `sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="kubelab", container!="", image!=""}[5m]))` |
| Memory by pod (`kubelab`) | `sum by (pod) (container_memory_working_set_bytes{namespace="kubelab", container!="", image!=""})` |
| CPU by node | `100 * sum by (instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m])) / count by (instance) (node_cpu_seconds_total{mode="idle"})` |
| Memory by node | `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` |
| Available replicas | `kube_deployment_status_replicas_available{namespace="kubelab"}` |
| HPA current replicas | `kube_horizontalpodautoscaler_status_current_replicas{namespace="kubelab"}` |
| API requests per second | `sum by (route, status_code) (rate(http_requests_total{namespace="kubelab", app="api"}[1m]))` |
| Application logs (LogQL) | `{namespace="kubelab", app=~"api\|web"}` |
| Traefik logs (LogQL) | `{namespace="traefik"}` |

### 13.6 IngressRoutes

[k8s/observability/routes/grafana.yaml](k8s/observability/routes/grafana.yaml), [k8s/observability/routes/prometheus.yaml](k8s/observability/routes/prometheus.yaml):

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: grafana
  namespace: monitoring
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`grafana.grupo6.lab`)
      kind: Rule
      services:
        - name: grafana
          port: 80
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: prometheus
  namespace: monitoring
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`prometheus.grupo6.lab`)
      kind: Rule
      services:
        - name: prometheus-server
          port: 80
```

[k8s/observability/routes/kustomization.yaml](k8s/observability/routes/kustomization.yaml):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - grafana.yaml
  - prometheus.yaml
```

### 13.7 Verification

```bash
kubectl get pods -n monitoring -o wide
kubectl get pvc -A
curl -s -o /dev/null -w "%{http_code}\n" http://prometheus.grupo6.lab/-/ready
curl -s -o /dev/null -w "%{http_code}\n" http://grafana.grupo6.lab/login
```

Expected: Promtail and node-exporter on the 4 nodes, all PVCs `Bound` to `nfs-client`. Generate traffic before checking logs (section 14.3).

![Prometheus targets](docs/prometheus-targets.png)

![Grafana data sources](docs/grafana-datasources.png)

![KubeLab dashboard](docs/grafana-dashboard.png)

![Promtail on all nodes](docs/promtail-all-nodes.png)

![PVCs on nfs-client](docs/pvcs-nfs.png)

## 14. High Availability and Scaling

### 14.1 HPA and PDB

[k8s/apps/api/hpa.yaml](k8s/apps/api/hpa.yaml):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
  namespace: kubelab
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 60
```

[k8s/apps/api/pdb.yaml](k8s/apps/api/pdb.yaml):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api
  namespace: kubelab
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: api
```

Web uses the same files with `web`: [k8s/apps/web/hpa.yaml](k8s/apps/web/hpa.yaml), [k8s/apps/web/pdb.yaml](k8s/apps/web/pdb.yaml). Traefik runs 2 replicas (section 12.3).

```bash
kubectl get hpa,pdb -n kubelab
kubectl top pods -n kubelab
```

### 14.2 Load Test (k6)

[loadtest/api-load.js](loadtest/api-load.js):

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
};

export default function () {
  const response = http.get("http://api.grupo6.lab/api/products");
  check(response, { "status is 200": (result) => result.status === 200 });
  sleep(0.1);
}
```

From a laptop on the hotspot with [docs/hosts.txt](docs/hosts.txt) applied:

```bash
docker run --rm -i --add-host api.grupo6.lab:<IP_WIFI_PROXMOX> grafana/k6:1.8.2 run - < loadtest/api-load.js
```

In another terminal:

```bash
kubectl get hpa -n kubelab -w
```

Expected: `api` scales from 2 towards 6 replicas and scales down after the test. If the WiFi bandwidth keeps CPU below 60 %, run k6 1.8.2 from the Proxmox host (same internal network) with `--add-host api.grupo6.lab:10.10.10.200`.

![HPA scaling](docs/hpa-scaling.png)

![Grafana during the load test](docs/grafana-hpa-load.png)

### 14.3 Pod Deletion Test

Continuous traffic (only `200` expected):

```bash
while true; do curl -s -o /dev/null -w "%{http_code}\n" http://app.grupo6.lab/api/products; sleep 0.5; done
```

In another terminal, one pod at a time:

```bash
kubectl delete -n kubelab "$(kubectl get pod -n kubelab -l app=api -o name | head -n1)"
kubectl delete -n kubelab "$(kubectl get pod -n kubelab -l app=web -o name | head -n1)"
kubectl delete -n traefik "$(kubectl get pod -n traefik -l app.kubernetes.io/name=traefik -o name | head -n1)"
```

Data persistence (same products before and after):

```bash
curl -s http://api.grupo6.lab/api/products
kubectl delete pod postgres-0 -n kubelab
kubectl get pod postgres-0 -n kubelab -w
curl -s http://api.grupo6.lab/api/products
```

```bash
kubectl delete pod -n monitoring -l app.kubernetes.io/name=grafana
kubectl delete pod -n monitoring -l app.kubernetes.io/name=loki
kubectl delete pod -n monitoring -l app.kubernetes.io/name=prometheus,app.kubernetes.io/component=server
kubectl get pods -n monitoring -w
```

Dashboards, metrics and logs remain after the pods return. Screenshot: section 17.

## 15. URL Table

| URL | Service | What the teacher should see |
|---|---|---|
| http://app.grupo6.lab | Web (React + nginx) | Products page: list, create, edit and delete products |
| http://api.grupo6.lab/health | API | HTTP 200 with the database check passing |
| `db.grupo6.lab:5432` | PostgreSQL (IngressRouteTCP) | `psql "host=db.grupo6.lab port=5432 dbname=kubelab user=docente sslmode=disable" -c '\dt'` lists the `products` table |
| http://grafana.grupo6.lab | Grafana | Login as `docente` (Viewer), data sources Prometheus and Loki, folder `KubeLab` with the KubeLab Overview dashboard |
| http://prometheus.grupo6.lab | Prometheus | Status, Targets: all jobs UP, including `kubernetes-pods` with the API |
| http://argocd.grupo6.lab | Argo CD | Login as `docente` (read-only): `root` and all child Applications `Synced` and `Healthy` |

## 16. Teacher Access

Access is through the group hotspot, a DNAT on the Proxmox host (section 6.3) and a hosts file. The teacher only consumes services: no SSH, no `kubectl` and no routes are needed. This replaces the VPN (ZeroTier or Tailscale) required by ACC-02, by group decision. Full guide: [docs/access.md](docs/access.md).

### 16.1 Steps

1. Join the WiFi `kubelab-grupo6` (password delivered in person).
2. Copy the content of [docs/hosts.txt](docs/hosts.txt) to the hosts file. It points all the domains to the Proxmox WiFi address, which the group updates in that file on review day if the hotspot changed it.
3. Open the URLs of section 15 with explicit `http://` and secure DNS disabled in the browser.

Windows (PowerShell as administrator):

```powershell
notepad C:\Windows\System32\drivers\etc\hosts
ipconfig /flushdns
curl.exe http://api.grupo6.lab/health
```

Linux / macOS:

```bash
sudo tee -a /etc/hosts < docs/hosts.txt
curl http://api.grupo6.lab/health
psql "host=db.grupo6.lab port=5432 dbname=kubelab user=docente sslmode=disable" -c '\dt'
```

### 16.2 `docs/hosts.txt`

```
# Grupo 6 - KubeLab
# Join the WiFi kubelab-grupo6 first. No routes needed (see docs/access.md)
<IP_WIFI_PROXMOX>  app.grupo6.lab
<IP_WIFI_PROXMOX>  api.grupo6.lab
<IP_WIFI_PROXMOX>  db.grupo6.lab
<IP_WIFI_PROXMOX>  grafana.grupo6.lab
<IP_WIFI_PROXMOX>  prometheus.grupo6.lab
<IP_WIFI_PROXMOX>  argocd.grupo6.lab
```

`<IP_WIFI_PROXMOX>` is replaced by the real address (`ip -br addr show <wifi_iface>` on the host) before the review.

### 16.3 Read-only Users

Credentials are delivered privately, never in this repository.

| System | User | Permission | Created by |
|---|---|---|---|
| PostgreSQL | `docente` | `SELECT` on schema `public` | Job `db-init` (section 9.3) |
| Grafana | `docente` | Viewer | Job in `viewer-user-job.yaml` (section 13.4) |
| Argo CD | `docente` | `role:readonly` | `argocd-cm` + `argocd-rbac-cm` (section 10.3) |

Argo CD password, set once with the `argocd` CLI v3.5.6 using the Doppler value `ARGOCD_READONLY_PASSWORD`:

```bash
argocd login argocd.grupo6.lab --plaintext --username admin
argocd account update-password --account docente --current-password "<admin>" --new-password "<ARGOCD_READONLY_PASSWORD>"
```

![Access test from an external laptop](docs/teacher-access-test.png)

## 17. Evidence

### 17.1 Automatic Deployment (GitOps)

Visible change in the web, PR and merge to `main`:

```bash
kubectl get applications -n argocd web
kubectl rollout history deploy/web -n kubelab
```

Workflow `web` green, commit `ci(web): deploy image <short-sha>`, Argo CD `web` `Synced` on the new commit, change visible at http://app.grupo6.lab.

![GitOps deployment](docs/gitops-deploy.png)

### 17.2 Manifest-only Change

Change `maxReplicas` in [k8s/apps/web/hpa.yaml](k8s/apps/web/hpa.yaml), PR and merge. No workflow runs; Argo CD applies the change.

```bash
kubectl get hpa web -n kubelab
```

![Manifest-only change](docs/gitops-manifest-only.png)

### 17.3 selfHeal

```bash
kubectl delete ingressroute web -n kubelab
kubectl get ingressroute -n kubelab -w
```

Argo CD recreates the IngressRoute.

![Argo CD selfHeal](docs/argocd-selfheal.png)

### 17.4 Pod Deletion without Downtime

Commands in section 14.3.

![Pod deletion with continuous traffic](docs/pod-deletion.png)

## 18. AI Usage

Declared in [docs/ia.md](docs/ia.md).
