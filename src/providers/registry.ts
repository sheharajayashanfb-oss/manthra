import type { Provider } from './types.js';
import type { ProviderConfig } from '../config/types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { OllamaProvider } from './ollama.js';
import { OpenRouterProvider } from './openrouter.js';
import { ZenProvider } from './zen.js';

const registry = new Map<string, Provider>();

export function createProvider(config: ProviderConfig): Provider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider({ id: config.id, name: config.name, apiKey: config.apiKey, baseURL: config.baseURL });
    case 'openai':
      return new OpenAIProvider({ id: config.id, name: config.name, type: config.type, apiKey: config.apiKey, baseURL: config.baseURL });
    case 'azure-openai':
      return new OpenAIProvider({ id: config.id, name: config.name, type: config.type, apiKey: config.apiKey, baseURL: config.baseURL, apiVersion: config.apiVersion });
    case 'gemini':
      return new GeminiProvider({ id: config.id, name: config.name, apiKey: config.apiKey });
    case 'ollama':
      return new OllamaProvider({ id: config.id, name: config.name, type: config.type, baseURL: config.baseURL ?? 'http://localhost:11434' });
    case 'lmstudio':
      return new OllamaProvider({ id: config.id, name: config.name, type: config.type, baseURL: config.baseURL ?? 'http://localhost:1234' });
    case 'openrouter':
      return new OpenRouterProvider({ id: config.id, name: config.name, apiKey: config.apiKey });
    case 'zen':
      return new ZenProvider({ id: config.id, name: config.name, apiKey: config.apiKey });
    case 'custom-openai':
      return new OpenAIProvider({ id: config.id, name: config.name, type: config.type, apiKey: config.apiKey, baseURL: config.baseURL });
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
