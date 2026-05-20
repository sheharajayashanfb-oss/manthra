#!/usr/bin/env bash
# Build self-contained platform binaries for distribution.
# Output: releases/<version>/ and releases/latest/
# Usage: ./scripts/build-dist.sh [--skip-bundle]
set -euo pipefail

# Allow CI to redirect pkg's Node.js download cache into the project dir for caching
export PKG_CACHE_PATH="${PKG_CACHE_PATH:-$HOME/.pkg-cache}"

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
  "node18-win-x64      manthra-win-x64.exe"
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

# Step 3: Node.js-based Windows package (no unsigned binary — avoids AppControl blocks)
echo "  → building Node.js Windows package (manthra-win.cjs + manthra-win.cmd)..."
cp dist-pkg/manthra.cjs "$OUT/manthra-win.cjs"
printf '@echo off\r\nnode "%%~dp0manthra-win.cjs" %%*\r\n' > "$OUT/manthra-win.cmd"

# Step 4: symlink/copy to latest/
mkdir -p releases/latest
cp "$OUT"/manthra-* releases/latest/
cp "$OUT/version.txt" releases/latest/version.txt

echo ""
echo "Done! Binaries:"
ls -lh "$OUT"/manthra-*
echo ""
echo "Next: run ./scripts/deploy.sh to push to your VM."
