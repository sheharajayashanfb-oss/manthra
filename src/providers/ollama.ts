import type { Provider, Message, ContentBlock, ChatOptions, StreamEvent, ModelInfo } from './types.js';

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaChatChunk {
  model: string;
  message?: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: Array<{ id?: string; function: { name: string; arguments: Record<string, unknown> } }>;
  };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

function normalizeMessages(messages: Message[]): OllamaMessage[] {
  const result: OllamaMessage[] = [];

  for (const m of messages) {
    if (typeof m.content === 'string') {
      result.push({ role: m.role, content: m.content });
      continue;
    }

    const blocks = m.content as ContentBlock[];
    const textParts: string[] = [];
    const toolCalls: OllamaToolCall[] = [];
    const toolResults: Array<{ content: string }> = [];

    for (const b of blocks) {
      if (b.type === 'text') {
        textParts.push(b.text);
      } else if (b.type === 'tool_call') {
        toolCalls.push({ function: { name: b.name, arguments: b.input } });
      } else if (b.type === 'tool_result') {
        // Prefix error results so the model knows the tool failed
        const content = b.is_error ? `[TOOL ERROR] ${b.content}` : b.content;
        toolResults.push({ content });
      }
    }

    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        result.push({ role: 'tool', content: tr.content });
      }
    } else if (toolCalls.length > 0) {
      result.push({ role: 'assistant', content: textParts.join(''), tool_calls: toolCalls });
    } else {
      result.push({ role: m.role, content: textParts.join('') });
    }
  }

  return result;
}

// Try multiple base URLs in order — handles localhost IPv4/IPv6 variance across OS
async function fetchWithFallback(paths: string[], baseURL: string, headers?: Record<string, string>): Promise<Response> {
  // If the user explicitly set a non-default base URL, use it directly
  const defaults = ['http://localhost:11434', 'http://127.0.0.1:11434'];
  const candidates = defaults.includes(baseURL)
    ? ['http://127.0.0.1:11434', 'http://localhost:11434']
    : [baseURL];

  let lastErr: unknown;
  for (const base of candidates) {
    for (const path of paths) {
      try {
        // Local: 4 s is plenty. Cloud: allow 15 s for TLS + DNS + round-trip.
        const timeoutMs = base.startsWith('https://') ? 15000 : 4000;
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeoutMs), headers });
        if (res.ok) return res;
        // Surface real HTTP errors immediately (401, 403, etc.) — don't try fallbacks
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama error ${res.status}: ${body || res.statusText}`);
      } catch (e) {
        // Re-throw HTTP errors immediately — only retry on network failures
        if (e instanceof Error && /^Ollama error \d+/.test(e.message)) throw e;
        lastErr = e;
      }
    }
  }
  throw new Error(
    `Cannot reach Ollama at ${baseURL}. Make sure Ollama is running.\n` +
    (lastErr ? `Error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : '')
  );
}

interface TextToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Canonical tool names Manthra exposes
const KNOWN_TOOLS = new Set([
  'read', 'write', 'edit', 'multi_edit', 'bash',
  'glob', 'grep', 'list_dir',
  'web_fetch', 'web_search', 'http_request',
  'todo_read', 'todo_write',
  'notebook_read', 'notebook_edit',
]);

