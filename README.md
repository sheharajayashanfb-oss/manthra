# Manthra

AI coding assistant CLI with multi-provider support. Run it from any project directory — Manthra reads, edits, and creates files relative to where you launched it.

```
curl -fsSL https://manthra.informaticsint.au/install | bash
```

---

## Features

- **Multi-provider** — Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Ollama (local), Zen
- **Tool use** — reads files, edits files, runs shell commands, searches the web, makes HTTP requests
- **CWD-aware** — all file operations default to your launch directory; operations outside it require explicit permission
- **Web UI** — configure providers and models via a local browser interface (`manthra web`)
- **Persistent memory** — stores context across sessions
- **Streaming** — live thinking tokens, formatted markdown output
- **Fixed terminal layout** — status bar and input stay pinned at the bottom as responses scroll above

---

## Installation

### Linux & macOS

```bash
curl -fsSL https://manthra.informaticsint.au/install | bash
```

The installer detects your OS and architecture, downloads the right pre-built binary to `~/.local/bin/manthra`, and prompts you to add it to `$PATH` if needed.

**Supported platforms:** Linux x64, Linux arm64, macOS x64, macOS arm64

### Windows

> **Windows support is planned but not yet available.** A native binary and PowerShell installer are on the roadmap.

In the meantime, Windows users can run Manthra through one of these options:

**Option 1 — WSL (recommended)**
```bash
# Inside a WSL terminal (Ubuntu, Debian, etc.)
curl -fsSL https://manthra.informaticsint.au/install | bash
```

**Option 2 — Git Bash**
```bash
# Inside Git Bash
curl -fsSL https://manthra.informaticsint.au/install | bash
```

**Option 3 — Run from source**
```powershell
# Requires Node.js 18+ installed
git clone https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra.git
cd manthra
npm install
npm run dev
```

> **Terminal note:** The fixed-bottom layout (pinned status bar + input) uses ANSI VT sequences that require **Windows Terminal** on Windows 10/11. The app will still work in other terminals but the layout may not render correctly.

### Manual install

Download a binary directly from the releases page:

```
https://manthra.informaticsint.au/releases/latest/manthra-linux-x64
https://manthra.informaticsint.au/releases/latest/manthra-linux-arm64
https://manthra.informaticsint.au/releases/latest/manthra-macos-x64
https://manthra.informaticsint.au/releases/latest/manthra-macos-arm64
```

```bash
chmod +x manthra-linux-x64
mv manthra-linux-x64 ~/.local/bin/manthra
```

### Install a specific version

```bash
curl -fsSL https://manthra.informaticsint.au/releases/0.1.0/manthra-linux-x64 -o manthra
chmod +x manthra && mv manthra ~/.local/bin/manthra
```

---

## Quick start

```bash
# Launch in any project directory
cd ~/my-project
manthra
```

On first run, Manthra opens a browser to configure your provider and model. Alternatively:

```bash
manthra web   # open the web config UI manually
```

Once configured, just type your task at the prompt:

```
  ■  Chat  ·  Anthropic  ·  claude-sonnet-4-5  ·  0s
  [your message here]
```

---

## Providers

| Provider | Key required | Local |
|---|---|---|
| Anthropic | Yes (`ANTHROPIC_API_KEY`) | No |
| OpenAI | Yes (`OPENAI_API_KEY`) | No |
| Google Gemini | Yes (`GEMINI_API_KEY`) | No |
| OpenRouter | Yes (`OPENROUTER_API_KEY`) | No |
| Ollama | No | Yes |
| Zen | No | Yes |

Configure providers and models through the web UI (`manthra web`) or by editing `~/.manthra/config.json`.

---

## Tools

Manthra gives the AI access to the following tools:

