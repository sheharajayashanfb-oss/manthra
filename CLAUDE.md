# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm run dev              # Run CLI in dev mode (tsx, no build)
npm run dev:web          # Run web config UI in dev mode (http://localhost:4875)
npm run build            # Compile TypeScript → dist/
npm run build:dist       # Build distributable binaries (releases/)
npm run lint             # Run ESLint on src/
npm run test             # Run Vitest
npm run deploy           # Deploy to VM (requires VM_HOST env var)
```

## Architecture Overview

Manthra is an AI coding assistant CLI with a pluggable provider system. The codebase is organized around a clear data flow:

### Data Flow: CLI → Provider → Streaming Output

1. **CLI Entry** (`src/cli/main.ts`): Parses CLI arguments, initializes config, launches REPL or runs one-shot
2. **REPL** (`src/cli/repl.ts`): Interactive loop that:
   - Reads user input and detects multi-line pastes via coalescing
   - Handles slash commands (`/help`, `/model`, etc.)
   - Builds system prompt (merges defaults + MANTHRA.md instructions + memory context)
   - Calls `provider.chat()` with message history and tools
   - Processes the async stream event-by-event (text, tool calls, thinking)
   - Auto-executes tool calls, appends results to history, re-streams
   - Updates terminal layout (pinned status bar + scrolling content)

### Provider System

**Registry** (`src/providers/registry.ts`):
- Maps provider configs → provider instances
- Supports multiple providers simultaneously; one is "active" at a time
- Currently only Ollama is implemented (stubs for Anthropic/OpenAI/Gemini/OpenRouter/Zen exist in README)

**Provider Interface** (`src/providers/types.ts`):
- `chat(messages, options)` → `AsyncIterable<StreamEvent>`: streams text, tool calls, thinking tokens
- `listModels()`: returns available models
- `testConnection()`: validates provider connectivity
- `embed()`: optional embeddings support

**OllamaProvider** (`src/providers/ollama.ts`):
- Converts Manthra's message/tool format to Ollama API format
- Handles streaming response parsing
- Wraps tools in Ollama's function-calling schema

### Tool System

**Tool Definition** (`src/tools/types.ts`):
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: { type: 'object', properties: {...}, required?: [...] }
  execute(input): Promise<ToolResult>
}
```

**Tool Registry** (`src/tools/registry.ts`):
- Aggregates all tools from: `fs`, `search`, `shell`, `git`, `web`, `agent`, `build`, `infra`, `db`, `safety`, `embed`
- `getToolDefinitions()` exports JSON schema for provider
- `getOllamaToolDefinitions()` wraps schema in Ollama format

**Tool Execution** (`src/tools/executor.ts`):
- Called by REPL when provider emits a tool_call event
- Looks up tool by name, executes it, catches errors, formats output for display
- Silent mode for internal tool calls

**Tool Categories**:
- **fs**: `read`, `write`, `edit`, `list_dir`, `glob`, `grep` (all CWD-aware; operations outside CWD prompt for permission)
- **shell**: `bash`, `run_script` (platform-aware: detects Windows/PowerShell)
- **git**: `git_log`, `git_status`, `git_diff`, `git_add`, `git_commit`, etc.
- **web**: `web_fetch`, `http_request`
- **search**: `search_web`, `search_files`
- **others**: `agent_*` (Manthra internal), `build_*` (npm/gradle/etc.), `db_*` (query), `infra_*` (cloud), `safety_*` (code analysis), `embed_*` (embeddings)

### Configuration

**Loader** (`src/config/loader.ts`):
- Persistent config at `~/.manthra/config.json`
- Lazy-loaded singleton pattern
- Zod schema validation (`src/config/types.ts`)
- Config dir auto-created on first access

**Config Schema** (`src/config/types.ts`):
```typescript
{
  providers: ProviderConfig[]          // list of configured providers
  activeProvider?: string              // currently selected provider ID
  activeModel?: string                 // currently selected model
  systemPrompt?: string                // override default system prompt
  maxTokens: number                    // default 8192
  temperature: number                  // default 0
  webPort: number                      // default 4875
  theme: 'dark' | 'light'             // UI theme
  permissions: Record<string, Permission>  // per-tool permission overrides
}
```

**Auto-Init** (`src/config/auto-init.ts`):
- On first run, if no providers configured, suggests Ollama setup
- Called from `main.ts` before REPL starts

**MANTHRA.md** (`src/config/manthra-md.ts`):
- Loads optional `MANTHRA.md` from launch directory
- Merges its instructions into system prompt (takes highest priority)
- Allows per-project AI behavior customization

### Conversation & Memory

**Conversation History** (`src/conversation/index.ts`):
- Stores messages as `Message[]` (role + content with structured blocks for tools)
- Max 100 messages per session; auto-trims oldest non-system messages
- Provides token estimation (~4 chars per token)
- Save/load to/from JSON files in `~/.manthra/conversations/`

