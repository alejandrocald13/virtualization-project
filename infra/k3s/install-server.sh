#!/usr/bin/env bash
set -euo pipefail
sudo mkdir -p /etc/rancher/k3s
sudo cp server-config.yaml /etc/rancher/k3s/config.yaml
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.5+k3s1 sh -s - server
