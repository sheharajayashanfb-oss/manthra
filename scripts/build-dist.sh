#!/usr/bin/env bash
# Build self-contained platform binaries for distribution.
# Output: releases/<version>/ and releases/latest/
# Usage: ./scripts/build-dist.sh [--skip-bundle]
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
OUT="releases/${VERSION}"

echo "Building Manthra v${VERSION}..."

# Step 1: bundle everything into a single CJS file
if [[ "${1:-}" != "--skip-bundle" ]]; then
  echo "  → bundling (CJS, all deps inlined)..."
  ./node_modules/.bin/tsup --config tsup.config.pkg.ts
fi

# Step 2: create platform binaries with pkg
echo "  → building binaries (this downloads Node.js 18 shasums once, then is fast)..."
mkdir -p "$OUT"

PLATFORMS=(
  "node18-linux-x64    manthra-linux-x64"
  "node18-linux-arm64  manthra-linux-arm64"
  "node18-macos-x64    manthra-macos-x64"
  "node18-macos-arm64  manthra-macos-arm64"
)

for entry in "${PLATFORMS[@]}"; do
  TARGET=$(echo "$entry" | awk '{print $1}')
  NAME=$(echo "$entry"   | awk '{print $2}')
  echo "     $TARGET → $NAME"
  ./node_modules/.bin/pkg dist-pkg/manthra.cjs \
    --target "$TARGET" \
    --output "$OUT/$NAME" \
    --no-bytecode \
    --public-packages "*" \
    --public
done

echo "${VERSION}" > "$OUT/version.txt"

# Step 3: symlink/copy to latest/
mkdir -p releases/latest
cp "$OUT"/manthra-* releases/latest/
cp "$OUT/version.txt" releases/latest/version.txt

echo ""
echo "Done! Binaries:"
ls -lh "$OUT"/manthra-*
echo ""
echo "Next: run ./scripts/deploy.sh to push to your VM."
