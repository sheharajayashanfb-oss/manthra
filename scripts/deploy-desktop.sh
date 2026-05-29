#!/usr/bin/env bash
# Deploy Electron desktop builds to the server.
# Run after: npm run electron:package:<platform>
# Usage: VM_HOST=ubuntu@your-vm-ip ./scripts/deploy-desktop.sh
set -euo pipefail

VM_HOST="${VM_HOST:?Set VM_HOST=user@your-vm-ip}"
REMOTE_DIR="/var/www/manthra"
DESKTOP_DIR="releases/desktop"

echo "Deploying desktop builds to ${VM_HOST}:${REMOTE_DIR}/releases/desktop/..."

if [ ! -d "$DESKTOP_DIR" ]; then
  echo "Error: ${DESKTOP_DIR}/ not found. Run 'npm run electron:package:<platform>' first."
  exit 1
fi

# List what we found
echo ""
echo "Files to deploy:"
find "$DESKTOP_DIR" \( -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" \) | sort | while read f; do
  echo "  $f ($(du -sh "$f" | cut -f1))"
done
echo ""

# Upload all desktop builds (dmg, zip, exe, AppImage) + update YAML metadata
rsync -avz --progress \
  --include="*.dmg" \
  --include="*.zip" \
  --include="*.exe" \
  --include="*.AppImage" \
  --include="*.yml" \
  --exclude="*" \
  "${DESKTOP_DIR}/" "${VM_HOST}:${REMOTE_DIR}/releases/desktop/"

echo ""
echo "Desktop builds deployed. Download URLs:"
echo "  macOS ARM  : https://manthra.informaticsint.au/releases/desktop/Manthra-mac-arm64.dmg"
echo "  macOS Intel: https://manthra.informaticsint.au/releases/desktop/Manthra-mac-x64.dmg"
echo "  Windows    : https://manthra.informaticsint.au/releases/desktop/Manthra-win-x64.exe"
echo "  Linux x64  : https://manthra.informaticsint.au/releases/desktop/Manthra-linux-x64.AppImage"
echo "  Linux ARM  : https://manthra.informaticsint.au/releases/desktop/Manthra-linux-arm64.AppImage"
