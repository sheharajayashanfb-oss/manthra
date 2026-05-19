import type { Provider, Message, ContentBlock, ChatOptions, StreamEvent, ModelInfo } from './types.js';

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

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

interface OllamaChatChunk {
  model?: string;
  message?: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: OllamaToolCall[];
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

    for (const b of blocks) {
      if (b.type === 'text') {
        textParts.push(b.text);
      } else if (b.type === 'tool_call') {
        toolCalls.push({
          function: { name: b.name, arguments: b.input },
        });
      } else if (b.type === 'tool_result') {
        // Tool result becomes a standalone role:"tool" message
        const content = b.is_error ? `[ERROR] ${b.content}` : b.content;
        result.push({ role: 'tool', content });
        // Skip adding to textParts/toolCalls — it's its own message
        continue;
      }
    }

    // If this block had tool_result(s), they were already pushed; skip the assistant message if empty
    if (toolCalls.length > 0) {
      const msg: OllamaMessage = { role: m.role, content: textParts.join('') };
      msg.tool_calls = toolCalls;
      result.push(msg);
    } else if (textParts.length > 0) {
      result.push({ role: m.role, content: textParts.join('') });
    }
  }

  return result;
}

// Try multiple base URLs in order — handles localhost IPv4/IPv6 variance across OS
async function fetchWithFallback(paths: string[], baseURL: string, headers?: Record<string, string>): Promise<Response> {
  const defaults = ['http://localhost:11434', 'http://127.0.0.1:11434'];
  const candidates = defaults.includes(baseURL)
    ? ['http://127.0.0.1:11434', 'http://localhost:11434']
    : [baseURL];

  let lastErr: unknown;
  for (const base of candidates) {
    for (const path of paths) {
      try {
        const timeoutMs = base.startsWith('https://') ? 15000 : 4000;
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeoutMs), headers });
        if (res.ok) return res;
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama error ${res.status}: ${body || res.statusText}`);
      } catch (e) {
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

    if (isCloud) {
      if (options.temperature != null) body['temperature'] = options.temperature;
      if (options.maxTokens != null) body['max_tokens'] = options.maxTokens;
    } else {
      body['options'] = {
        ...(options.temperature != null ? { temperature: options.temperature } : {}),
        ...(options.maxTokens != null ? { num_predict: options.maxTokens } : {}),
      };
    }

    // Include tool definitions in Ollama format
    if (options.tools && options.tools.length > 0) {
      body['tools'] = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    let response: Response;
    try {
      const signal = isCloud ? AbortSignal.timeout(60000) : undefined;
      response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      const cause = (e instanceof Error && (e as Error & { cause?: unknown }).cause);
      const detail = cause instanceof Error ? cause.message : (cause ? String(cause) : '');
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
    let textBuffer = '';
    let thinkingBuffer = '';
    const nativeToolCalls: OllamaToolCall[] = [];

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

      if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
        for (const tc of chunk.message.tool_calls) {
          nativeToolCalls.push(tc);
        }
      }

      if (chunk.done) {
        if (chunk.prompt_eval_count) inputTokens = chunk.prompt_eval_count;
        if (chunk.eval_count) outputTokens = chunk.eval_count;
      }
    };

    try {
      let lineBuffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        const lines = (lineBuffer + raw).split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) processLine(line);
      }
      const tail = decoder.decode();
      if (tail) lineBuffer += tail;
      if (lineBuffer.trim()) processLine(lineBuffer);
    } finally {
      reader.releaseLock();
    }

    if (thinkingBuffer) {
      yield { type: 'thinking_delta', delta: thinkingBuffer };
    }

    if (textBuffer.trim()) {
      yield { type: 'text_delta', delta: textBuffer };
    }

    // Yield tool call events for each native tool call
    for (const tc of nativeToolCalls) {
      yield {
        type: 'tool_call_done',
        tool_call: {
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: tc.function.name,
          input: tc.function.arguments,
        },
      };
    }

    yield { type: 'message_done', usage: { input_tokens: inputTokens, output_tokens: outputTokens } };
  }

  async listModels(): Promise<ModelInfo[]> {
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
