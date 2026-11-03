#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_ID=9000
GATEWAY=10.10.10.1

create_vm() {
  local vm_id=$1 name=$2 ip_address=$3 cores=$4 memory_mb=$5 disk_size=$6
  qm clone "$TEMPLATE_ID" "$vm_id" --name "$name" --full
  qm set "$vm_id" --cores "$cores" --memory "$memory_mb" --balloon 0 --onboot 1 \
    --ipconfig0 "ip=${ip_address}/24,gw=${GATEWAY}"
  qm resize "$vm_id" scsi0 "$disk_size"
  qm start "$vm_id"
}

create_vm 101 k3s-cp-01     10.10.10.11 2 1280 25G
create_vm 111 k3s-worker-01 10.10.10.21 2 1152 40G
create_vm 112 k3s-worker-02 10.10.10.22 2 1152 40G
create_vm 113 k3s-worker-03 10.10.10.23 2 1152 40G
