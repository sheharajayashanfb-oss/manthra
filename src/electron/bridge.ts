import { ipcMain, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { loadConfig, saveConfig } from '../config/loader.js';
import { autoInitProviders } from '../config/auto-init.js';
import { loadProviders, getDefaultProvider } from '../providers/registry.js';
import { ConversationHistory } from '../conversation/index.js';
import { getToolDefinitions, registerDynamicTool, getAllTools } from '../tools/registry.js';
import { executeTool, setPermissionHandler } from '../tools/executor.js';
import { createSubAgentTool, subAgentEmitter } from '../tools/sub_agent.js';
import { mcpManager } from '../mcp/manager.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config/defaults.js';
import { formatMemoryForContext } from '../memory/store.js';
import { loadAgentsMd } from '../config/agents-md.js';
import { readdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { sanitizeMessages } from '../utils/messages.js';
import type { StreamEvent as ProviderStreamEvent } from '../providers/types.js';
import type { StreamEvent as IpcStreamEvent, ConversationSummary, AppConfig } from '../../electron/main/ipc-types.js';

const CONVERSATIONS_DIR = join(homedir(), '.manthra', 'conversations');

let currentAbortController: AbortController | null = null;

function send(win: BrowserWindow, event: IpcStreamEvent): void {
  if (!win.isDestroyed()) win.webContents.send('stream:event', event);
}

export function registerBridge(win: BrowserWindow): void {
  // ── Init MCP + sub-agent event forwarding ──────────────────────────────────
  let mcpReady = false;
  async function ensureMcp(): Promise<void> {
    if (mcpReady) return;
    mcpReady = true;
    let config = loadConfig();
    ({ config } = autoInitProviders(config));
    await loadProviders(config);
    const results = await mcpManager.initAll();
    for (const { tools } of results.filter((r) => r.ok)) {
      for (const t of tools ?? []) registerDynamicTool(t);
    }
  }

  // Forward sub-agent events to renderer
  subAgentEmitter.on('agent:start', (e) => send(win, { type: 'agent_start', agentId: e.agentId, agentTask: e.task, agentLabel: e.label, agentColor: e.color }));
  subAgentEmitter.on('agent:tool_call', (e) => send(win, { type: 'agent_tool_start', agentId: e.agentId, toolId: e.toolId, toolName: e.name, toolLabel: e.label }));
  subAgentEmitter.on('agent:tool_done', (e) => send(win, { type: 'agent_tool_done', agentId: e.agentId, toolId: e.toolId, toolSuccess: e.success }));
  subAgentEmitter.on('agent:done', (e) => send(win, { type: 'agent_done', agentId: e.agentId, agentToolCount: e.toolCount }));
  subAgentEmitter.on('agent:error', (e) => send(win, { type: 'agent_error', agentId: e.agentId, message: e.message }));

  // ── Permission handler ─────────────────────────────────────────────────────
  const pendingPermissions = new Map<string, (decision: 'allow' | 'deny' | 'allow_always') => void>();

  setPermissionHandler(async (tool, action, details) => {
    const id = randomUUID();
    win.webContents.send('permission:request', { id, tool, action, details });
    return new Promise((resolve) => {
      pendingPermissions.set(id, resolve);
    });
  });

  ipcMain.handle('permission:respond', (_e, id: string, decision: 'allow' | 'deny' | 'allow_always') => {
    pendingPermissions.get(id)?.(decision);
    pendingPermissions.delete(id);
  });

  // ── Chat ───────────────────────────────────────────────────────────────────
  const history = new ConversationHistory();

  ipcMain.handle('chat:new', () => {
    history.clear();
  });

  ipcMain.handle('chat:stop', () => {
    currentAbortController?.abort();
  });

  ipcMain.handle('chat:send', async (_e, message: string, cwd: string, _conversationId?: string) => {
    await ensureMcp();
    currentAbortController = new AbortController();

    // Change working directory to user-selected path
    try { process.chdir(cwd); } catch { /* ignore if invalid */ }

    const config = loadConfig();
    const provider = getDefaultProvider();
    if (!provider) {
      send(win, { type: 'error', message: 'No provider configured. Open Settings to add one.' });
      return;
    }

    const model = config.activeModel ?? '';
    const subAgentTool = createSubAgentTool(provider, model);
    const allToolDefs = [...getToolDefinitions(), {
      name: subAgentTool.name,
      description: subAgentTool.description,
      parameters: subAgentTool.parameters,
    }];

    // Build system prompt
    const agentsMd = loadAgentsMd();
    const memory = formatMemoryForContext();
    const parts = [DEFAULT_SYSTEM_PROMPT];
    if (agentsMd) parts.unshift(agentsMd);
    if (memory) parts.push(memory);
    const systemPrompt = parts.join('\n\n');

    if (history.getMessages().length === 0) {
      history.add({ role: 'system', content: systemPrompt });
    }
    history.add({ role: 'user', content: message });

    const MAX_ITER = 20;
    let iterCount = 0;
    let totalIn = 0;
    let totalOut = 0;

    try {
      while (iterCount < MAX_ITER) {
        if (currentAbortController.signal.aborted) break;
        iterCount++;

        const messages = sanitizeMessages(history.getMessages());
        const stream = provider.chat(messages, {
          model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          tools: allToolDefs,
        });

        let text = '';
        let thinking = '';
        const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

        for await (const event of stream as AsyncIterable<ProviderStreamEvent>) {
          if (currentAbortController.signal.aborted) break;
          if (event.type === 'text_delta' && event.delta) {
            text += event.delta;
            send(win, { type: 'text_delta', delta: event.delta });
          } else if (event.type === 'thinking_delta' && event.delta) {
            thinking += event.delta;
            send(win, { type: 'thinking_delta', delta: event.delta });
          } else if (event.type === 'tool_call_done' && event.tool_call) {
            toolCalls.push({ id: event.tool_call.id, name: event.tool_call.name, input: event.tool_call.input ?? {} });
          } else if (event.type === 'usage') {
            totalIn += event.inputTokens ?? 0;
            totalOut += event.outputTokens ?? 0;
          }
        }

        // Add assistant message to history
        const assistantBlocks: import('../providers/types.js').ContentBlock[] = [];
        if (thinking) assistantBlocks.push({ type: 'thinking', thinking });
        if (text) assistantBlocks.push({ type: 'text', text });
        for (const tc of toolCalls) {
          assistantBlocks.push({ type: 'tool_call', id: tc.id, name: tc.name, input: tc.input });
        }
        if (assistantBlocks.length > 0) history.add({ role: 'assistant', content: assistantBlocks });

        if (toolCalls.length === 0) break;

        // Execute tools — agent_spawn in parallel, others sequential
        const agentCalls = toolCalls.filter((tc) => tc.name === 'agent_spawn');
        const otherCalls = toolCalls.filter((tc) => tc.name !== 'agent_spawn');

        // Notify renderer of each non-agent tool start
        for (const tc of otherCalls) {
          const label = tc.name === 'bash' || tc.name === 'run_script'
            ? `bash - ${String(tc.input['command'] ?? '').replace(/\s+/g, ' ').trim()}`
            : tc.name;
          send(win, { type: 'tool_start', toolId: tc.id, toolName: tc.name, toolLabel: label });
        }

        const agentResults = await Promise.all(
          agentCalls.map(async (tc) => ({ tc, result: await executeTool(tc.name, tc.input) })),
        );

        const otherResults: Array<{ tc: typeof otherCalls[0]; result: Awaited<ReturnType<typeof executeTool>> }> = [];
        for (const tc of otherCalls) {
          const result = await executeTool(tc.name, tc.input, { silent: true });
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

    // Save conversation
    history.save();

    send(win, { type: 'turn_done', tokensIn: totalIn, tokensOut: totalOut });
  });

  // ── History ────────────────────────────────────────────────────────────────
  ipcMain.handle('history:list', (): ConversationSummary[] => {
    try {
      const files = readdirSync(CONVERSATIONS_DIR).filter((f) => f.endsWith('.json'));
      return files.map((f) => {
        try {
          const raw = JSON.parse(readFileSync(join(CONVERSATIONS_DIR, f), 'utf-8')) as {
            messages?: Array<{ role: string; content: unknown }>;
            savedAt?: number;
          };
          const msgs = raw.messages ?? [];
          const firstUser = msgs.find((m) => m.role === 'user');
          const preview = typeof firstUser?.content === 'string'
            ? firstUser.content.slice(0, 80)
            : 'Conversation';
          return {
            id: f.replace('.json', ''),
            title: preview.slice(0, 40) || 'New conversation',
            preview,
            timestamp: raw.savedAt ?? 0,
            messageCount: msgs.length,
          } satisfies ConversationSummary;
        } catch { return null; }
      }).filter(Boolean).sort((a, b) => b!.timestamp - a!.timestamp) as ConversationSummary[];
    } catch { return []; }
  });

  ipcMain.handle('history:load', (_e, id: string) => {
    try {
      const raw = JSON.parse(readFileSync(join(CONVERSATIONS_DIR, `${id}.json`), 'utf-8'));
      history.load(raw);
      return raw;
    } catch { return null; }
  });

  ipcMain.handle('history:delete', (_e, id: string) => {
    try { unlinkSync(join(CONVERSATIONS_DIR, `${id}.json`)); return true; } catch { return false; }
  });

  // ── Config ─────────────────────────────────────────────────────────────────
  ipcMain.handle('config:get', (): AppConfig => {
    const config = loadConfig();
    return {
      activeProvider: config.activeProvider,
      activeModel: config.activeModel,
      providers: config.providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        baseURL: p.baseURL,
        enabled: p.enabled,
      })),
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    };
  });
}
