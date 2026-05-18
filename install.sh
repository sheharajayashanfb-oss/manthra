#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://manthra.informaticsint.au"
INSTALL_DIR="${INSTALL_DIR:-}"

# ── colours ──────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; DIM='\033[2m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; BLUE=''; DIM=''; NC=''
fi

info()    { echo -e "  ${BLUE}${1}${NC}"; }
success() { echo -e "  ${GREEN}✓  ${1}${NC}"; }
warn()    { echo -e "  ${BOLD}!  ${1}${NC}"; }
die()     { echo -e "  ✗  ${1}" >&2; exit 1; }

echo ""
echo -e "${BOLD}  Installing Manthra${NC}"
echo -e "${DIM}  AI coding assistant${NC}"
echo ""

# ── platform detection ───────────────────────────────────────────────────────
RAW_OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$RAW_OS" in
  darwin)
    OS="macos"
    ;;
  linux)
    OS="linux"
    ;;
  mingw*|msys*|cygwin*)
    OS="windows"
    ;;
  *)
    die "Unsupported OS: $RAW_OS (supported: linux, macos, windows/Git Bash)"
    ;;
esac

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)        ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)             die "Unsupported architecture: $ARCH (supported: x64, arm64)" ;;
esac

# Windows only has x64 binary
if [ "$OS" = "windows" ] && [ "$ARCH" != "x64" ]; then
  die "Windows arm64 is not yet supported. Please use WSL2 on arm64 Windows."
fi

# ── resolve binary name and install dir ──────────────────────────────────────
if [ "$OS" = "windows" ]; then
  BINARY="manthra-win-x64.exe"
  [ -z "$INSTALL_DIR" ] && INSTALL_DIR="$HOME/bin"
else
  BINARY="manthra-${OS}-${ARCH}"
  [ -z "$INSTALL_DIR" ] && INSTALL_DIR="$HOME/.local/bin"
fi

BINARY_URL="${BASE_URL}/releases/latest/${BINARY}"
VERSION=$(curl -fsSL "${BASE_URL}/releases/latest/version.txt" 2>/dev/null || echo "latest")

info "Version:    ${VERSION}"
info "Platform:   ${OS}-${ARCH}"
info "Install to: ${INSTALL_DIR}"
echo ""

# ── download ─────────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

info "Downloading..."
if ! curl -fsSL --progress-bar "$BINARY_URL" -o "$TMP"; then
  die "Download failed.\n  URL: ${BINARY_URL}\n  Check your connection or visit https://manthra.informaticsint.au"
fi

chmod +x "$TMP"

# Strip quarantine on the temp file before moving so macOS doesn't re-flag it
if [ "$OS" = "macos" ] && command -v xattr &>/dev/null; then
  xattr -c "$TMP" 2>/dev/null || true
fi

if [ "$OS" = "windows" ]; then
  DEST="${INSTALL_DIR}/manthra.exe"
  mv "$TMP" "$DEST"
  success "Installed to ${DEST}"
else
  DEST="${INSTALL_DIR}/manthra"
  mv "$TMP" "$DEST"
  success "Installed to ${DEST}"
fi

# Strip quarantine and ad-hoc sign so Gatekeeper allows the binary
if [ "$OS" = "macos" ]; then
  command -v xattr    &>/dev/null && xattr -c "$DEST" 2>/dev/null || true
  command -v codesign &>/dev/null && codesign --force --deep --sign - "$DEST" 2>/dev/null || true
fi

# ── PATH check ───────────────────────────────────────────────────────────────
if ! command -v manthra &>/dev/null 2>&1; then
  echo ""
  warn "One more step: add ${INSTALL_DIR} to your PATH."
  echo ""

  if [ "$OS" = "windows" ]; then
    echo -e "  Add this to your ${DIM}~/.bashrc${NC} (Git Bash):"
    echo ""
    echo -e "  ${DIM}export PATH=\"\$HOME/bin:\$PATH\"${NC}"
    echo ""
    echo -e "  Then restart Git Bash, or run:"
    echo -e "  ${DIM}source ~/.bashrc${NC}"
  else
    # On macOS, bash login shells read .bash_profile (not .bashrc).
    # On Linux, bash reads .bashrc for interactive shells.
    SHELL_RC=""
    case "${SHELL:-}" in
      */zsh)
        SHELL_RC="$HOME/.zshrc"
        ;;
      */bash)
        if [ "$OS" = "macos" ]; then
          SHELL_RC="$HOME/.bash_profile"
        else
          SHELL_RC="$HOME/.bashrc"
        fi
        ;;
    esac

    if [ -n "$SHELL_RC" ]; then
      echo -e "  Run this, then restart your terminal:"
      echo ""
      echo -e "  ${DIM}echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ${SHELL_RC}${NC}"
      echo ""
      echo -e "  Or apply immediately without restarting:"
      echo -e "  ${DIM}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
      echo ""
    else
      echo "  Add this line to your shell config:"
      echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
    fi
  fi
fi

echo -e "  ${GREEN}${BOLD}Done!${NC}  Run: manthra"
echo ""
