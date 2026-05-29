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

# # ── Validate bump type ────────────────────────────────────────────────────────
# if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
#   echo "Error: BUMP_TYPE must be patch, minor, or major (got: $BUMP_TYPE)"
#   exit 1
# fi

# echo "╔══════════════════════════════════════════════════╗"
# echo "║  Manthra Mac Release — bump: $BUMP_TYPE$(printf '%*s' $((20 - ${#BUMP_TYPE})) '')║"
# echo "╚══════════════════════════════════════════════════╝"
# echo ""

# # ── Step 1: Build Mac DMGs ────────────────────────────────────────────────────
# echo "▶  Step 1/3 — Building Mac desktop app (arm64 + x64)..."
# echo ""
# npm run electron:package:mac
# echo ""
# echo "✓  Build complete."
# echo ""

# # ── Step 2: Deploy to server ──────────────────────────────────────────────────
# echo "▶  Step 2/3 — Deploying Mac builds to ${VM_HOST}..."
# echo ""

# if [ ! -d "$DESKTOP_DIR" ]; then
#   echo "Error: ${DESKTOP_DIR}/ not found after build."
#   exit 1
# fi

# echo "Files to deploy:"
# find "$DESKTOP_DIR" \( -name "*.dmg" -o -name "*.zip" -o -name "*.yml" \) | sort | while read f; do
#   echo "  $f  ($(du -sh "$f" | cut -f1))"
# done
# echo ""

# rsync -avz --progress \
#   --include="*.dmg" \
#   --include="*.zip" \
#   --include="*.yml" \
#   --exclude="*" \
#   "${DESKTOP_DIR}/" "${VM_HOST}:${REMOTE_DIR}/releases/desktop/"

# echo ""
# echo "✓  Mac builds deployed."
# echo ""

# ── Step 3: Trigger CI — version bump + full pipeline ────────────────────────
echo "▶  Step 3/3 — Triggering CI pipeline (bump: $BUMP_TYPE)..."
echo ""

# Helper: extract a JSON field value without failing the whole script
json_field() {
  local json="$1" field="$2"
  echo "$json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    val = data.get('$field') if isinstance(data, dict) else None
    print(val if val is not None else '')
except Exception:
    print('')
" 2>/dev/null || true
}

# Create a new pipeline on main
echo "  Creating pipeline..."
PIPELINE_RESPONSE=$(curl -sf --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --data "ref=main" \
  "$GITLAB_API/pipelines" 2>&1) || {
    echo "Error: curl failed — check VM_HOST/network or GITLAB_TOKEN."
    echo "  $PIPELINE_RESPONSE"
    exit 1
  }

echo "  API response: $PIPELINE_RESPONSE" | head -c 300
echo ""

PIPELINE_ID=$(json_field "$PIPELINE_RESPONSE" "id")

if [ -z "$PIPELINE_ID" ] || [ "$PIPELINE_ID" = "None" ]; then
  echo "Error: Could not get pipeline ID."
  echo "Full response: $PIPELINE_RESPONSE"
  exit 1
fi

echo "  Pipeline #${PIPELINE_ID} created. Waiting for jobs to initialise..."
sleep 6

# Find the bump job
echo "  Fetching jobs..."
JOBS_RESPONSE=$(curl -sf \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_API/pipelines/${PIPELINE_ID}/jobs?per_page=50" 2>&1) || {
    echo "Error: Could not fetch jobs for pipeline #${PIPELINE_ID}."
    exit 1
  }

JOB_ID=$(echo "$JOBS_RESPONSE" | python3 -c "
import sys, json
try:
    jobs = json.load(sys.stdin)
    for j in (jobs if isinstance(jobs, list) else []):
        if j.get('name') == 'bump':
            print(j['id'])
            break
except Exception as e:
    print('', end='')
" 2>/dev/null || true)

if [ -z "$JOB_ID" ]; then
  echo "Error: Could not find 'bump' job in pipeline #${PIPELINE_ID}."
  echo "Trigger it manually:"
  echo "  https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines/${PIPELINE_ID}"
  exit 1
fi

echo "  Found bump job #${JOB_ID}. Playing it..."

# Play the bump job with the requested BUMP_TYPE
PLAY_RESPONSE=$(curl -sf --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data "{\"job_variables_attributes\":[{\"key\":\"BUMP_TYPE\",\"value\":\"$BUMP_TYPE\"}]}" \
  "$GITLAB_API/jobs/${JOB_ID}/play" 2>&1) || {
    echo "Error: Failed to play bump job #${JOB_ID}."
    echo "  $PLAY_RESPONSE"
    exit 1
  }

echo ""
echo "✓  Done. Bump job #${JOB_ID} triggered (BUMP_TYPE=$BUMP_TYPE)."
echo ""
echo "   The bump job will:"
echo "   1. Increment the $BUMP_TYPE version in package.json"
echo "   2. Push the version commit + git tag"
echo "   3. Tag triggers: build CLI → version.json → deploy website"
echo ""
echo "Pipeline: https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra/-/pipelines/${PIPELINE_ID}"
