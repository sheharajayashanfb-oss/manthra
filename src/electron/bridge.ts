import { ipcMain, BrowserWindow, shell, app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadConfig, writeConfig, updateConfig } from '../config/loader.js';
import { autoInitProviders } from '../config/auto-init.js';
import { loadProviders, getDefaultProvider, createProvider } from '../providers/registry.js';
import { ConversationHistory } from '../conversation/index.js';
import { getToolDefinitions, getAllTools, registerDynamicTool } from '../tools/registry.js';
import { executeTool, setPermissionHandler } from '../tools/executor.js';
import { setConfirmHandler } from '../tools/safety.js';
import { createSubAgentTool, subAgentEmitter, type TeamMemberRuntime } from '../tools/sub_agent.js';
import { platformSystemPrompt } from '../tools/platform.js';
import { mcpManager } from '../mcp/manager.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config/defaults.js';
import { formatMemoryForContext, addMemory, listMemory, deleteMemory, clearMemory } from '../memory/store.js';
import { loadAgentsMd } from '../config/agents-md.js';
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { sanitizeMessages } from '../utils/messages.js';
import type { StreamEvent as ProviderStreamEvent, Message } from '../providers/types.js';
import type { PermissionDecision } from '../permissions/index.js';
import { runCompact } from '../slash-commands/compact.js';

const execAsync = promisify(exec);

// ── IPC types ──────────────────────────────────────────────────────────────
export interface StreamEvent {
  type: string;
  delta?: string;
  agentId?: string;
  agentTask?: string;
  agentLabel?: string;
  agentColor?: string;
  toolId?: string;
  toolName?: string;
  toolLabel?: string;
  toolSuccess?: boolean;
  toolOutput?: string;
  agentToolCount?: number;
  message?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messageCount: number;
}

export interface AppConfig {
  activeProvider?: string;
  activeModel?: string;
  activeTeam?: string;
  activeTeamName?: string;
  providers: Array<{ id: string; name: string; type: string; baseURL?: string; enabled: boolean }>;
  maxTokens: number;
  temperature: number;
}

export interface SlashCommandDef {
  name: string;
  description: string;
  args?: boolean;
  placeholder?: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  isCurrent: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  isCurrent: boolean;
  modelCount?: number;
}

export interface TeamInfo {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isCurrent: boolean;
}

export type SlashExecResult =
  | { kind: 'output'; text: string }
  | { kind: 'action'; action: 'clear' | 'exit' | 'open_web' }
  | { kind: 'set_model'; model: string; providerName?: string }
  | { kind: 'set_provider'; providerId: string; providerName: string; model: string }
  | { kind: 'set_team'; teamId: string | null; teamName: string | null }
  | { kind: 'show_model_picker' }
  | { kind: 'show_provider_picker' }
  | { kind: 'show_team_picker' }
  | { kind: 'error'; text: string };

// ── Module-level state ─────────────────────────────────────────────────────
const CONVERSATIONS_DIR = join(homedir(), '.manthra', 'conversations');
let currentAbortController: AbortController | null = null;

function send(win: BrowserWindow, event: StreamEvent): void {
  if (!win.isDestroyed()) win.webContents.send('stream:event', event);
}

