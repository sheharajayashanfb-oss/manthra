import Anthropic from '@anthropic-ai/sdk';
import type { Provider, Message, ChatOptions, StreamEvent, ModelInfo, ToolDefinition } from './types.js';

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', contextWindow: 200000 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000 },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', contextWindow: 200000 },
];

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      continue;
    }
    const content: Anthropic.ContentBlock[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        content.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_call') {
        content.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        } as Anthropic.ToolUseBlock);
      } else if (block.type === 'tool_result') {
        content.push({
          type: 'tool_result',
          tool_use_id: block.tool_call_id,
          content: block.content,
          is_error: block.is_error,
        } as unknown as Anthropic.ContentBlock);
      }
    }
    result.push({ role: msg.role as 'user' | 'assistant', content });
  }
  return result;
}

function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));
}

export class AnthropicProvider implements Provider {
  readonly id: string;
  readonly name: string;
  readonly type = 'anthropic';
  private client: Anthropic;

  constructor(config: { id: string; name: string; apiKey?: string; baseURL?: string }) {
    this.id = config.id;
    this.name = config.name;
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamEvent> {
    const system = messages.find((m) => m.role === 'system');
    const filtered = messages.filter((m) => m.role !== 'system');

    const params: Anthropic.MessageStreamParams = {
      model: options.model,
      max_tokens: options.maxTokens ?? 8192,
      messages: toAnthropicMessages(filtered),
      ...(system || options.system
        ? { system: typeof system?.content === 'string' ? system.content : (options.system ?? '') }
        : {}),
      ...(options.tools?.length ? { tools: toAnthropicTools(options.tools) } : {}),
    };

    const stream = this.client.messages.stream(params);
    const currentToolCall: { id: string; name: string; input: string } | null = null;
    let activeToolCall: { id: string; name: string; input: string } | null = currentToolCall;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          activeToolCall = { id: event.content_block.id, name: event.content_block.name, input: '' };
          yield { type: 'tool_call_start', tool_call: { id: activeToolCall.id, name: activeToolCall.name } };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', delta: event.delta.text };
        } else if (event.delta.type === 'input_json_delta' && activeToolCall) {
          activeToolCall.input += event.delta.partial_json;
          yield { type: 'tool_call_delta', tool_call: { id: activeToolCall.id, name: activeToolCall.name, input_delta: event.delta.partial_json } };
        }
      } else if (event.type === 'content_block_stop') {
        if (activeToolCall) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(activeToolCall.input); } catch {}
          yield { type: 'tool_call_done', tool_call: { id: activeToolCall.id, name: activeToolCall.name, input } };
          activeToolCall = null;
        }
      } else if (event.type === 'message_delta' && event.usage) {
        yield { type: 'message_done', usage: { input_tokens: 0, output_tokens: event.usage.output_tokens } };
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return ANTHROPIC_MODELS;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
