import type { Provider, Message, ContentBlock, ChatOptions, StreamEvent, ModelInfo } from './types.js';

interface OpenAIMessage {
  role: string;
  content: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIChunk {
  choices?: Array<{
    delta: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

function normalizeMessages(messages: Message[], system?: string): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (system) {
    result.push({ role: 'system', content: system });
  }

  for (const m of messages) {
    if (m.role === 'system') continue;

    if (typeof m.content === 'string') {
      result.push({ role: m.role, content: m.content });
      continue;
    }

    const blocks = m.content as ContentBlock[];
    const textParts: string[] = [];
    const imageParts: OpenAIContentPart[] = [];
    const toolCalls: OpenAIToolCall[] = [];
    let hasToolResult = false;
    let reasoningContent: string | undefined;

    for (const b of blocks) {
      if (b.type === 'text') {
        textParts.push(b.text);
      } else if (b.type === 'thinking') {
        reasoningContent = b.thinking;
      } else if (b.type === 'image') {
        const mime = b.mimeType ?? 'image/png';
        imageParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b.data}` } });
      } else if (b.type === 'tool_call') {
        toolCalls.push({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        });
      } else if (b.type === 'tool_result') {
        result.push({
          role: 'tool',
          tool_call_id: b.tool_call_id,
          content: b.is_error ? `[ERROR] ${b.content}` : b.content,
        });
        hasToolResult = true;
      }
    }

    if (hasToolResult) continue;

    if (toolCalls.length > 0) {
      const msg: OpenAIMessage = { role: m.role, content: textParts.join('') || null, tool_calls: toolCalls };
      if (reasoningContent) msg.reasoning_content = reasoningContent;
      result.push(msg);
    } else if (imageParts.length > 0) {
      const parts: OpenAIContentPart[] = [];
      if (textParts.length > 0) parts.push({ type: 'text', text: textParts.join('') });
      parts.push(...imageParts);
      result.push({ role: m.role, content: parts });
    } else {
      const msg: OpenAIMessage = { role: m.role, content: textParts.join('') };
      if (reasoningContent) msg.reasoning_content = reasoningContent;
      result.push(msg);
    }
  }

  return result;
}

export class OpenAIProvider implements Provider {
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
    this.baseURL = (config.baseURL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
    return h;
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamEvent> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: normalizeMessages(messages, options.system),
      stream: true,
      stream_options: { include_usage: true },
    };

    if (options.maxTokens != null) {
      const isOSeries = /^o\d/i.test(options.model);
      body[isOSeries ? 'max_completion_tokens' : 'max_tokens'] = options.maxTokens;
    }
    if (options.temperature != null) body['temperature'] = options.temperature;
    if (options.format === 'json') body['response_format'] = { type: 'json_object' };

    if (options.tools && options.tools.length > 0) {
      body['tools'] = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body['tool_choice'] = 'auto';
    }

    const signal = options.signal ?? AbortSignal.timeout(120000);
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot reach ${this.name} at ${this.baseURL} — ${detail}`);
    }

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`${this.name} error ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Accumulated state
    const toolCallMap = new Map<number, { id: string; name: string; argsBuf: string }>();
    let usage: { prompt_tokens: number; completion_tokens: number } | undefined;
    let lineBuf = '';
    let aborted = false;

    const parseLines = (chunk: string): StreamEvent[] => {
      const events: StreamEvent[] = [];
      lineBuf += chunk;
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        let parsed: OpenAIChunk;
        try { parsed = JSON.parse(line.slice(6)); } catch { continue; }

        if (parsed.usage) usage = parsed.usage;

        const choice = parsed.choices?.[0];
        if (!choice) continue;

        if (choice.delta.reasoning_content) {
          events.push({ type: 'thinking_delta', delta: choice.delta.reasoning_content });
        }

        if (choice.delta.content) {
          events.push({ type: 'text_delta', delta: choice.delta.content });
        }

        if (choice.delta.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            if (!toolCallMap.has(tc.index)) {
              toolCallMap.set(tc.index, { id: '', name: '', argsBuf: '' });
            }
            const entry = toolCallMap.get(tc.index)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.argsBuf += tc.function.arguments;
          }
        }
      }
      return events;
    };

    try {
      while (true) {
        let read: { done: boolean; value?: Uint8Array };
        try {
          read = await reader.read();
        } catch (e) {
          if ((e as { name?: string }).name === 'AbortError') { aborted = true; break; }
          throw e;
        }
        if (read.done) break;
        const events = parseLines(decoder.decode(read.value, { stream: true }));
        for (const ev of events) yield ev;
      }
    } finally {
      reader.releaseLock();
    }

    if (!aborted) {
      // Flush remaining buffer
      if (lineBuf.trim()) {
        const events = parseLines('\n');
        for (const ev of events) yield ev;
      }

      // Emit completed tool calls
      for (const [, tc] of toolCallMap) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.argsBuf || '{}'); } catch { /* leave empty */ }
        yield { type: 'tool_call_done', tool_call: { id: tc.id, name: tc.name, input } };
      }

      yield {
        type: 'message_done',
        usage: usage ? { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens } : undefined,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseURL}/models`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const data = await res.json() as { data?: Array<{ id: string }> };
      return (data.data ?? [])
        .map((m) => ({ id: m.id, name: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseURL}/models`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