function fmtTokens(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

// Gather project context for /init
function gatherProjectContext(cwd: string): string {
  const sections: string[] = [`Project directory: ${cwd}`];
  const tryExec = (cmd: string) => { try { return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch { return ''; } };
  const tryRead = (path: string, max = 3000) => { try { return readFileSync(path, 'utf-8').trim().slice(0, max); } catch { return ''; } };

  const tree = tryExec('find . -maxdepth 2 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" | sort');
  if (tree) sections.push(`File structure:\n${tree}`);

  for (const f of ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod']) {
    const c = tryRead(join(cwd, f), 2000);
    if (c) sections.push(`${f}:\n\`\`\`\n${c}\n\`\`\``);
  }

  const readme = tryRead(join(cwd, 'README.md')) || tryRead(join(cwd, 'README'));
  if (readme) sections.push(`README:\n${readme}`);

  const gitLog = tryExec('git log --oneline -10');
  if (gitLog) sections.push(`Recent git commits:\n${gitLog}`);

  return sections.join('\n\n');
}

export function registerBridge(win: BrowserWindow): void {
  // ── MCP init ───────────────────────────────────────────────────────────────
  let mcpReady = false;
  async function ensureMcp(): Promise<void> {
    if (mcpReady) return;
    mcpReady = true;
    let config = loadConfig();
    ({ config } = autoInitProviders(config));
    loadProviders(config.providers ?? []);
    await mcpManager.initAll();
    for (const tool of mcpManager.getMcpTools()) registerDynamicTool(tool);
  }

  // Forward sub-agent events
  subAgentEmitter.on('agent:start', (e) => { console.log('[bridge] agent:start', e.agentId); send(win, { type: 'agent_start', agentId: e.agentId, agentTask: e.task, agentLabel: e.label, agentColor: e.color }); });
  subAgentEmitter.on('agent:tool_call', (e) => send(win, { type: 'agent_tool_start', agentId: e.agentId, toolId: e.toolId, toolName: e.name, toolLabel: e.label }));
  subAgentEmitter.on('agent:tool_done', (e) => send(win, { type: 'agent_tool_done', agentId: e.agentId, toolId: e.toolId, toolSuccess: e.success }));
  subAgentEmitter.on('agent:done', (e) => { console.log('[bridge] agent:done', e.agentId); send(win, { type: 'agent_done', agentId: e.agentId, agentToolCount: e.toolCount }); });
  subAgentEmitter.on('agent:error', (e) => { console.error('[bridge] agent:error', e.agentId, e.message); send(win, { type: 'agent_error', agentId: e.agentId, message: e.message }); });

  // ── Permission handler ─────────────────────────────────────────────────────
  const pendingPermissions = new Map<string, (decision: PermissionDecision) => void>();
  setPermissionHandler(async (category, label, detail) => {
    const id = randomUUID();
    win.webContents.send('permission:request', { id, tool: category, action: label, details: detail });
    return new Promise<PermissionDecision>((resolve) => { pendingPermissions.set(id, resolve); });
  });
  ipcMain.handle('permission:respond', (_e, id: string, decision: PermissionDecision) => {
    pendingPermissions.get(id)?.(decision);
    pendingPermissions.delete(id);
  });

  // ── Confirm handler (confirm_action tool) ──────────────────────────────────
  const pendingConfirms = new Map<string, (confirmed: boolean) => void>();
  setConfirmHandler(async (action, details) => {
    const id = randomUUID();
    win.webContents.send('confirm:request', { id, action, details });
    return new Promise<boolean>((resolve) => { pendingConfirms.set(id, resolve); });
  });
  ipcMain.handle('confirm:respond', (_e, id: string, confirmed: boolean) => {
    pendingConfirms.get(id)?.(confirmed);
    pendingConfirms.delete(id);
  });

  // ── Chat ───────────────────────────────────────────────────────────────────
  const history = new ConversationHistory();

  ipcMain.handle('chat:new', () => { history.clear(); });
  ipcMain.handle('chat:stop', () => { currentAbortController?.abort(); });

  ipcMain.handle('chat:send', async (_e, message: string, cwd: string, attachments?: Array<{ name: string; mimeType: string; content: string; isImage: boolean }>) => {
    await ensureMcp();
    currentAbortController = new AbortController();
    try { process.chdir(cwd); } catch { /* ignore */ }

    const config = loadConfig();
    loadProviders(config.providers ?? []);

    // Resolve active team
    const activeTeam = config.activeTeam
      ? (config.teams ?? []).find((t) => t.id === config.activeTeam && t.enabled)
      : undefined;
    console.log('[bridge] team mode:', config.activeTeam ?? 'none', '→ resolved:', activeTeam?.name ?? 'NOT FOUND', '| teams in config:', (config.teams ?? []).length);

    let provider = getDefaultProvider(config.providers ?? [], config.activeProvider);
    let model = config.activeModel ?? '';

    // Build team registry — also switches orchestrator provider/model
    let teamRegistry: Map<string, TeamMemberRuntime> | undefined;
    if (activeTeam) {
      teamRegistry = new Map();
      const orchCfg = config.providers.find((p) => p.id === activeTeam.orchestratorProviderId);
      if (orchCfg) { provider = createProvider(orchCfg); model = activeTeam.orchestratorModel; }
      for (const member of activeTeam.members) {
        const memberCfg = config.providers.find((p) => p.id === member.providerId);
        if (!memberCfg) continue;
        try {
          const memberProvider = createProvider(memberCfg);
          const slug = member.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const runtime: TeamMemberRuntime = { provider: memberProvider, model: member.model, tools: member.tools, name: member.name, role: member.role };
          teamRegistry.set(slug, runtime);
          teamRegistry.set(member.id, runtime);
        } catch { /* skip misconfigured member */ }
      }
    }

    if (!provider) {
      send(win, { type: 'error', message: 'No provider configured. Use /web to open settings.' });
      return;
    }

    // Register agent_spawn in the dynamic tool registry (same as CLI does at init)
    const subAgentTool = createSubAgentTool(provider, model, teamRegistry, cwd, currentAbortController.signal);
    registerDynamicTool(subAgentTool);

    // Tool definitions — agent_spawn is now in getToolDefinitions() since registered above
    const allToolDefs = getToolDefinitions();
    // In team mode the orchestrator only delegates — give it only agent_spawn (same as CLI)
    const providerToolDefs = activeTeam ? allToolDefs.filter((t) => t.name === 'agent_spawn') : allToolDefs;

    // Build team / multi-agent system prompt section (matches CLI getSystemPrompt() exactly)
    let agentSection: string | null = null;
    if (activeTeam) {
      const memberLines = activeTeam.members.map((m) => {
        const slug = m.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const toolList = m.tools.length > 0 ? m.tools.join(', ') : 'all tools';
        return `- **${m.name}** (member_id: "${slug}")\n  Role: ${m.role}\n  Available tools: ${toolList}\n  IMPORTANT: This member can ONLY use the tools listed above. Do NOT give them tasks that require other tools.`;
      }).join('\n\n');
      agentSection =
        `# Active Team: ${activeTeam.name}\n\n` +
        (activeTeam.description ? `${activeTeam.description}\n\n` : '') +
        `You are the orchestrator. You MUST delegate ALL work to team members using \`agent_spawn\`. ` +
        `Never attempt to complete tasks directly — always route every subtask to the right member.\n\n` +
        `## Delegation rules\n\n` +
        `1. Read each member's role and available tools carefully before assigning a task.\n` +
        `2. Match the task to the member whose tools can actually accomplish it. A member with only read tools CANNOT write files — assign writes to a member that has write_file.\n` +
        `3. For independent subtasks, spawn ALL relevant members in a SINGLE response with multiple \`agent_spawn\` calls — they execute in parallel. Do NOT call them one at a time.\n` +
        `4. For multi-step tasks where step B depends on step A's output, use separate turns (spawn A, get result, spawn B).\n` +
        `5. Always pass member_id exactly as shown (the slug in quotes).\n` +
        `6. Each task must be fully self-contained — include all file paths, content, URLs, and context the member needs.\n\n` +
        `## Team Members\n\n${memberLines}`;
    } else if (config.multiAgent) {
      agentSection =
        `# Multi-Agent Mode\n\nMulti-agent mode is enabled. You MUST actively use the \`agent_spawn\` tool to delegate work whenever possible. ` +
        `For any task that involves multiple steps, file operations, research, or can be broken into independent parts — always spawn sub-agents rather than doing everything yourself. ` +
        `Each sub-agent has full tool access and runs to completion before returning its result.\n\n` +
        `## CRITICAL: Parallel Execution Rule\n` +
        `When spawning multiple sub-agents for independent tasks, you MUST call ALL \`agent_spawn\` tools in a SINGLE response message — do NOT call them one at a time. ` +
        `The system executes all \`agent_spawn\` calls from a single response concurrently (in parallel). ` +
        `Each task passed to \`agent_spawn\` must be fully self-contained — include all relevant URLs, file paths, and background context.`;
    }

    // Build orchestrator system prompt (matches CLI buildBasePromptParts + getSystemPrompt)
    const agentsMd = loadAgentsMd();
    const memory = formatMemoryForContext();
    const cwdStr = `Current working directory: ${cwd}\n\nIMPORTANT: Always save ALL files, outputs, and artifacts to the current working directory (${cwd}) or subdirectories within it. Never write files to any other location unless the user explicitly specifies a different path.`;
    const platform = platformSystemPrompt();
    const mcpTools = getAllTools().filter((t) => t.name.startsWith('mcp__'));
    const mcpSection = (!activeTeam && mcpTools.length > 0)
      ? `# MCP Tools Available\n\nYou have access to the following MCP (Model Context Protocol) tools:\n\n${mcpTools.map((t) => `- \`${t.name}\`: ${t.description}`).join('\n')}`
      : null;

    const promptParts: (string | null)[] = [
      agentSection,
      agentsMd.content ? `# AGENTS.md — Project Instructions (HIGHEST PRIORITY)\n\n${agentsMd.content}` : null,
      DEFAULT_SYSTEM_PROMPT,
      cwdStr,
      platform,
      memory || null,
      mcpSection,
    ];
    const systemPrompt = promptParts.filter(Boolean).join('\n\n') as string;

    // Add user message to history (do NOT add system prompt to history — prepend fresh each turn like CLI)
    if (attachments && attachments.length > 0) {
      const blocks: import('../providers/types.js').ContentBlock[] = [];
      for (const file of attachments) {
        if (file.isImage) {
          blocks.push({ type: 'image', data: file.content, mimeType: file.mimeType });
        } else {
          const ext = file.name.split('.').pop() ?? '';
          blocks.push({ type: 'text', text: `[Attached file: ${file.name}]\n\`\`\`${ext}\n${file.content}\n\`\`\`` });
        }
      }
      const userText = message.trim() || 'Please review the attached file(s).';
      if (userText) blocks.push({ type: 'text', text: userText });
      history.add({ role: 'user', content: blocks });
    } else {
      history.add({ role: 'user', content: message });
    }

    let totalIn = 0, totalOut = 0;
    try {
      let iterCount = 0;
      while (iterCount < 20) {
        if (currentAbortController.signal.aborted) break;
        iterCount++;

        // Prepend system prompt fresh each iteration (like CLI — never stored in history)
        const messages = sanitizeMessages([
          { role: 'system', content: systemPrompt },
          ...history.get().filter((m) => m.role !== 'system'),
        ]);
        const stream = provider.chat(messages, { model, maxTokens: config.maxTokens, temperature: config.temperature, tools: providerToolDefs });

        let text = '', thinking = '';
        const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

        for await (const event of stream as AsyncIterable<ProviderStreamEvent>) {
          if (currentAbortController.signal.aborted) break;
          if (event.type === 'text_delta' && event.delta) { text += event.delta; send(win, { type: 'text_delta', delta: event.delta }); }
          else if (event.type === 'thinking_delta' && event.delta) { thinking += event.delta; send(win, { type: 'thinking_delta', delta: event.delta }); }
          else if (event.type === 'tool_call_done' && event.tool_call) toolCalls.push({ id: event.tool_call.id, name: event.tool_call.name, input: event.tool_call.input ?? {} });
          if (event.usage) { totalIn += event.usage.input_tokens ?? 0; totalOut += event.usage.output_tokens ?? 0; }
        }

        const assistantBlocks: import('../providers/types.js').ContentBlock[] = [];
        if (thinking) assistantBlocks.push({ type: 'thinking', thinking });
        if (text) assistantBlocks.push({ type: 'text', text });
        for (const tc of toolCalls) assistantBlocks.push({ type: 'tool_call', id: tc.id, name: tc.name, input: tc.input });
        if (assistantBlocks.length > 0) history.add({ role: 'assistant', content: assistantBlocks });
        if (toolCalls.length === 0) break;

        const agentCalls = toolCalls.filter((tc) => tc.name === 'agent_spawn');
        const otherCalls = toolCalls.filter((tc) => tc.name !== 'agent_spawn');

        // Send tool_start for non-agent tools so UI shows them running
        for (const tc of otherCalls) {
          const label = tc.name === 'bash' || tc.name === 'run_script'
            ? `bash — ${String(tc.input['command'] ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)}`
            : tc.name;
          send(win, { type: 'tool_start', toolId: tc.id, toolName: tc.name, toolLabel: label });
        }

        // Execute agent_spawn calls in parallel (subAgentEmitter fires agent:start/done/error events)
        const agentResults = await Promise.all(agentCalls.map(async (tc) => {
          try {
            return { tc, result: await subAgentTool.execute(tc.input) };
          } catch (err) {
            console.error('[bridge] execute() threw unexpectedly:', String(err));
            // agent:error was not emitted from inside execute — the card would stay spinning.
            // This should not happen with the new outer try-catch in sub_agent.ts.
            return { tc, result: { success: false, output: '', error: String(err) } };
          }
        }));

        // Execute other tool calls sequentially (same as CLI)
        const otherResults: Array<{ tc: (typeof otherCalls)[0]; result: Awaited<ReturnType<typeof executeTool>> }> = [];
        for (const tc of otherCalls) {
          const result = await executeTool(tc.name, tc.input);
          send(win, { type: 'tool_done', toolId: tc.id, toolSuccess: result.success, toolOutput: result.output });
          otherResults.push({ tc, result });
        }

        const resultMap = new Map([...agentResults, ...otherResults].map(({ tc, result }) => [tc.id, result]));
        const toolResultBlocks: import('../providers/types.js').ContentBlock[] = [];
        for (const tc of toolCalls) {
          const result = resultMap.get(tc.id)!;
          toolResultBlocks.push({
            type: 'tool_result',
            tool_call_id: tc.id,
            content: result.success ? result.output : `[ERROR] ${result.error ?? 'tool failed'}`,
            is_error: !result.success,
          });
        }
        if (toolResultBlocks.length > 0) history.add({ role: 'user', content: toolResultBlocks });
      }
    } catch (err) {
      send(win, { type: 'error', message: String(err) });
    }

    history.save();
    send(win, { type: 'turn_done', tokensIn: totalIn, tokensOut: totalOut });
  });

  // ── History ────────────────────────────────────────────────────────────────
  ipcMain.handle('history:list', (): ConversationSummary[] => {
    try {
      const files = readdirSync(CONVERSATIONS_DIR).filter((f) => f.endsWith('.json'));
      return files.map((f) => {
        try {
          const raw = JSON.parse(readFileSync(join(CONVERSATIONS_DIR, f), 'utf-8')) as { messages?: Array<{ role: string; content: unknown }>; savedAt?: number };
          const msgs = (Array.isArray(raw) ? raw : raw.messages) ?? [];
          const firstUser = msgs.find((m) => m.role === 'user');
          const preview = typeof firstUser?.content === 'string' ? firstUser.content.slice(0, 80) : 'Conversation';
          return { id: f.replace('.json', ''), title: preview.slice(0, 40) || 'New conversation', preview, timestamp: raw.savedAt ?? 0, messageCount: msgs.length } satisfies ConversationSummary;
        } catch { return null; }
      }).filter(Boolean).sort((a, b) => b!.timestamp - a!.timestamp) as ConversationSummary[];
    } catch { return []; }
  });

  ipcMain.handle('history:load', (_e, id: string) => {
    try {
      const raw = JSON.parse(readFileSync(join(CONVERSATIONS_DIR, `${id}.json`), 'utf-8')) as Message[];
      history.replace(raw);
      return raw;
    } catch { return null; }
  });

  ipcMain.handle('history:delete', (_e, id: string) => {
    try { unlinkSync(join(CONVERSATIONS_DIR, `${id}.json`)); return true; } catch { return false; }
  });

  // ── Config ─────────────────────────────────────────────────────────────────
  ipcMain.handle('config:get', (): AppConfig => {
    const config = loadConfig();
    const activeTeamObj = config.activeTeam
      ? (config.teams ?? []).find((t) => t.id === config.activeTeam && t.enabled)
      : undefined;
    return {
      activeProvider: config.activeProvider,
      activeModel: config.activeModel,
      activeTeam: activeTeamObj?.id,
      activeTeamName: activeTeamObj?.name,
      providers: config.providers.map((p) => ({ id: p.id, name: p.name, type: p.type, baseURL: p.baseURL, enabled: p.enabled })),
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    };
  });

  // ── Slash commands ─────────────────────────────────────────────────────────
  const SLASH_COMMANDS: SlashCommandDef[] = [
    { name: 'help',     description: 'Show all available slash commands' },
    { name: 'clear',    description: 'Clear conversation history and start fresh' },
    { name: 'model',    description: 'Switch the active model (shows picker if no arg)', args: true, placeholder: '[model-name]' },
    { name: 'provider', description: 'Switch the active provider', args: true, placeholder: '[provider-name]' },
    { name: 'team',     description: 'Show or switch the active team', args: true, placeholder: '[team-name | none]' },
    { name: 'remember', description: 'Save a note to persistent memory', args: true, placeholder: '<text>' },
    { name: 'forget',   description: 'Remove a memory entry by ID', args: true, placeholder: '<id>' },
    { name: 'memory',   description: 'List saved memory entries (or /memory clear)', args: true, placeholder: '[clear]' },
    { name: 'context',  description: 'Show current context usage (messages + tokens)' },
    { name: 'compact',  description: 'Summarise conversation to free up context tokens' },
    { name: 'doctor',   description: 'Test connectivity to all configured providers' },
    { name: 'init',     description: 'Generate an AGENTS.md project instructions file', args: true, placeholder: '[--force]' },
    { name: 'web',      description: 'Open the web UI to configure providers and models' },
    { name: 'exit',     description: 'Quit Manthra' },
  ];

  ipcMain.handle('slash:list', (): SlashCommandDef[] => SLASH_COMMANDS);

  // List teams
  ipcMain.handle('slash:list-teams', (): TeamInfo[] => {
    const config = loadConfig();
    return (config.teams ?? [])
      .filter((t) => t.enabled)
      .map((t) => ({ id: t.id, name: t.name, description: t.description, memberCount: t.members.length, isCurrent: t.id === config.activeTeam }));
  });

  // List models from current provider
  ipcMain.handle('slash:list-models', async (): Promise<ModelInfo[]> => {
    const config = loadConfig();
    loadProviders(config.providers ?? []);
    const provider = getDefaultProvider(config.providers ?? [], config.activeProvider);
    if (!provider) return [];
    try {
      const models = await provider.listModels();
      return models.map((m) => ({ id: m.id, name: m.name, isCurrent: m.id === config.activeModel }));
    } catch { return []; }
  });

  // List configured providers
  ipcMain.handle('slash:list-providers', (): ProviderInfo[] => {
    const config = loadConfig();
    return config.providers
      .filter((p) => p.enabled)
      .map((p) => ({ id: p.id, name: p.name, isCurrent: p.id === config.activeProvider }));
  });

  ipcMain.handle('slash:exec', async (_e, name: string, args: string, cwd?: string): Promise<SlashExecResult> => {
    try {
      const config = loadConfig();
      loadProviders(config.providers ?? []);

      switch (name) {
        // ── help ──────────────────────────────────────────────────────────────
        case 'help': {
          const lines = SLASH_COMMANDS.map((c) =>
            `| \`/${c.name}${c.placeholder ? ' ' + c.placeholder : ''}\` | ${c.description} |`
          );
          return {
            kind: 'output',
            text: `### Slash Commands\n\n| Command | Description |\n|---|---|\n${lines.join('\n')}`,
          };
        }

        // ── clear ─────────────────────────────────────────────────────────────
        case 'clear':
          history.clear();
          return { kind: 'action', action: 'clear' };

        // ── remember ──────────────────────────────────────────────────────────
        case 'remember': {
          const text = args.trim();
          if (!text) return { kind: 'error', text: 'Usage: `/remember <text>`' };
          const entry = addMemory(text);
          return { kind: 'output', text: `Memory saved (\`${entry.id}\`):\n\n> ${entry.content}` };
        }

        // ── forget ────────────────────────────────────────────────────────────
        case 'forget': {
          const id = args.trim();
          if (!id) return { kind: 'error', text: 'Usage: `/forget <id>`' };
          const ok = deleteMemory(id);
          return ok
            ? { kind: 'output', text: `Deleted memory \`${id}\`` }
            : { kind: 'error', text: `No memory found with id \`${id}\`` };
        }

        // ── memory ────────────────────────────────────────────────────────────
        case 'memory':
        case 'mem': {
          if (args.trim() === 'clear') {
            clearMemory();
            return { kind: 'output', text: 'All memory entries cleared.' };
          }
          const entries = listMemory();
          if (entries.length === 0)
            return { kind: 'output', text: 'No memories saved yet.\n\nUse `/remember <text>` to save one.' };
          const lines = entries.map((e) => `- **\`${e.id}\`** — ${e.content}`);
          return { kind: 'output', text: `### Memory (${entries.length} entries)\n\n${lines.join('\n')}\n\nUse \`/forget <id>\` to remove an entry.` };
        }

        // ── model ─────────────────────────────────────────────────────────────
        case 'model':
        case 'm': {
          const modelName = args.trim();
          if (!modelName) {
            return { kind: 'show_model_picker' };
          }
          writeConfig({ ...config, activeModel: modelName });
          const provider = getDefaultProvider(config.providers ?? [], config.activeProvider);
          const provName = config.providers.find((p) => p.id === config.activeProvider)?.name;
          return { kind: 'set_model', model: modelName, providerName: provName };
        }

        // ── provider ──────────────────────────────────────────────────────────
        case 'provider':
        case 'prov': {
          const nameArg = args.trim();
          const providers = config.providers.filter((p) => p.enabled);
          if (!nameArg) {
            return { kind: 'show_provider_picker' };
          }
          const found = providers.find((p) => p.name.toLowerCase() === nameArg.toLowerCase() || p.id === nameArg);
          if (!found) return { kind: 'error', text: `Provider not found: \`${nameArg}\`. Use \`/provider\` to list available.` };
          writeConfig({ ...config, activeProvider: found.id, activeModel: found.defaultModel ?? config.activeModel });
          return { kind: 'set_provider', providerId: found.id, providerName: found.name, model: found.defaultModel ?? '' };
        }

        // ── team ─────────────────────────────────────────────────────────────
        case 'team': {
          const nameArg = args.trim();
          const teams = (config.teams ?? []).filter((t) => t.enabled);
          if (!nameArg) {
            return { kind: 'show_team_picker' };
          }
          if (nameArg.toLowerCase() === 'none' || nameArg.toLowerCase() === 'off') {
            updateConfig({ activeTeam: undefined });
            return { kind: 'set_team', teamId: null, teamName: null };
          }
          const found = teams.find((t) => t.name.toLowerCase() === nameArg.toLowerCase() || t.id === nameArg);
          if (!found) return { kind: 'error', text: `Team not found: \`${nameArg}\`. Use \`/team\` to see available teams.` };
          updateConfig({ activeTeam: found.id });
          return { kind: 'set_team', teamId: found.id, teamName: found.name };
        }

        // ── context ───────────────────────────────────────────────────────────
        case 'context':
        case 'ctx': {
          const { total, byRole, estimatedTokens } = history.stats();
          if (total === 0) return { kind: 'output', text: 'No messages in context yet.' };
          const roleStr = Object.entries(byRole).map(([r, n]) => `${n} ${r}`).join(' · ');
          const lines = [
            `**Messages:** ${total} (${roleStr})`,
            `**Estimated tokens:** ~${fmtTokens(estimatedTokens)}`,
          ];
          return { kind: 'output', text: `### Context\n\n${lines.join('\n')}\n\nUse \`/compact\` to summarise or \`/clear\` to reset.` };
        }

        // ── compact ───────────────────────────────────────────────────────────
        case 'compact': {
          const provider = getDefaultProvider(config.providers ?? [], config.activeProvider);
          if (!provider) return { kind: 'error', text: 'No provider configured. Use `/web` to add one.' };
          if (history.length() === 0) return { kind: 'output', text: 'Nothing to compact — conversation is empty.' };
          const model = config.activeModel ?? '';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { before, after } = await runCompact(history, provider as any, model);
          const freed = before - after;
          const pct = before > 0 ? Math.round((freed / before) * 100) : 0;
          return { kind: 'output', text: `**Compacted** — freed ~${fmtTokens(freed)} tokens (${pct}%)\n\n${fmtTokens(before)} → ${fmtTokens(after)} estimated tokens` };
        }

        // ── doctor ────────────────────────────────────────────────────────────
        case 'doctor':
        case 'ping':
        case 'status': {
          const providers = config.providers.filter((p) => p.enabled);
          if (providers.length === 0)
            return { kind: 'output', text: 'No providers configured. Use `/web` to add one.' };

          const results: string[] = [];
          for (const pCfg of providers) {
            try {
              const p = createProvider(pCfg);
              const start = Date.now();
              const models = await p.listModels();
              const ms = Date.now() - start;
              results.push(`- ✅ **${pCfg.name}** — ${models.length} models, ${ms}ms`);
            } catch (err) {
              const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
              results.push(`- ❌ **${pCfg.name}** — ${msg}`);
            }
          }
          return {
            kind: 'output',
            text: `### Doctor\n\n${results.join('\n')}\n\nActive model: **${config.activeModel ?? 'none'}**`,
          };
        }

        // ── init ──────────────────────────────────────────────────────────────
        case 'init': {
          const provider = getDefaultProvider(config.providers ?? [], config.activeProvider);
          if (!provider) return { kind: 'error', text: 'No provider configured. Use `/web` to add one.' };
          const effectiveCwd = cwd ?? process.cwd();
          const outPath = join(effectiveCwd, 'AGENTS.md');
          const force = args.trim() === '--force';
          if (existsSync(outPath) && !force)
            return { kind: 'output', text: `\`AGENTS.md\` already exists.\n\nUse \`/init --force\` to regenerate it.` };

          const context = gatherProjectContext(effectiveCwd);
          const messages: Message[] = [
            { role: 'system', content: 'You generate AGENTS.md files for software projects. Write a concise but complete project briefing that gives an AI coding assistant instant project context. Include: what the project does, how to build/run/test it, key conventions, important files. Be factual and concise.' },
            { role: 'user', content: `Generate AGENTS.md for this project:\n\n${context}` },
          ];

          let content = '';
          const stream = provider.chat(messages, { model: config.activeModel ?? '', maxTokens: 4096, temperature: 0, tools: [] });
          for await (const event of stream as AsyncIterable<ProviderStreamEvent>) {
            if (event.type === 'text_delta' && event.delta) content += event.delta;
          }
          if (!content.trim()) return { kind: 'error', text: 'Provider returned empty response.' };
          if (!content.endsWith('\n')) content += '\n';
          writeFileSync(outPath, content, 'utf-8');

          return { kind: 'output', text: `**AGENTS.md generated** and saved to \`${outPath}\`\n\nManthra will load it automatically on every session in this directory.` };
        }

        // ── web ───────────────────────────────────────────────────────────────
        case 'web':
          shell.openExternal('http://localhost:4875').catch(() => {});
          return { kind: 'action', action: 'open_web' };

        // ── exit ──────────────────────────────────────────────────────────────
        case 'exit':
        case 'quit':
          setTimeout(() => app.quit(), 300);
          return { kind: 'action', action: 'exit' };

        default:
          return { kind: 'error', text: `Unknown command: \`/${name}\`. Use \`/help\` to see all commands.` };
      }
    } catch (err) {
      return { kind: 'error', text: String(err) };
    }
  });

  // ── Auto-updater ───────────────────────────────────────────────────────────
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://manthra.informaticsint.au/releases/desktop',
  } as Parameters<typeof autoUpdater.setFeedURL>[0]);

  const sendUpdate = (event: Record<string, unknown>) => {
    if (!win.isDestroyed()) win.webContents.send('update:event', event);
  };

  autoUpdater.on('checking-for-update', () => sendUpdate({ type: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdate({ type: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdate({ type: 'current' }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ type: 'progress', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ type: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => sendUpdate({ type: 'error', message: err.message }));

  ipcMain.handle('update:check-app', async () => {
    try { await autoUpdater.checkForUpdates(); return { ok: true }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle('update:download-app', async () => {
    try { await autoUpdater.downloadUpdate(); return { ok: true }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle('update:install-app', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Update the CLI binary by running the platform install script
  ipcMain.handle('update:cli', async () => {
    try {
      let cmd: string;
      if (process.platform === 'win32') {
        cmd = `PowerShell -ExecutionPolicy Bypass -Command "iwr -useb https://manthra.informaticsint.au/install.ps1 | iex"`;
      } else {
        cmd = `curl -sSL https://manthra.informaticsint.au/install | bash`;
      }
      const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env['SHELL'] || '/bin/bash');
      const { stdout, stderr } = await execAsync(cmd, { shell, timeout: 120_000 });
      return { ok: true, output: (stdout + stderr).trim() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Check latest version from server (lightweight, no download)
  ipcMain.handle('update:get-versions', async () => {
    try {
      const res = await fetch('https://manthra.informaticsint.au/version.json', { signal: AbortSignal.timeout(5000) });
      const { version: latest } = await res.json() as { version: string };
      return { current: app.getVersion(), latest };
    } catch {
      return { current: app.getVersion(), latest: null };
    }
  });

  // Check for updates automatically 10 s after launch (non-blocking)
  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 10_000);
}
