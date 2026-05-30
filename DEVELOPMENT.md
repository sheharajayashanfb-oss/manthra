# Manthra — Development Guide

## Prerequisites

- **Node.js** 18+ (Node 18 recommended — matches CI and pkg build targets)
- **npm** 8+
- **SSH access** to the VM (`ubuntu@140.245.113.229`) for deployment

---

## Running Locally

### CLI (development mode)

Runs the CLI directly via `tsx` — no build step needed. Changes are picked up immediately.

```bash
npm install
npm run dev
```

### Web config UI

Starts the Express config UI at `http://localhost:4875`.

```bash
npm run dev:web
```

### Electron desktop app (development)

Opens the Electron window with hot-reload via electron-vite.

```bash
npm run electron:dev
```

---

## Building

### CLI — TypeScript → `dist/`

Compiles `src/` to `dist/` (ESM, external deps). For development/testing only.

```bash
npm run build
```

### Web UI assets

Inlines `src/web/public/` (HTML, CSS, JS) into `src/web/assets.generated.ts`.
**Run this after any change to files in `src/web/public/`.**

```bash
npm run build:assets
```

### CLI — distributable binaries → `releases/`

Runs `build:assets` first, then bundles everything into a single CJS file and
compiles self-contained binaries for Linux, macOS, and Windows via `pkg`.

```bash
npm run build:dist
```

Output: `releases/<version>/` and `releases/latest/`

| File | Platform |
|---|---|
| `manthra-linux-x64` | Linux x64 |
| `manthra-linux-arm64` | Linux ARM64 |
| `manthra-macos-x64` | macOS Intel |
| `manthra-macos-arm64` | macOS Apple Silicon |
| `manthra-win-x64.exe` | Windows x64 (binary) |
| `manthra-win.cjs` + `manthra-win.cmd` | Windows (Node.js-based, avoids AppControl blocks) |

### Electron desktop app — macOS DMG

Builds the Electron app and packages it as `.dmg` and `.zip` for arm64 and x64.
Must be run on a Mac.

```bash
npm run electron:package:mac
```

Output: `releases/desktop/`

| File | Platform |
|---|---|
| `Manthra-mac-arm64.dmg` | macOS Apple Silicon |
| `Manthra-mac-x64.dmg` | macOS Intel |
| `Manthra-mac-arm64.zip` | macOS Apple Silicon (for auto-updater) |
| `Manthra-mac-x64.zip` | macOS Intel (for auto-updater) |
| `latest-mac.yml` | Auto-updater manifest |

> **macOS Gatekeeper:** The app is ad-hoc signed (no Apple Developer ID). On first launch,
> right-click the app → **Open** → click **Open**. After that it opens normally.

### Electron desktop app — Windows NSIS installer

Must be run on a Windows machine (or a Windows GitLab runner).

```bash
npm run electron:package:win
```

### Electron desktop app — Linux AppImage

```bash
npm run electron:package:linux
```

---

## Deploying

### Deploy CLI + website to VM

Uploads CLI binaries, install scripts, and the marketing website to the server.

```bash
VM_HOST=ubuntu@140.245.113.229 npm run deploy
```

What it uploads:
- `web/` → `/var/www/manthra/` (marketing site)
- `install.sh` → `/var/www/manthra/install`
- `install.ps1` → `/var/www/manthra/install.ps1`
- `releases/` (excluding `desktop/`) → `/var/www/manthra/releases/`

### Deploy desktop builds to VM

After building any desktop platform, use the deploy script to upload to the server.
Uploads `.dmg`, `.zip`, `.exe`, `.AppImage`, and `.yml` update manifests.

```bash
VM_HOST=ubuntu@140.245.113.229 npm run deploy:desktop
```

What it uploads from `releases/desktop/`:

