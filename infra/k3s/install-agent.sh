#!/usr/bin/env bash
set -euo pipefail
: "${K3S_TOKEN:?Define K3S_TOKEN antes de ejecutar}"
sudo mkdir -p /etc/rancher/k3s
sudo cp agent-config.yaml /etc/rancher/k3s/config.yaml
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.5+k3s1 K3S_URL=https://10.10.10.11:6443 K3S_TOKEN="$K3S_TOKEN" sh -s - agent
