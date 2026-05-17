import OpenAI from 'openai';
import type { Provider, Message, ChatOptions, StreamEvent, ModelInfo } from './types.js';
import { OpenAIProvider } from './openai.js';

const BASE_URL = 'https://openrouter.ai/api/v1';

interface ORModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  description?: string;
}

export class OpenRouterProvider extends OpenAIProvider {
  private apiKey: string;

  constructor(config: { id: string; name: string; apiKey?: string }) {
    super({
      id: config.id,
      name: config.name,
      type: 'openrouter',
      apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY ?? '',
      baseURL: BASE_URL,
    });
    this.apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
  }

  override async listModels(): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${BASE_URL}/models`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return FALLBACK_OPENROUTER_MODELS;
      const data = await res.json() as { data: ORModel[] };

      return data.data
        .filter((m) => m.id)
        .map((m) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.context_length,
          plan: (isFree(m.pricing) ? 'free' : 'paid') as import('./types.js').ModelPlan,
          description: m.description,
        }))
        .sort((a, b) => {
          // Free models first, then alphabetical
          if (a.plan === 'free' && b.plan !== 'free') return -1;
          if (b.plan === 'free' && a.plan !== 'free') return 1;
          return a.id.localeCompare(b.id);
        });
    } catch {
      return FALLBACK_OPENROUTER_MODELS;
    }
  }
}

function isFree(pricing: { prompt: string; completion: string }): boolean {
  return (
    (!pricing.prompt || pricing.prompt === '0') &&
    (!pricing.completion || pricing.completion === '0')
  );
}

const FALLBACK_OPENROUTER_MODELS: ModelInfo[] = [
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct', plan: 'free', contextWindow: 131072 },
  { id: 'meta-llama/llama-3.2-1b-instruct:free', name: 'Llama 3.2 1B Instruct', plan: 'free', contextWindow: 131072 },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B', plan: 'free', contextWindow: 8192 },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', plan: 'free', contextWindow: 32768 },
  { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen 2.5 7B Instruct', plan: 'free', contextWindow: 32768 },
  { id: 'openai/gpt-4o', name: 'GPT-4o', plan: 'paid', contextWindow: 128000 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', plan: 'paid', contextWindow: 128000 },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', plan: 'paid', contextWindow: 200000 },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', plan: 'paid', contextWindow: 1048576 },
];
