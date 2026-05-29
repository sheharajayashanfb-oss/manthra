#!/usr/bin/env bash
# Deploy binaries and install script to the VM.
# Usage: VM_HOST=ubuntu@your-vm-ip ./scripts/deploy.sh
set -euo pipefail

VM_HOST="${VM_HOST:?Set VM_HOST=user@your-vm-ip}"
REMOTE_DIR="/var/www/manthra"

echo "Deploying to ${VM_HOST}:${REMOTE_DIR}..."

# Auto-generate version.json from package.json
VERSION=$(node -p "require('./package.json').version")
DATE=$(date -u +%Y-%m-%d)
echo "{\"version\":\"${VERSION}\",\"date\":\"${DATE}\"}" > web/version.json
echo "Generated web/version.json: v${VERSION} (${DATE})"

# Upload web assets (marketing site)
rsync -avz web/ "${VM_HOST}:${REMOTE_DIR}/"

# Upload install scripts
rsync -avz install.sh  "${VM_HOST}:${REMOTE_DIR}/install"
rsync -avz install.ps1 "${VM_HOST}:${REMOTE_DIR}/install.ps1"

# Upload CLI release binaries (excludes desktop/ subdirectory — use deploy-desktop.sh for those)
rsync -avz --progress --exclude="desktop/" releases/ "${VM_HOST}:${REMOTE_DIR}/releases/"

# Upload desktop builds if they exist
if [ -d "releases/desktop" ]; then
  echo ""
  echo "Uploading desktop builds..."
  rsync -avz --progress \
    --include="*.dmg" \
    --include="*.exe" \
    --include="*.AppImage" \
    --exclude="*" \
    "releases/desktop/" "${VM_HOST}:${REMOTE_DIR}/releases/desktop/"
fi

echo ""
echo "Deployed. Install commands:"
echo "  Linux/macOS : curl -fsSL https://manthra.informaticsint.au/install | bash"
echo "  Windows PS1 : iwr https://manthra.informaticsint.au/install.ps1 | iex"
echo ""
echo "Desktop downloads:"
echo "  macOS ARM  : https://manthra.informaticsint.au/releases/desktop/Manthra-mac-arm64.dmg"
echo "  macOS Intel: https://manthra.informaticsint.au/releases/desktop/Manthra-mac-x64.dmg"
echo "  Windows    : https://manthra.informaticsint.au/releases/desktop/Manthra-win-x64.exe"
echo "  Linux x64  : https://manthra.informaticsint.au/releases/desktop/Manthra-linux-x64.AppImage"
