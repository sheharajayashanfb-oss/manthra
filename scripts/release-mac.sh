#!/usr/bin/env bash
# Build Mac desktop app locally, deploy to server, then trigger CI version bump + full release.
#
# Usage:
#   ./scripts/release-mac.sh                  # patch bump (default)
#   ./scripts/release-mac.sh minor            # minor bump
#   ./scripts/release-mac.sh major            # major bump
#
# Requires GITLAB_TOKEN to be set in this script (replace glpat-xxx below).
# Get one from: GitLab → Settings → Access Tokens → api + write_repository scopes

set -euo pipefail

# Always run from the project root regardless of where the script is called from
cd "$(dirname "$0")/.."

BUMP_TYPE="${1:-patch}"
VM_HOST="ubuntu@140.245.113.229"
GITLAB_TOKEN="${GITLAB_TOKEN:-glpat-LByb42RKuWo3FbqEGHQr}"   # replace glpat-xxx with your token once
REMOTE_DIR="/var/www/manthra"
DESKTOP_DIR="releases/desktop"
GITLAB_API="https://gitlab.informaticsint.au/api/v4/projects/infoins-v4%2Finfo-ai%2Fmanthra"

# ── Validate bump type ────────────────────────────────────────────────────────
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Error: BUMP_TYPE must be patch, minor, or major (got: $BUMP_TYPE)"
  exit 1
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  Manthra Mac Release — bump: $BUMP_TYPE$(printf '%*s' $((20 - ${#BUMP_TYPE})) '')║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build Mac DMGs ────────────────────────────────────────────────────
echo "▶  Step 1/3 — Building Mac desktop app (arm64 + x64)..."
echo ""
npm run electron:package:mac
echo ""
echo "✓  Build complete."
echo ""

# ── Step 2: Deploy to server ──────────────────────────────────────────────────
echo "▶  Step 2/3 — Deploying Mac builds to ${VM_HOST}..."
echo ""

if [ ! -d "$DESKTOP_DIR" ]; then
  echo "Error: ${DESKTOP_DIR}/ not found after build."
  exit 1
fi

echo "Files to deploy:"
find "$DESKTOP_DIR" \( -name "*.dmg" -o -name "*.zip" -o -name "*.yml" \) | sort | while read f; do
  echo "  $f  ($(du -sh "$f" | cut -f1))"
done
echo ""

rsync -avz --progress \
  --include="*.dmg" \
  --include="*.zip" \
  --include="*.yml" \
  --exclude="*" \
  "${DESKTOP_DIR}/" "${VM_HOST}:${REMOTE_DIR}/releases/desktop/"

echo ""
echo "✓  Mac builds deployed."
echo ""

# ── Step 3: Trigger CI — version bump + full pipeline ────────────────────────
echo "▶  Step 3/3 — Triggering CI pipeline (bump: $BUMP_TYPE)..."
echo ""

# Create a new pipeline on main
PIPELINE_RESPONSE=$(curl -sS --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --data "ref=main" \
  "$GITLAB_API/pipelines")

PIPELINE_ID=$(echo "$PIPELINE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null \
  || echo "$PIPELINE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$PIPELINE_ID" ] || [ "$PIPELINE_ID" = "null" ]; then
  echo "Error: Failed to create pipeline."
  echo "Response: $PIPELINE_RESPONSE"
  exit 1
fi

echo "  Pipeline #${PIPELINE_ID} created. Waiting for jobs to initialise..."
sleep 5

# Find the bump job
JOBS_RESPONSE=$(curl -sS --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API/pipelines/${PIPELINE_ID}/jobs?per_page=50")

JOB_ID=$(echo "$JOBS_RESPONSE" | python3 -c "
import sys, json
jobs = json.load(sys.stdin)
for j in jobs:
    if j.get('name') == 'bump':
        print(j['id'])
        break
" 2>/dev/null \
  || echo "$JOBS_RESPONSE" | grep -B2 '"bump"' | grep '"id"' | head -1 | grep -o '[0-9]*' | head -1)

if [ -z "$JOB_ID" ]; then
  echo "Error: Could not find bump job in pipeline #${PIPELINE_ID}."
  echo "You can trigger it manually at:"
  echo "  https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines/${PIPELINE_ID}"
  exit 1
fi

# Play the bump job with the requested BUMP_TYPE
PLAY_RESPONSE=$(curl -sS --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data "{\"job_variables_attributes\":[{\"key\":\"BUMP_TYPE\",\"value\":\"$BUMP_TYPE\"}]}" \
  "$GITLAB_API/jobs/${JOB_ID}/play")

echo "  Bump job #${JOB_ID} triggered (BUMP_TYPE=$BUMP_TYPE)."
echo ""
echo "✓  CI pipeline started. The bump job will:"
echo "   1. Increment the $BUMP_TYPE version in package.json"
echo "   2. Push the version commit + git tag"
echo "   3. The tag triggers build → version.json → deploy (CLI + website)"
echo ""
echo "Pipeline status:"
echo "  https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines/${PIPELINE_ID}"
echo ""
echo "Download URLs (once deployed):"
echo "  macOS ARM  : https://manthra.informaticsint.au/releases/desktop/Manthra-mac-arm64.dmg"
echo "  macOS Intel: https://manthra.informaticsint.au/releases/desktop/Manthra-mac-x64.dmg"
