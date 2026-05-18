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
async function fetchWithFallback(paths: string[], baseURL: string): Promise<Response> {
  // If the user explicitly set a non-default base URL, use it directly
  const defaults = ['http://localhost:11434', 'http://127.0.0.1:11434'];
  const candidates = defaults.includes(baseURL)
    ? ['http://127.0.0.1:11434', 'http://localhost:11434']
    : [baseURL];

  let lastErr: unknown;
  for (const base of candidates) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) return res;
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error(
    `Cannot reach Ollama at ${baseURL}.\n` +
    `Make sure Ollama is running: https://ollama.ai\n` +
    `(tried: ${candidates.join(', ')})\n` +
    (lastErr ? `Error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : '')
  );
}

export class OllamaProvider implements Provider {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  private baseURL: string;

  constructor(config: { id: string; name: string; type: string; baseURL?: string }) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.baseURL = (config.baseURL ?? 'http://localhost:11434').replace(/\/$/, '');
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
      headers: { 'Content-Type': 'application/json' },
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          let chunk: OllamaChatChunk;
          try { chunk = JSON.parse(line); } catch { continue; }

          if (chunk.message?.thinking) {
            yield { type: 'thinking_delta', delta: chunk.message.thinking };
          }

          if (chunk.message?.content) {
            yield { type: 'text_delta', delta: chunk.message.content };
          }

          if (chunk.message?.tool_calls?.length) {
            for (const tc of chunk.message.tool_calls) {
              const id = tc.id ?? `${tc.function.name}_${Date.now()}`;
              yield {
                type: 'tool_call_done',
                tool_call: { id, name: tc.function.name, input: tc.function.arguments ?? {} },
              };
            }
          }

          if (chunk.done) {
            if (chunk.prompt_eval_count) inputTokens = chunk.prompt_eval_count;
            if (chunk.eval_count) outputTokens = chunk.eval_count;

            yield {
              type: 'message_done',
              usage: { input_tokens: inputTokens, output_tokens: outputTokens },
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Throws on failure so the web UI can surface the real error
    const res = await fetchWithFallback(['/api/tags'], this.baseURL);
    const data = await res.json() as { models?: OllamaModel[] };
    return (data.models ?? []).map((m) => ({ id: m.name, name: m.name }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await fetchWithFallback(['/api/tags'], this.baseURL);
      return true;
    } catch {
      return false;
    }
  }
}
