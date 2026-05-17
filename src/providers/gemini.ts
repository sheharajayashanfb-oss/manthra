import { GoogleGenerativeAI, type GenerativeModel, type Content, type Part, type FunctionDeclaration } from '@google/generative-ai';
import type { Provider, Message, ChatOptions, StreamEvent, ModelInfo, ToolDefinition } from './types.js';

const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2097152 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1048576 },
];

function toGeminiContents(messages: Message[]): Content[] {
  const result: Content[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const role = msg.role === 'user' ? 'user' : 'model';
    if (typeof msg.content === 'string') {
      result.push({ role, parts: [{ text: msg.content }] });
      continue;
    }
    const parts: Part[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'tool_call') {
        parts.push({ functionCall: { name: block.name, args: block.input } } as Part);
      } else if (block.type === 'tool_result') {
        parts.push({ functionResponse: { name: block.tool_call_id, response: { result: block.content } } } as Part);
      }
    }
    if (parts.length > 0) result.push({ role, parts });
  }
  return result;
}

function toGeminiFunctions(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema as FunctionDeclaration['parameters'],
  }));
}

export class GeminiProvider implements Provider {
  readonly id: string;
  readonly name: string;
  readonly type = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(config: { id: string; name: string; apiKey?: string }) {
    this.id = config.id;
    this.name = config.name;
    this.genAI = new GoogleGenerativeAI(config.apiKey ?? process.env.GOOGLE_API_KEY ?? '');
  }

  private getModel(modelId: string, options: ChatOptions): GenerativeModel {
    const systemMessage = options.system;
    return this.genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: systemMessage ? { role: 'system', parts: [{ text: systemMessage }] } : undefined,
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
      ...(options.tools?.length
        ? { tools: [{ functionDeclarations: toGeminiFunctions(options.tools) }] }
        : {}),
    });
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamEvent> {
    const system = messages.find((m) => m.role === 'system');
    const filtered = messages.filter((m) => m.role !== 'system');
    const systemText = system
      ? (typeof system.content === 'string' ? system.content : system.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))
      : options.system;

    const chatOpts: ChatOptions = { ...options, system: systemText };
    const model = this.getModel(options.model, chatOpts);
    const contents = toGeminiContents(filtered);
    const history = contents.slice(0, -1);
    const lastContent = contents[contents.length - 1];

    if (!lastContent) {
      yield { type: 'error', error: 'No messages provided' };
      return;
    }

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastContent.parts);

    for await (const chunk of result.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if ('text' in part && part.text) {
          yield { type: 'text_delta', delta: part.text };
        } else if ('functionCall' in part && part.functionCall) {
          const fc = part.functionCall;
          const id = `gemini_${Date.now()}`;
          yield { type: 'tool_call_start', tool_call: { id, name: fc.name ?? '' } };
          yield { type: 'tool_call_done', tool_call: { id, name: fc.name ?? '', input: (fc.args ?? {}) as Record<string, unknown> } };
        }
      }
    }
    yield { type: 'message_done' };
  }

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent('hi');
      return true;
    } catch {
      return false;
    }
  }
}
