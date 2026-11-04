# Teacher Access Guide - Group 6 (KubeLab)

This guide is all you need to review the project. You only consume services: no VPN, no SSH, no `kubectl` and no network routes are required.

## 1. What You Will Review

| Service | What it is |
|---|---|
| Web | Inventory application (React + nginx): create, edit and delete products |
| API | REST API (Node.js + Express) with health checks and Prometheus metrics |
| PostgreSQL | Database behind the API, exposed through Traefik on TCP 5432 |
| Grafana | Dashboards (Prometheus metrics) and logs (Loki) |
| Prometheus | Metrics and scrape targets |
| Argo CD | GitOps: every component of the cluster deployed from the repository |

## 2. Join the Network

1. Connect your laptop to the WiFi **`kubelab-grupo6`**. The password is delivered in person.
2. Nothing else is needed on the network side: the Traefik address belongs to the hotspot network, so your laptop reaches it directly.

## 3. Hosts File

The `*.grupo6.lab` domains do not exist on the internet. The hosts file tells your laptop that all of them go to the Traefik IP; Traefik then picks the service by the requested domain.

Lines to add (also in [hosts.txt](hosts.txt)):

```
10.60.129.240  app.grupo6.lab
10.60.129.240  api.grupo6.lab
10.60.129.240  db.grupo6.lab
10.60.129.240  grafana.grupo6.lab
10.60.129.240  prometheus.grupo6.lab
10.60.129.240  argocd.grupo6.lab
```

### Windows

1. Open Notepad **as administrator**.
2. Open `C:\Windows\System32\drivers\etc\hosts` (choose "All files" in the file dialog).
3. Paste the lines at the end and save.
4. In PowerShell:

```powershell
ipconfig /flushdns
curl.exe http://api.grupo6.lab/health
```

### Linux / macOS

```bash
sudo tee -a /etc/hosts < hosts.txt
curl http://api.grupo6.lab/health
```

On macOS, if the names do not resolve right away: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.

Expected answer from `/health`: `{"status":"ok","database":"ok"}`.

## 4. URLs

Always type `http://` explicitly (there is no HTTPS).

| URL | Service | What you should see |
|---|---|---|
| http://app.grupo6.lab | Web | Products page: list, create, edit and delete products |
| http://api.grupo6.lab/health | API | HTTP 200 with the database check passing |
| http://api.grupo6.lab/api/products | API | JSON list of products |
| http://api.grupo6.lab/metrics | API | Prometheus metrics, including `http_requests_total` by route |
| `db.grupo6.lab:5432` | PostgreSQL | Database `kubelab` with the `products` table (read-only user) |
| http://grafana.grupo6.lab | Grafana | Folder `KubeLab`, dashboard **KubeLab Overview**; Explore with the Loki data source for logs |
| http://prometheus.grupo6.lab | Prometheus | Status > Targets: all jobs UP, including `kubernetes-pods` with the 2 API pods |
| http://argocd.grupo6.lab | Argo CD | Application `root` and all child Applications `Synced` and `Healthy` |

## 5. Read-only Users

The passwords are delivered privately by the group. They are never stored in the repository: they live in Doppler and reach the cluster through the Doppler operator.

| Service | User | Permission |
|---|---|---|
| Grafana | `docente` | Viewer: dashboards and logs, no editing |
| Argo CD | `docente` | `role:readonly`: view applications, no sync or delete |
| PostgreSQL | `docente` | `SELECT` only on schema `public` |
| Web, API, Prometheus | - | No login |

## 6. Quick Tests (optional)

API health and a full create / read / delete cycle:

```bash
curl http://api.grupo6.lab/health
curl -X POST http://api.grupo6.lab/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Teacher test","quantity":5,"price":19.90}'
curl http://api.grupo6.lab/api/products
curl -X DELETE http://api.grupo6.lab/api/products/<id>
```

Invalid input is rejected with HTTP 400 and a list of errors:

```bash
curl -X POST http://api.grupo6.lab/api/products \
  -H "Content-Type: application/json" -d '{"name":""}'
```

Database with the read-only user (`psql` asks for the password):

```bash
psql "host=db.grupo6.lab port=5432 dbname=kubelab user=docente sslmode=disable" -c '\dt'
psql "host=db.grupo6.lab port=5432 dbname=kubelab user=docente sslmode=disable" -c 'SELECT * FROM products;'
```

An `INSERT` with this user fails with `permission denied`, as expected.

## 7. How It Works

```
Your laptop (hotspot client)
   | http://app.grupo6.lab  ->  hosts file  ->  10.60.129.240
   v
Phone hotspot kubelab-grupo6
   |
   v
Proxmox host (WiFi)  answers ARP for 10.60.129.240 (proxy ARP) and routes it to vmbr0
   |
   v
vmbr0 10.10.10.0/24  ->  MetalLB (L2) announces 10.60.129.240 from a worker node
   |
   v
Traefik  ->  chooses the service by domain (IngressRoute) or port 5432 (IngressRouteTCP)
   |
   v
web / api / postgres / grafana / prometheus / argocd
```

- The 4 VMs (1 control plane, 3 workers) live on the internal network `10.10.10.0/24` behind the Proxmox host.
- MetalLB gives Traefik a fixed IP inside the hotspot network, and the Proxmox host answers for that IP on the WiFi (proxy ARP). For your laptop it looks like any other device on the same network, so no routes are needed.

## 8. Deviation from the Assignment

The assignment asks for access through a VPN (ZeroTier or Tailscale). The group uses the group hotspot instead:

- The review happens in person, on the same WiFi, so a VPN adds an account and a client to install without changing what you can test.
- You reach exactly the same services, with the same read-only users, and never touch the VMs.
- No external service or account is needed on your laptop.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| The browser opens a search page or "site can't be reached" | Type `http://` explicitly. Disable "Secure DNS" / "DNS over HTTPS" in the browser: it ignores the hosts file |
| Names do not resolve after editing hosts | Windows: `ipconfig /flushdns`. Check that the file was saved as administrator and has no `.txt` extension |
| Nothing answers | Check that you are connected to `kubelab-grupo6`, then `ping 10.60.129.240` |
| HTTP 404 from Traefik | The domain is misspelled in the URL or missing in the hosts file |
| Grafana or Argo CD reject the login | Use the user `docente` with the password delivered by the group |
| `psql` connection refused | Use port `5432` and `sslmode=disable` |

If something still fails, contact the group: we can check it live from the Proxmox host.