// Fuzzy name map — covers aliases, typos, and hallucinated names across Ollama models
const TOOL_NAME_MAP: Record<string, string> = {
  // bash
  bash: 'bash', shell: 'bash', run_bash: 'bash', execute_bash: 'bash',
  run_command: 'bash', execute_command: 'bash', run_shell: 'bash',
  terminal: 'bash', exec: 'bash', cmd: 'bash', sh: 'bash', zsh: 'bash',
  execute: 'bash', run: 'bash', command: 'bash', execute_code: 'bash',
  // read
  read: 'read', read_file: 'read', file_read: 'read', get_file: 'read',
  open_file: 'read', view_file: 'read', cat: 'read', show_file: 'read',
  read_files: 'read', file_content: 'read', get_file_content: 'read',
  // write
  write: 'write', write_file: 'write', create_file: 'write', save_file: 'write',
  create: 'write', new_file: 'write', file_write: 'write', overwrite: 'write',
  // edit
  edit: 'edit', edit_file: 'edit', replace: 'edit', update_file: 'edit',
  patch: 'edit', str_replace: 'edit', str_replace_editor: 'edit',
  file_edit: 'edit', replace_in_file: 'edit', modify_file: 'edit',
  // multi_edit
  multi_edit: 'multi_edit', multi_replace: 'multi_edit', batch_edit: 'multi_edit',
  // list_dir
  list_dir: 'list_dir', ls: 'list_dir', list_files: 'list_dir',
  list_directory: 'list_dir', dir: 'list_dir', list: 'list_dir',
  directory_listing: 'list_dir', get_directory: 'list_dir',
  // glob
  glob: 'glob', find_files: 'glob', find: 'glob', search_files: 'glob',
  file_search: 'glob', glob_files: 'glob',
  // grep
  grep: 'grep', search_content: 'grep', search_in_files: 'grep', rg: 'grep',
  search_code: 'grep', find_in_files: 'grep', search_text: 'grep',
  // web_fetch
  web_fetch: 'web_fetch', fetch: 'web_fetch', fetch_url: 'web_fetch',
  get_url: 'web_fetch', http_get: 'web_fetch', curl: 'web_fetch',
  browse: 'web_fetch', visit: 'web_fetch', open_url: 'web_fetch',
  get_webpage: 'web_fetch', retrieve_url: 'web_fetch', load_url: 'web_fetch',
  // web_search
  web_search: 'web_search', search: 'web_search', search_web: 'web_search',
  google: 'web_search', bing: 'web_search', lookup: 'web_search',
  internet_search: 'web_search', online_search: 'web_search',
  // http_request
  http_request: 'http_request', http: 'http_request', request: 'http_request',
  api_call: 'http_request', api_request: 'http_request',
  // todo
  todo_read: 'todo_read', todo_write: 'todo_write',
  // notebook
  notebook_read: 'notebook_read', notebook_edit: 'notebook_edit',
};

function resolveToolName(raw: string): string | null {
  const key = raw.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  return TOOL_NAME_MAP[key] ?? null;
}

// Primary arg key for each tool — used when model provides a bare string value
const PRIMARY_ARG: Record<string, string> = {
  bash: 'command', read: 'path', write: 'path', edit: 'path',
  list_dir: 'path', glob: 'pattern', grep: 'pattern',
  web_fetch: 'url', web_search: 'query', http_request: 'url',
};

