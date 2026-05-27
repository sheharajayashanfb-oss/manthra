import type { Provider } from './types.js';
import type { ProviderConfig } from '../config/types.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';

const OPENAI_DEFAULT_URLS: Record<string, string> = {
  openai:     'https://api.openai.com/v1',
  zen:        'https://opencode.ai/zen/v1',
  groq:       'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  cerebras:   'https://api.cerebras.ai/v1',
};

const registry = new Map<string, Provider>();

export function createProvider(config: ProviderConfig): Provider {
  switch (config.type) {
    case 'ollama':
      return new OllamaProvider({ id: config.id, name: config.name, type: config.type, baseURL: config.baseURL ?? 'http://127.0.0.1:11434', apiKey: config.apiKey });
    case 'openai':
    case 'zen':
    case 'groq':
    case 'openrouter':
    case 'cerebras':
      return new OpenAIProvider({ id: config.id, name: config.name, type: config.type, baseURL: config.baseURL ?? OPENAI_DEFAULT_URLS[config.type], apiKey: config.apiKey });
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function loadProviders(configs: ProviderConfig[]): void {
  registry.clear();
  for (const config of configs) {
    if (!config.enabled) continue;
    try {
      registry.set(config.id, createProvider(config));
    } catch (e) {
      console.error(`Failed to load provider ${config.id}:`, e);
    }
  }
}

export function getProvider(id: string): Provider | undefined {
  return registry.get(id);
}

export function getAllProviders(): Provider[] {
  return Array.from(registry.values());
}

export function getDefaultProvider(configs: ProviderConfig[], activeId?: string): Provider | undefined {
  if (activeId && registry.has(activeId)) return registry.get(activeId);
  const first = configs.find((c) => c.enabled);
  if (first) return registry.get(first.id);
  return undefined;
}