**Persistent Memory** (`src/memory/store.ts`):
- Simple key-value store at `~/.manthra/memory.json`
- Slash commands: `/remember <text>` (add), `/forget <id>` (delete), `/memory` (list)
- Memory auto-injected into system prompt via `formatMemoryForContext()`

### Slash Commands

**Registry** (`src/slash-commands/registry.ts`):
```typescript
interface SlashCommand {
  name: string
  aliases?: string[]
  description: string
  handler(args: string, ctx: CommandContext): Promise<void>
}
```

**Built-in commands**:
- `/exit`: quit session
- `/help`: list commands
- `/clear`: reset conversation history
- `/model <id>`: switch active model
- `/remember <text>`: add to persistent memory
- `/forget <id>`: remove from memory
- `/memory`: list memory entries
- `/init`: scaffold MANTHRA.md
- `/web`: open config UI
- `/context` (alias `/ctx`): show context usage — message count, estimated tokens, % of context window
- `/doctor`: diagnose provider/model setup
- `/think [off|low|medium|high]`: toggle extended thinking
- `/format [off|json]`: set output format

### UI & Rendering

**Renderer** (`src/ui/renderer.ts`):
- Markdown-to-terminal formatter with code blocks, headers, lists, checkboxes
- Token usage display
- Model list printer with badges (free/preview/paid)

**Spinner** (`src/ui/spinner.ts`):
- Thinking animation with randomized phrases

**Terminal Layout** (REPL):
- Fixed scrolling region with pinned status bar (top) and input (bottom)
- Uses VT100 sequences (`\x1B[` codes) for cursor control
- Falls back to simple line-based output if not a TTY

### Web Configuration UI

**Server** (`src/web/server.ts`):
- Express app with CORS on port 4875 (configurable)
- REST API endpoints:
  - `GET /api/providers`, `POST /api/providers`, `PUT /api/providers/:id`, `DELETE /api/providers/:id`
  - `POST /api/providers/:id/test`, `GET /api/providers/:id/models`
  - `POST /api/providers/test-inline`, `POST /api/providers/list-models-inline` (test unsaved configs)
  - `GET /api/config`, `PATCH /api/config`
  - `GET *` → serves inlined HTML/CSS/JS
- Auto-opens browser on startup
- Masks API keys in responses (show last 4 chars only)

**Assets** (`src/web/assets.generated.ts`):
- HTML/CSS/JS inlined at build time via `npm run build:assets`
- Generated from `src/web/public/`

## Key Design Patterns

### Async Streaming
- All provider responses are `AsyncIterable<StreamEvent>` to support live streaming
- REPL consumes stream event-by-event, rendering immediately
- Tool calls pause stream, execute, append result, resume

### CWD-Aware Operations
- All file tools resolve paths relative to `process.cwd()` (launch directory)
- Operations outside CWD require explicit permission (checks `config.permissions`)
- Prevents accidental file modifications in wrong directory

### Zod Validation
- All config and provider schemas validated with Zod
- Invalid configs fallback to defaults gracefully
- Forward-compatible: unknown provider types skipped, unknown config keys ignored

### Message Content Blocks
- Messages can contain mixed content (text + tool calls + tool results + images)
- Supports vision via base64-encoded images with MIME types
- Allows rich provider capabilities (thinking, structured output)

## Building for Distribution

**Regular build** (`npm run build`): ESM → dist/, for development use  
**Distribution build** (`npm run build:dist`): CJS (fully bundled) → releases/, standalone binaries via pkg

The `tsup.config.ts` has two configs:
1. CLI entry: `src/cli/main.ts` → `dist/cli/main.js` (external deps)
2. Web server: `src/web/server.ts` → `dist/web/server.js` (external deps)

The `tsup.config.pkg.ts` (referenced in build:dist script) has similar entries but bundles everything for pkg.

## Important Implementation Details

- **Platform detection** (`src/tools/platform.ts`): detects Windows, PowerShell, WSL, resolved shell
- **Thinking animation**: 200+ randomized phrases in `THINKING[]` array (REPL), cycles through spinner animation
- **Multi-line paste**: REPL enables bracketed paste mode (`\x1B[?2004h`); pasted content is intercepted via a stdin proxy before readline, captured in full between `\x1B[200~` / `\x1B[201~` markers, and submitted as one message
- **Image support**: User can reference images via `@path/to/image.png` in prompts; REPL extracts and base64-encodes them
- **Token accounting**: Session tracks cumulative in/out tokens; REPL displays % of context window used
- **ESC to abort**: While streaming, pressing ESC sends abort signal to cancel generation

## Config File Locations

- Config: `~/.manthra/config.json`
- Memory: `~/.manthra/memory.json`
- Conversations: `~/.manthra/conversations/*.json`

## Type System

- ESM modules with strict TypeScript (`tsconfig.json`: target ES2022, strict: true)
- Declaration maps generated for debugging
- Source maps for error traces
