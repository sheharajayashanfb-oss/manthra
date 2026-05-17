import OpenAI from 'openai';
import type { Provider, Message, ChatOptions, StreamEvent, ModelInfo, ToolDefinition, ContentBlock } from './types.js';

const OPENAI_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
  { id: 'o3', name: 'o3', contextWindow: 200000 },
  { id: 'o4-mini', name: 'o4-mini', contextWindow: 200000 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
];

function toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content });
      continue;
    }
    const toolCallBlocks = msg.content.filter((b): b is import('./types.js').ToolCallContent => b.type === 'tool_call');
    const toolResultBlocks = msg.content.filter((b): b is import('./types.js').ToolResultContent => b.type === 'tool_result');
    const textBlocks = msg.content.filter((b): b is import('./types.js').TextContent => b.type === 'text');

    if (toolResultBlocks.length > 0) {
      for (const tr of toolResultBlocks) {
        result.push({ role: 'tool', tool_call_id: tr.tool_call_id, content: tr.content });
      }
    } else if (msg.role === 'assistant' && toolCallBlocks.length > 0) {
      result.push({
        role: 'assistant',
        content: textBlocks.map((b) => b.text).join('') || null,
        tool_calls: toolCallBlocks.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      });
    } else {
      const text = textBlocks.map((b) => b.text).join('');
      result.push({ role: msg.role as 'user' | 'assistant' | 'system', content: text });
    }
  }
  return result;
}

function toOpenAITools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

export class OpenAIProvider implements Provider {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  private client: OpenAI;

  constructor(config: {
    id: string;
    name: string;
    type: string;
    apiKey?: string;
    baseURL?: string;
    apiVersion?: string;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? 'not-needed',
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      defaultHeaders: config.apiVersion ? { 'api-version': config.apiVersion } : {},
    });
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamEvent> {
    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: options.model,
      messages: toOpenAIMessages(messages),
      stream: true,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      ...(options.tools?.length ? { tools: toOpenAITools(options.tools) } : {}),
    };

    const stream = await this.client.chat.completions.create(params);
    const activeCalls: Map<number, { id: string; name: string; args: string }> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'text_delta', delta: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            activeCalls.set(tc.index, { id: tc.id ?? `call_${tc.index}`, name: tc.function.name, args: tc.function.arguments ?? '' });
            yield { type: 'tool_call_start', tool_call: { id: tc.id ?? `call_${tc.index}`, name: tc.function.name } };
          } else if (tc.function?.arguments) {
            const existing = activeCalls.get(tc.index);
            if (existing) {
              existing.args += tc.function.arguments;
              yield { type: 'tool_call_delta', tool_call: { id: existing.id, name: existing.name, input_delta: tc.function.arguments } };
            }
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        for (const [, call] of activeCalls) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(call.args); } catch {}
          yield { type: 'tool_call_done', tool_call: { id: call.id, name: call.name, input } };
        }
        activeCalls.clear();
      } else if (chunk.choices[0]?.finish_reason === 'stop') {
        yield { type: 'message_done' };
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter((m) => m.id.startsWith('gpt') || m.id.startsWith('o'))
        .map((m) => ({ id: m.id, name: m.id }));
    } catch {
      return OPENAI_MODELS;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
