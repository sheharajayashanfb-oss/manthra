#!/usr/bin/env bash
# Build Windows desktop app locally, deploy to server, then trigger CI version bump + full release.
#
# Usage:
#   ./scripts/release-win.sh                  # patch bump (default)
#   ./scripts/release-win.sh minor            # minor bump
#   ./scripts/release-win.sh major            # major bump
#
# Requires GITLAB_TOKEN to be set in this script (replace glpat-xxx below).
# Get one from: GitLab → Settings → Access Tokens → api + write_repository scopes
#
# Note: Building the Windows NSIS installer requires Wine to be installed on macOS/Linux,
#       or run this script natively on Windows (Git Bash / WSL).

set -euo pipefail

# Always run from the project root regardless of where the script is called from
cd "$(dirname "$0")/.."

BUMP_TYPE="${1:-patch}"
VM_HOST="ubuntu@140.245.113.229"
GITLAB_TOKEN="${GITLAB_TOKEN:-glpat-LByb42RKuWo3FbqEGHQr}"
REMOTE_DIR="/var/www/manthra"
DESKTOP_DIR="releases/desktop"
GITLAB_API="https://gitlab.informaticsint.au/api/v4/projects/166"

# ── Validate bump type ────────────────────────────────────────────────────────
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Error: BUMP_TYPE must be patch, minor, or major (got: $BUMP_TYPE)"
  exit 1
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  Manthra Win Release — bump: $BUMP_TYPE$(printf '%*s' $((20 - ${#BUMP_TYPE})) '')║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build Windows installer ──────────────────────────────────────────
echo "▶  Step 1/3 — Building Windows desktop app (x64)..."
echo ""
npm run electron:package:win
echo ""
echo "✓  Build complete."
echo ""

# ── Step 2: Deploy to server ──────────────────────────────────────────────────
echo "▶  Step 2/3 — Deploying Windows builds to ${VM_HOST}..."
echo ""

if [ ! -d "$DESKTOP_DIR" ]; then
  echo "Error: ${DESKTOP_DIR}/ not found after build."
  exit 1
fi

echo "Files to deploy:"
find "$DESKTOP_DIR" \( -name "*.exe" -o -name "*.exe.blockmap" -o -name "*.yml" \) | sort | while read -r f; do
  echo "  $f  ($(du -sh "$f" | cut -f1))"
done
echo ""

rsync -avz --progress \
  --include="*.exe" \
  --include="*.exe.blockmap" \
  --include="*.yml" \
  --exclude="*" \
  "${DESKTOP_DIR}/" "${VM_HOST}:${REMOTE_DIR}/releases/desktop/"

echo ""
echo "✓  Windows builds deployed."
echo ""

# ── Step 3: Trigger CI — version bump + full pipeline ────────────────────────
echo "▶  Step 3/3 — Triggering CI pipeline (bump: $BUMP_TYPE)..."
echo ""

# Use the latest pipeline on main that has a manual bump job.
# (Creating a new pipeline via API requires elevated token scopes — this approach
# reuses the pipeline that was already created by the most recent push to main.)

echo "  Fetching latest pipeline on main..."
PIPELINES_RESPONSE=$(curl -sS \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API/jobs?scope=manual&per_page=20")

JOB_ID=$(echo "$PIPELINES_RESPONSE" | python3 -c "
import sys, re
raw = sys.stdin.read()
# strip control characters that gitlab sometimes embeds in avatar URLs
raw = re.sub(r'[\x00-\x1f]', '', raw)
import json
try:
    jobs = json.loads(raw)
    for j in (jobs if isinstance(jobs, list) else []):
        if j.get('name') == 'bump' and j.get('status') == 'manual':
            print(j['id'])
            break
except Exception:
    print('', end='')
" 2>/dev/null || true)

if [ -z "$JOB_ID" ]; then
  echo "  No manual bump job found via jobs API — checking latest pipeline directly..."

  LATEST_PIPELINE=$(curl -sS \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "$GITLAB_API/pipelines?ref=main&per_page=1")

  PIPELINE_ID=$(echo "$LATEST_PIPELINE" | python3 -c "
import sys, re, json
raw = re.sub(r'[\x00-\x1f]', '', sys.stdin.read())
try:
    p = json.loads(raw)
    print(p[0]['id'] if isinstance(p, list) and p else '')
except Exception:
    print('', end='')
" 2>/dev/null || true)

  if [ -z "$PIPELINE_ID" ]; then
    echo "Error: Could not fetch pipelines. Check GITLAB_TOKEN and network."
    exit 1
  fi

  echo "  Found pipeline #${PIPELINE_ID}. Fetching its jobs..."
  JOBS_RESPONSE=$(curl -sS \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "$GITLAB_API/pipelines/${PIPELINE_ID}/jobs?per_page=50")

  JOB_ID=$(echo "$JOBS_RESPONSE" | python3 -c "
import sys, re, json
raw = re.sub(r'[\x00-\x1f]', '', sys.stdin.read())
try:
    jobs = json.loads(raw)
    for j in (jobs if isinstance(jobs, list) else []):
        if j.get('name') == 'bump':
            print(j['id'])
            break
except Exception:
    print('', end='')
" 2>/dev/null || true)

  if [ -z "$JOB_ID" ]; then
    echo "Error: Could not find 'bump' job in pipeline #${PIPELINE_ID}."
    echo "Trigger it manually: https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines/${PIPELINE_ID}"
    exit 1
  fi
fi

echo "  Found bump job #${JOB_ID}. Playing it with BUMP_TYPE=${BUMP_TYPE}..."

PLAY_RESPONSE=$(curl -sS --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data "{\"job_variables_attributes\":[{\"key\":\"BUMP_TYPE\",\"value\":\"$BUMP_TYPE\"}]}" \
  "$GITLAB_API/jobs/${JOB_ID}/play")

STATUS=$(echo "$PLAY_RESPONSE" | python3 -c "
import sys, re, json
raw = re.sub(r'[\x00-\x1f]', '', sys.stdin.read())
try:
    d = json.loads(raw)
    print(d.get('status', ''))
except Exception:
    print('', end='')
" 2>/dev/null || true)

if [ -z "$STATUS" ] || [ "$STATUS" = "failed" ]; then
  echo "  Error playing job. Response: $(echo "$PLAY_RESPONSE" | head -c 300)"
  exit 1
fi

PIPELINE_ID=$(echo "$PLAY_RESPONSE" | python3 -c "
import sys, re, json
raw = re.sub(r'[\x00-\x1f]', '', sys.stdin.read())
try:
    d = json.loads(raw)
    print(d.get('pipeline', {}).get('id', ''))
except Exception:
    print('', end='')
" 2>/dev/null || true)

echo ""
echo "✓  Done. Bump job #${JOB_ID} triggered (BUMP_TYPE=$BUMP_TYPE, status=$STATUS)."
echo ""
echo "   The bump job will:"
echo "   1. Increment the $BUMP_TYPE version in package.json"
echo "   2. Push the version commit + git tag"
echo "   3. Tag triggers: build CLI → version.json → deploy website"
echo ""
if [ -n "$PIPELINE_ID" ]; then
  echo "Pipeline: https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines/${PIPELINE_ID}"
else
  echo "Check: https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines"
fi