| Tool | Description | Auto-allowed |
|---|---|---|
| `read` | Read file contents (with optional line range) | Always |
| `write` | Create or overwrite a file | Within CWD |
| `edit` | Replace an exact string in a file | Within CWD |
| `list_dir` | List directory contents | Always |
| `glob` | Find files by pattern | Always |
| `grep` | Search file contents | Always |
| `bash` | Run a shell command | Always |
| `web_fetch` | Fetch a URL | Always |
| `http_request` | Make an HTTP request | Always |

**Permission model:** file write/edit operations within your launch directory are auto-allowed. Operations targeting paths outside your launch directory prompt for confirmation.

---

## Slash commands

| Command | Description |
|---|---|
| `/exit` | Exit the session |

More commands can be added in `src/slash-commands/`.

---

## CLI flags

```bash
manthra [options] [message]

Options:
  --print, -p   Run a single prompt and exit (non-interactive)
  --web         Open the web config UI
  --help, -h    Show help

Examples:
  manthra                             # interactive session
  manthra --print "explain this repo" # one-shot output
  manthra web                         # open config UI
```

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://gitlab.informaticsint.au/infoins-v4/info-ai/manthra.git
cd manthra
npm install
```

### Run in dev mode

```bash
npm run dev          # CLI (uses tsx, no build step)
npm run dev:web      # web config UI
```

### Build

```bash
npm run build        # compile TypeScript → dist/
```

### Project structure

```
src/
├── cli/            # REPL, main entry point
├── config/         # config loading, defaults, types
├── conversation/   # message history
├── memory/         # persistent session memory
├── providers/      # AI provider adapters (Anthropic, OpenAI, Gemini, OpenRouter, Ollama, Zen)
├── slash-commands/ # /command handlers
├── tools/          # tool implementations (read, write, edit, bash, glob, grep, …)
├── ui/             # terminal rendering, markdown formatter
└── web/            # Express web UI for configuration

deploy/             # VM setup and nginx config
scripts/            # build and deploy scripts
```

---

## Building for distribution

Manthra ships as standalone binaries (no Node.js required on the target machine) built with [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).

### 1. Build binaries

```bash
npm run build:dist
```

This runs `tsup` with a fully-bundled CJS config (`tsup.config.pkg.ts`) — all dependencies inlined — then `pkg` compiles it into four platform binaries under `releases/<version>/` and `releases/latest/`.

```
releases/
├── latest/
│   ├── version.txt
│   ├── manthra-linux-x64
│   ├── manthra-linux-arm64
│   ├── manthra-macos-x64
│   └── manthra-macos-arm64
└── 0.1.0/
    └── ...
```

### 2. First-time VM setup

> Make sure the DNS `A` record for `manthra.informaticsint.au` points to your VM's IP before running this. Certbot will fail if DNS isn't resolving yet.

Copy the nginx config to the VM and run the setup script:

```bash
scp deploy/nginx.conf ubuntu@your-vm-ip:/tmp/manthra-nginx.conf
ssh ubuntu@your-vm-ip 'bash -s' < deploy/setup-vm.sh
```

This installs nginx, creates `/var/www/manthra`, and obtains a Let's Encrypt TLS certificate for `manthra.informaticsint.au`.

### 3. Deploy a release

```bash
VM_HOST=ubuntu@your-vm-ip npm run deploy
```

Uploads `releases/` and `install.sh` to the VM via rsync. The install script is served at `/install` (no `.sh` extension) with `Content-Type: text/plain`.

### 4. Releasing a new version

1. Bump the version in `package.json`
2. `npm run build:dist`
3. `VM_HOST=ubuntu@your-vm-ip npm run deploy`

---

## Configuration file

`~/.manthra/config.json`

```json
{
  "providers": [
    {
      "name": "Anthropic",
      "apiKey": "sk-ant-..."
    }
  ],
  "activeProvider": "Anthropic",
  "activeModel": "claude-sonnet-4-5",
  "maxTokens": 8192,
  "temperature": 0
}
```

---

## License

MIT — Informatics International
