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
        toolResults.push({ content: b.content });
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
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(4000), headers });
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

// The set of tool names manthra actually exposes.
// Used to reject false positives (e.g. {"name":"my-app",...} from a package.json display block).
const KNOWN_TOOLS = new Set([
  'read', 'write', 'edit', 'bash',
  'glob', 'grep', 'list_dir', 'web_fetch', 'http_request',
]);

/**
 * Some Ollama models (notably qwen2.5-coder) output tool calls as plain text
 * instead of using the native tool_calls API field.  Three formats seen in the wild:
 *
 *   1. Markdown fence:    ```json\n{"name":"bash","arguments":{...}}\n```
 *   2. Single-line JSON:  {"name":"read","arguments":{"path":"file.ts"}}
 *   3. Multi-line JSON:   {\n  "name": "write",\n  "arguments": {...}\n}
 *
 * Tool calls are identified by having a `name` that matches a known manthra tool,
 * plus an `arguments` / `input` / `parameters` object.  Everything else is kept as
 * display text so the user still sees explanatory content from the model.
 */
function extractTextToolCalls(text: string): { toolCalls: TextToolCall[]; remainingText: string } {
  const toolCalls: TextToolCall[] = [];
  let remaining = text;

  // ── Pattern 1: markdown code fence ──────────────────────────────────────
  // Take the entire content of the fence so nested `}` in the JSON are handled.
  remaining = remaining.replace(
    /```(?:json)?\s*\n([\s\S]*?)\n```/g,
    (match, content) => {
      const tc = tryParseToolCall(content.trim());
      if (tc) { toolCalls.push(tc); return ''; }
      return match; // not a tool call — keep as display code block
    },
  );

  // ── Pattern 2: single-line bare JSON ────────────────────────────────────
  remaining = remaining
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith('{') && t.endsWith('}')) {
        const tc = tryParseToolCall(t);
        if (tc) { toolCalls.push(tc); return false; }
      }
      return true;
    })
    .join('\n');

  // ── Pattern 3: multi-line bare JSON ─────────────────────────────────────
  // Accumulate lines starting from a `{` until JSON.parse succeeds.
  // Cap at 80 lines to avoid run-away accumulation.
  const lines = remaining.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '{' || (t.startsWith('{') && /"name"\s*:/.test(t))) {
      const startIdx = i;
      let acc = '';
      let resolved = false;
      for (let j = i; j < Math.min(lines.length, i + 80); j++) {
        acc += (j === i ? '' : '\n') + lines[j];
        try {
          JSON.parse(acc); // throws until the object is complete
          const tc = tryParseToolCall(acc);
          if (tc) {
            toolCalls.push(tc);
          } else {
            out.push(...lines.slice(startIdx, j + 1));
          }
          i = j + 1;
          resolved = true;
          break;
        } catch {
          // incomplete — keep accumulating
        }
      }
      if (!resolved) {
        // Never closed within the window — treat as plain text
        out.push(lines[i]);
        i++;
      }
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  remaining = out.join('\n');

  return { toolCalls, remainingText: remaining };
}

function tryParseToolCall(json: string): TextToolCall | null {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    if (typeof obj.name !== 'string') return null;
    // Reject if the name is not a recognised manthra tool (avoids grabbing
    // display code blocks like {"name":"my-package","version":"1.0.0",...})
    if (!KNOWN_TOOLS.has(obj.name)) return null;
    const input = (obj.arguments ?? obj.input ?? obj.parameters ?? {}) as Record<string, unknown>;
    if (typeof input !== 'object' || input === null) return null;
    return { id: `${obj.name}_${Date.now()}`, name: obj.name, input };
  } catch {
    return null;
  }
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

    const body: Record<string, unknown> = {
      model: options.model,
      messages: normalized,
      stream: true,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    };

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

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(body),
    });

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
    const nativeToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          let chunk: OllamaChatChunk;
          try { chunk = JSON.parse(line); } catch { continue; }

          // Thinking tokens stream immediately (shown in real-time by the REPL)
          if (chunk.message?.thinking) {
            yield { type: 'thinking_delta', delta: chunk.message.thinking };
          }

          // Buffer text — don't yield yet; we need the full content to detect tool calls
          if (chunk.message?.content) {
            textBuffer += chunk.message.content;
          }

          // Native tool_calls from the Ollama API
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
        }
      }
    } finally {
      reader.releaseLock();
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
