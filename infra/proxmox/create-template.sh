#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_ID=9000
IMAGE_BASE=https://cloud-images.ubuntu.com/releases/noble/release-20261017
IMAGE_NAME=ubuntu-24.04-server-cloudimg-amd64.img
IMAGE_FILE=/var/lib/vz/template/${IMAGE_NAME}
SSH_PUBLIC_KEYS=/root/kubelab/infra/proxmox/authorized_keys
EXPECTED_SHA256=04e8f2461a16a44e78a370284471f29616cdd9baf1893df25807b71f985b6c94

wget -O "$IMAGE_FILE" "${IMAGE_BASE}/${IMAGE_NAME}"
echo "${EXPECTED_SHA256}  ${IMAGE_FILE}" | sha256sum -c -

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
