# Manthra Windows installer (PowerShell)
# Usage:  iwr https://manthra.informaticsint.au/install.ps1 | iex
#
# Installs the Node.js-based package (manthra-win.cjs + manthra.cmd).
# Does NOT require an unsigned .exe — works under AppLocker / WDAC policies.
# Requires Node.js 18+ (https://nodejs.org).

$ErrorActionPreference = 'Stop'

$BASE_URL  = 'https://manthra.informaticsint.au'
$INSTALL_DIR = "$env:USERPROFILE\.manthra\bin"

Write-Host ''
Write-Host '  Installing Manthra' -ForegroundColor White
Write-Host '  AI coding assistant' -ForegroundColor DarkGray
Write-Host ''

# ── Check Node.js ─────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '  x  Node.js not found.' -ForegroundColor Red
  Write-Host '     Install Node.js 18+ from https://nodejs.org (LTS recommended), then re-run.' -ForegroundColor DarkGray
  exit 1
}
$nodeVer = & node --version
Write-Host "  Node.js: $nodeVer" -ForegroundColor DarkGray

# ── Version ──────────────────────────────────────────────────────────────────
try {
  $version = (Invoke-WebRequest -Uri "$BASE_URL/releases/latest/version.txt" -UseBasicParsing).Content.Trim()
} catch {
  $version = 'latest'
}

Write-Host "  Version: $version"    -ForegroundColor DarkGray
Write-Host "  Install: $INSTALL_DIR" -ForegroundColor DarkGray
Write-Host ''

# ── Download ─────────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

Write-Host '  Downloading...' -ForegroundColor Cyan
Invoke-WebRequest -Uri "$BASE_URL/releases/latest/manthra-win.cjs" `
  -OutFile "$INSTALL_DIR\manthra.cjs" -UseBasicParsing

# Write the CMD launcher (works in CMD and PowerShell)
"@echo off`r`nnode `"%~dp0manthra.cjs`" %*`r`n" |
  Set-Content -Path "$INSTALL_DIR\manthra.cmd" -Encoding ASCII

Write-Host "  v  Installed to $INSTALL_DIR" -ForegroundColor Green

# ── PATH ─────────────────────────────────────────────────────────────────────
$userPath = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
if ($userPath -notlike "*$INSTALL_DIR*") {
  Write-Host ''
  Write-Host '  Adding to PATH...' -ForegroundColor Cyan
  [System.Environment]::SetEnvironmentVariable('PATH', "$INSTALL_DIR;$userPath", 'User')
  $env:PATH = "$INSTALL_DIR;$env:PATH"
  Write-Host '  v  PATH updated — restart your terminal to apply.' -ForegroundColor Green
}

Write-Host ''
Write-Host '  Done!  Run: manthra' -ForegroundColor Green
Write-Host ''
