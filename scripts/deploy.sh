#!/usr/bin/env bash
# Deploy binaries and install script to the VM.
# Usage: VM_HOST=ubuntu@your-vm-ip ./scripts/deploy.sh
set -euo pipefail

VM_HOST="${VM_HOST:?Set VM_HOST=user@your-vm-ip}"
REMOTE_DIR="/var/www/manthra"

echo "Deploying to ${VM_HOST}:${REMOTE_DIR}..."

# Upload install scripts
rsync -avz install.sh  "${VM_HOST}:${REMOTE_DIR}/install"
rsync -avz install.ps1 "${VM_HOST}:${REMOTE_DIR}/install.ps1"

# Upload all release binaries
rsync -avz --progress releases/ "${VM_HOST}:${REMOTE_DIR}/releases/"

echo ""
echo "Deployed. Install commands:"
echo "  Linux/macOS : curl -fsSL https://manthra.informaticsint.au/install | bash"
echo "  Windows PS1 : iwr https://manthra.informaticsint.au/install.ps1 | iex"