function makeTCId(name: string): string {
  return `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Reject JSON objects that look like project configs / display data, not tool calls
const DISPLAY_FIELDS = new Set(['version', 'dependencies', 'devDependencies', 'scripts', 'license', 'description', 'author', 'main', 'type', 'exports']);

function looksLikeDisplayObject(obj: Record<string, unknown>): boolean {
  return [...DISPLAY_FIELDS].some((f) => obj[f] !== undefined);
}

// Infer tool name from argument shape alone (most-specific match first)
function inferToolFromArgs(args: Record<string, unknown>): string | null {
  if (typeof args.url === 'string') return 'web_fetch';
  if (typeof args.command === 'string') return 'bash';
  if (typeof args.query === 'string') return 'web_search';
  if (typeof args.path === 'string' && typeof args.old_string === 'string' && typeof args.new_string === 'string') return 'edit';
  if (typeof args.path === 'string' && typeof args.content === 'string') return 'write';
  if (typeof args.path === 'string' && typeof args.pattern === 'string') return 'grep';
  if (typeof args.path === 'string') return 'read';
  if (typeof args.pattern === 'string') return 'glob';
  if (typeof args.method === 'string' || typeof args.headers === 'object') return 'http_request';
  return null;
}

// Resolve the arguments object from a parsed JSON blob — handles nested and flat layouts
function resolveArgs(obj: Record<string, unknown>): Record<string, unknown> {
  const nested = obj.arguments ?? obj.input ?? obj.parameters ?? obj.params ?? obj.kwargs;
  return (typeof nested === 'object' && nested !== null)
    ? (nested as Record<string, unknown>)
    : obj;
}

function buildToolCall(name: string, args: Record<string, unknown>): TextToolCall {
  return { id: makeTCId(name), name, input: args };
}

// Parse a JSON string → TextToolCall or null
function tryParseJSON(json: string): TextToolCall | null {
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(json) as Record<string, unknown>; } catch { return null; }

  // 1. Has a valid or fuzzy-matched name
  if (typeof obj.name === 'string') {
    const name = KNOWN_TOOLS.has(obj.name) ? obj.name : resolveToolName(obj.name);
    if (name) {
      const args = resolveArgs(obj);
      return buildToolCall(name, args);
    }
  }

  // 2. No/unknown name — try arg-shape inference
  if (looksLikeDisplayObject(obj)) return null;
  const args = resolveArgs(obj);
  if (!looksLikeDisplayObject(args)) {
    const name = inferToolFromArgs(args);
    if (name) return buildToolCall(name, args);
  }

  return null;
}

/**
 * Extract tool calls from any text a model might produce.
 * Handles 7 formats seen across Ollama models:
 *   1. Native tool_calls API (handled upstream, not here)
 *   2. XML <tool_call> / <function_call> tags
 *   3. Markdown fences ```json / ```tool_call
 *   4. Function-call notation: tool_name({"arg":"val"}) or tool_name("val")
 *   5. Single-line bare JSON
 *   6. Multi-line bare JSON
 *   7. Fuzzy name + arg-shape inference for all of the above
 */
function extractTextToolCalls(text: string): { toolCalls: TextToolCall[]; remainingText: string } {
  const toolCalls: TextToolCall[] = [];
  let remaining = text;

  // ── Pattern 1: XML tool_call / function_call tags ────────────────────────
  // Matches: <tool_call>JSON</tool_call>  <function_call>JSON</function_call>
  remaining = remaining.replace(
    /<(?:tool_call|function_call|tool_use)\b[^>]*>([\s\S]*?)<\/(?:tool_call|function_call|tool_use)>/gi,
    (match, content) => {
      const tc = tryParseJSON(content.trim());
      if (tc) { toolCalls.push(tc); return ''; }
      return match;
    },
  );

  // ── Pattern 2: Anthropic-style XML ──────────────────────────────────────
  // <function_calls><invoke><tool_name>bash</tool_name><parameters>{"command":"ls"}</parameters></invoke></function_calls>
  remaining = remaining.replace(
    /<invoke>\s*<tool_name>([\s\S]*?)<\/tool_name>\s*<parameters>([\s\S]*?)<\/parameters>\s*<\/invoke>/gi,
    (match, toolRaw, paramsRaw) => {
      const name = resolveToolName(toolRaw.trim());
      if (!name) return match;
      let args: Record<string, unknown>;
      try { args = JSON.parse(paramsRaw.trim()); } catch { args = {}; }
      toolCalls.push(buildToolCall(name, args));
      return '';
    },
  );

  // ── Pattern 3: markdown fences (json / tool_call / function / empty) ─────
  remaining = remaining.replace(
    /```(?:json|tool_call|function_call|tool|function)?\s*\n([\s\S]*?)\n```/gi,
    (match, content) => {
      const tc = tryParseJSON(content.trim());
      if (tc) { toolCalls.push(tc); return ''; }
      return match;
    },
  );

  // ── Pattern 4: function-call notation ────────────────────────────────────
  // Matches: bash({"command":"ls"})  read("src/index.ts")  web_fetch("https://...")
  remaining = remaining.replace(
    /^([\w]+)\s*\(\s*((?:\{[\s\S]*?\}|"[^"\n]*"|'[^'\n]*'))\s*\)\s*$/gm,
    (match, fnRaw, argsRaw) => {
      const name = resolveToolName(fnRaw);
      if (!name) return match;
      let args: Record<string, unknown>;
      try {
        const parsed = JSON.parse(argsRaw);
        args = (typeof parsed === 'object' && parsed !== null)
          ? (parsed as Record<string, unknown>)
          : { [PRIMARY_ARG[name] ?? 'value']: parsed };
      } catch {
        const val = argsRaw.replace(/^['"]|['"]$/g, '');
        args = { [PRIMARY_ARG[name] ?? 'value']: val };
      }
      toolCalls.push(buildToolCall(name, args));
      return '';
    },
  );

  // ── Pattern 5: single-line bare JSON ─────────────────────────────────────
  remaining = remaining
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith('{') && t.endsWith('}')) {
        const tc = tryParseJSON(t);
        if (tc) { toolCalls.push(tc); return false; }
      }
      return true;
    })
    .join('\n');

  // ── Pattern 6: multi-line bare JSON ──────────────────────────────────────
  const lines = remaining.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '{' || t.startsWith('{')) {
      const startIdx = i;
      let acc = '';
      let resolved = false;
      for (let j = i; j < Math.min(lines.length, i + 500); j++) {
        acc += (j === i ? '' : '\n') + lines[j];
        let parsed: unknown;
        try { parsed = JSON.parse(acc); } catch { continue; }
        if (typeof parsed === 'object' && parsed !== null) {
          const tc = tryParseJSON(acc);
          if (tc) { toolCalls.push(tc); }
          else { out.push(...lines.slice(startIdx, j + 1)); }
        } else {
          out.push(...lines.slice(startIdx, j + 1));
        }
        i = j + 1;
        resolved = true;
        break;
      }
      if (!resolved) { out.push(lines[i]); i++; }
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  remaining = out.join('\n');

  return { toolCalls, remainingText: remaining };
}

// tryParseToolCall kept as thin alias so native tool_call path still works
function tryParseToolCall(json: string): TextToolCall | null {
  return tryParseJSON(json);
}

export class OllamaProvider implements Provider {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  private baseURL: string;
  private apiKey?: string;

  constructor(config: { id: string; name: string; type: string; baseURL?: string; apiKey?: string }) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.apiKey = config.apiKey;
    // Normalize localhost → 127.0.0.1 to avoid IPv6 resolution issues on some systems.
    // Skip normalization for remote/cloud URLs.
    this.baseURL = (config.baseURL ?? 'http://localhost:11434')
      .replace(/\/$/, '')
      .replace(/^(https?:\/\/)localhost(:\d+)/i, '$1127.0.0.1$2');
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamEvent> {
    const normalized = normalizeMessages(messages);

    const isCloud = this.baseURL.startsWith('https://');

    const body: Record<string, unknown> = {
      model: options.model,
      messages: normalized,
      stream: true,
    };

    // Local Ollama uses nested `options`; cloud uses top-level fields
    if (isCloud) {
      if (options.temperature != null) body['temperature'] = options.temperature;
      if (options.maxTokens != null) body['max_tokens'] = options.maxTokens;
    } else {
      body['options'] = {
        ...(options.temperature != null ? { temperature: options.temperature } : {}),
        ...(options.maxTokens != null ? { num_predict: options.maxTokens } : {}),
      };
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    let response: Response;
    try {
      // Cloud: 60 s connect timeout to catch unreachable endpoints fast.
      // Local: no timeout — generation can take many minutes for complex tasks
      // and AbortSignal.timeout applies to the entire fetch including the stream.
      const signal = isCloud ? AbortSignal.timeout(60000) : undefined;
      response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      // Node.js wraps network errors in error.cause — surface it for debugging
      const cause = (e instanceof Error && (e as Error & { cause?: unknown }).cause);
      const detail = cause instanceof Error ? cause.message : (cause ? String(cause) : '');
      const isCloud = this.baseURL.startsWith('https://');
      const hint = isCloud
        ? '\n  Check: network connectivity, firewall, and API key in `manthra web`.\n  Run `curl ' + this.baseURL + '/api/tags` to verify reachability.'
        : '\n  Make sure Ollama is running: `ollama serve`';
      throw new Error(
        `Cannot reach Ollama at ${this.baseURL}` +
        (detail ? ` — ${detail}` : ' — connection failed') +
        hint
      );
    }

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama error ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let inputTokens = 0;
    let outputTokens = 0;

    // Buffer text content so we can detect Qwen-style text-based tool calls
    // (some models output {"name":"...","arguments":{...}} as plain text instead
    // of using the native tool_calls API field).
    let textBuffer = '';
    let thinkingBuffer = '';
    const nativeToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    const processLine = (line: string) => {
      if (!line.trim()) return;
      let chunk: OllamaChatChunk;
      try { chunk = JSON.parse(line); } catch { return; }

      if (chunk.message?.thinking) {
        thinkingBuffer += chunk.message.thinking;
      }

      if (chunk.message?.content) {
        textBuffer += chunk.message.content;
      }

      if (chunk.message?.tool_calls?.length) {
        for (const tc of chunk.message.tool_calls) {
          nativeToolCalls.push({
            id: tc.id ?? `${tc.function.name}_${Date.now()}`,
            name: tc.function.name,
            input: tc.function.arguments ?? {},
          });
        }
      }

      if (chunk.done) {
        if (chunk.prompt_eval_count) inputTokens = chunk.prompt_eval_count;
        if (chunk.eval_count) outputTokens = chunk.eval_count;
      }
    };

    try {
      // lineBuffer accumulates partial lines that span chunk boundaries
      let lineBuffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        const lines = (lineBuffer + raw).split('\n');
        // Last element may be an incomplete line — hold it for the next iteration
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) processLine(line);
      }
      // Flush decoder internal buffer and any remaining line
      const tail = decoder.decode();
      if (tail) lineBuffer += tail;
      if (lineBuffer.trim()) processLine(lineBuffer);
    } finally {
      reader.releaseLock();
    }

    // Emit thinking first (if any)
    if (thinkingBuffer) {
      yield { type: 'thinking_delta', delta: thinkingBuffer };
    }

    // Emit tool calls + text in order
    if (nativeToolCalls.length > 0) {
      // Native API tool calls take precedence
      for (const tc of nativeToolCalls) {
        yield { type: 'tool_call_done', tool_call: tc };
      }
      if (textBuffer.trim()) yield { type: 'text_delta', delta: textBuffer };
    } else {
      // Fall back: scan text for Qwen/text-based tool calls
      const { toolCalls, remainingText } = extractTextToolCalls(textBuffer);
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          yield { type: 'tool_call_done', tool_call: tc };
        }
        if (remainingText.trim()) yield { type: 'text_delta', delta: remainingText };
      } else {
        if (textBuffer.trim()) yield { type: 'text_delta', delta: textBuffer };
      }
    }

    yield { type: 'message_done', usage: { input_tokens: inputTokens, output_tokens: outputTokens } };
  }

  async listModels(): Promise<ModelInfo[]> {
    // Throws on failure so the web UI can surface the real error
    const res = await fetchWithFallback(['/api/tags'], this.baseURL, this.authHeaders());
    const data = await res.json() as { models?: OllamaModel[] };
    return (data.models ?? []).map((m) => ({ id: m.name, name: m.name }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await fetchWithFallback(['/api/tags'], this.baseURL, this.authHeaders());
      return true;
    } catch {
      return false;
    }
  }
}
