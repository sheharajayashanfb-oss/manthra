#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://manthra.informaticsint.au"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# ── colours ──────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; DIM='\033[2m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; BLUE=''; DIM=''; NC=''
fi

info()    { echo -e "  ${BLUE}${1}${NC}"; }
success() { echo -e "  ${GREEN}✓  ${1}${NC}"; }
die()     { echo -e "  ✗  ${1}" >&2; exit 1; }

echo ""
echo -e "${BOLD}  Installing Manthra${NC}"
echo -e "${DIM}  AI coding assistant${NC}"
echo ""

# ── platform detection ───────────────────────────────────────────────────────
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$OS" in
  darwin) OS="macos" ;;
  linux)  OS="linux" ;;
  *)      die "Unsupported OS: $OS (supported: linux, macos)" ;;
esac

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)         ARCH="x64" ;;
  aarch64|arm64)  ARCH="arm64" ;;
  *)              die "Unsupported architecture: $ARCH (supported: x64, arm64)" ;;
esac

BINARY="manthra-${OS}-${ARCH}"
BINARY_URL="${BASE_URL}/releases/latest/${BINARY}"
VERSION=$(curl -fsSL "${BASE_URL}/releases/latest/version.txt" 2>/dev/null || echo "latest")

info "Version:   ${VERSION}"
info "Platform:  ${OS}-${ARCH}"
info "Install to: ${INSTALL_DIR}"
echo ""

# ── download ─────────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

info "Downloading..."
if ! curl -fsSL --progress-bar "$BINARY_URL" -o "$TMP"; then
  die "Download failed.\n  URL: ${BINARY_URL}\n  Check your internet connection or visit https://manthra.informaticsint.au"
fi

chmod +x "$TMP"
mv "$TMP" "${INSTALL_DIR}/manthra"

success "Installed to ${INSTALL_DIR}/manthra"

# ── PATH check ───────────────────────────────────────────────────────────────
if ! command -v manthra &>/dev/null 2>&1; then
  echo ""
  echo -e "  ${BOLD}One more step:${NC} add ${INSTALL_DIR} to your PATH."
  echo ""

  SHELL_RC=""
  case "${SHELL:-}" in
    */zsh)  SHELL_RC="$HOME/.zshrc" ;;
    */bash) SHELL_RC="$HOME/.bashrc" ;;
  esac

  if [ -n "$SHELL_RC" ]; then
    echo -e "  Run this, then restart your terminal:"
    echo ""
    echo -e "  ${DIM}echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ${SHELL_RC}${NC}"
    echo ""
  else
    echo "  Add this line to your shell config:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
  fi
fi

echo -e "  ${GREEN}${BOLD}Done!${NC}  Run: manthra"
echo ""