| File | URL |
|---|---|
| `Manthra-mac-arm64.dmg` | `.../releases/desktop/Manthra-mac-arm64.dmg` |
| `Manthra-mac-x64.dmg` | `.../releases/desktop/Manthra-mac-x64.dmg` |
| `Manthra-win-x64.exe` | `.../releases/desktop/Manthra-win-x64.exe` |
| `Manthra-linux-x64.AppImage` | `.../releases/desktop/Manthra-linux-x64.AppImage` |
| `Manthra-linux-arm64.AppImage` | `.../releases/desktop/Manthra-linux-arm64.AppImage` |
| `latest-mac.yml`, `latest.yml`, `latest-linux.yml` | Auto-updater manifests |

> Requires SSH access to `ubuntu@140.245.113.229`. The script errors if `releases/desktop/` doesn't exist — build first.

### Full Mac release (build + deploy + CI version bump)

The release script does everything in one command:

```bash
./scripts/release-mac.sh           # patch bump (0.x.Y → 0.x.Y+1)
./scripts/release-mac.sh minor     # minor bump (0.X.y → 0.X+1.0)
./scripts/release-mac.sh major     # major bump (X.y.z → X+1.0.0)
```

What it does, step by step:

**Step 1 — Build Mac DMGs** (runs on your Mac):
```
npm run electron:package:mac
→ releases/desktop/Manthra-mac-arm64.dmg
→ releases/desktop/Manthra-mac-x64.dmg
→ releases/desktop/Manthra-mac-*.zip
→ releases/desktop/latest-mac.yml
```

**Step 2 — Deploy to server** (rsync over SSH):
```
releases/desktop/*.dmg  → ubuntu@140.245.113.229:/var/www/manthra/releases/desktop/
releases/desktop/*.zip  → ...
releases/desktop/*.yml  → ...
```

**Step 3 — Trigger CI version bump** (GitLab API):
- Finds the latest manual `bump` job from the most recent pipeline on `main`
- Plays it with `BUMP_TYPE=patch|minor|major`
- The bump job: increments version in `package.json` → commits with `[skip ci]` → pushes tag
- The tag triggers a full CI pipeline: build CLI binaries → generate `version.json` → deploy website

> **Token:** `GITLAB_TOKEN` is read from the environment or falls back to the value hardcoded in the script.
> The token needs at least `read_api` + `write_repository` scopes and Developer role on the project.

### CI/CD pipeline (GitLab)

The pipeline runs automatically on every push to `main` and on git tags.

| Stage | Job | Trigger |
|---|---|---|
| `bump` | `bump` (manual) | Played by `release-mac.sh` or manually in GitLab UI |
| `build` | `build` | Every push to main / every tag |
| `version` | `version` | After `build` |
| `deploy` | `deploy` | After `build` + `version` |

To trigger a version bump manually without the release script:
1. Go to GitLab → CI/CD → Pipelines
2. Find the latest pipeline on `main`
3. Click the `bump` job → Play
4. Set `BUMP_TYPE` to `patch`, `minor`, or `major`

---

## Project structure

```
src/
  cli/          # CLI entry point and REPL
  providers/    # AI provider implementations (Ollama, etc.)
  tools/        # Tool definitions (fs, shell, git, web, ...)
  config/       # Config loader, schema, auto-init
  conversation/ # Conversation history management
  memory/       # Persistent memory store
  slash-commands/ # /help, /model, /remember, etc.
  mcp/          # MCP client and server manager
  web/          # Web config UI (Express + inlined assets)
  ui/           # Terminal renderer, spinner
electron/       # Electron main process, preload
renderer/       # Electron renderer (React + Vite)
web/            # Marketing website
scripts/        # Build, deploy, release scripts
releases/       # Build output (gitignored)
```

## Config and data locations

| Path | Contents |
|---|---|
| `~/.manthra/config.json` | Provider settings, active model, permissions |
| `~/.manthra/memory.json` | Persistent memory entries |
| `~/.manthra/conversations/` | Saved conversation history |
