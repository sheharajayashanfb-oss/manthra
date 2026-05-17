import type { ModelInfo } from './types.js';
import { OpenAIProvider } from './openai.js';

const BASE_URL = 'https://opencode.ai/zen/v1';

// Known ZEN models with plan information
// Source: https://opencode.ai/docs/zen/
const ZEN_MODELS: ModelInfo[] = [
  // Free tier
  { id: 'big-pickle', name: 'Big Pickle', plan: 'free', contextWindow: 131072 },
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash', plan: 'free', contextWindow: 65536 },
  { id: 'minimax-m2.5-free', name: 'MiniMax M2.5', plan: 'free', contextWindow: 65536 },
  { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super', plan: 'free', contextWindow: 131072 },
  // Paid tier (selection of popular models available via ZEN gateway)
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', plan: 'paid', contextWindow: 200000 },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', plan: 'paid', contextWindow: 200000 },
  { id: 'gpt-4o', name: 'GPT-4o', plan: 'paid', contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', plan: 'paid', contextWindow: 128000 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', plan: 'paid', contextWindow: 1048576 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', plan: 'preview', contextWindow: 1048576 },
  { id: 'deepseek-v3', name: 'DeepSeek V3', plan: 'paid', contextWindow: 65536 },
  { id: 'deepseek-r1', name: 'DeepSeek R1', plan: 'paid', contextWindow: 65536 },
];

export class ZenProvider extends OpenAIProvider {
  private apiKey: string;

  constructor(config: { id: string; name: string; apiKey?: string }) {
    super({
      id: config.id,
      name: config.name,
      type: 'zen',
      apiKey: config.apiKey ?? process.env.ZEN_API_KEY ?? process.env.OPENCODE_API_KEY ?? '',
      baseURL: BASE_URL,
    });
    this.apiKey = config.apiKey ?? process.env.ZEN_API_KEY ?? process.env.OPENCODE_API_KEY ?? '';
  }

  override async listModels(): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${BASE_URL}/models`, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return ZEN_MODELS;
      const data = await res.json() as { data?: Array<{ id: string; name?: string; context_length?: number }> };

      if (!data.data?.length) return ZEN_MODELS;

      // Merge live model list with known plan info
      const knownPlan = new Map(ZEN_MODELS.map((m) => [m.id, m.plan]));
      const FREE_KEYWORDS = ['free', 'pickle'];

      return data.data.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.context_length,
        plan: knownPlan.get(m.id) ?? (FREE_KEYWORDS.some((k) => m.id.toLowerCase().includes(k)) ? 'free' : 'paid'),
      })).sort((a, b) => {
        if (a.plan === 'free' && b.plan !== 'free') return -1;
        if (b.plan === 'free' && a.plan !== 'free') return 1;
        return a.id.localeCompare(b.id);
      });
    } catch {
      return ZEN_MODELS;
    }
  }

  override async testConnection(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const res = await fetch(`${BASE_URL}/models`, { headers, signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
