import type { AppConfig, ProviderConfig } from './types.js';
import { writeConfig } from './loader.js';

const BUILTIN_PRESETS: ProviderConfig[] = [
  {
    id: 'zen-default',
    name: 'ZEN (OpenCode)',
    type: 'zen',
    defaultModel: 'big-pickle',
    enabled: true,
  },
  {
    id: 'openrouter-default',
    name: 'OpenRouter',
    type: 'openrouter',
    defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
    enabled: true,
  },
  {
    id: 'anthropic-default',
    name: 'Anthropic',
    type: 'anthropic',
    defaultModel: 'claude-sonnet-4-6',
    enabled: true,
  },
  {
    id: 'ollama-default',
    name: 'Ollama (local)',
    type: 'ollama',
    baseURL: 'http://localhost:11434',
    enabled: true,
  },
];

const ENV_KEY_MAP: Record<string, string> = {
  'zen-default': 'ZEN_API_KEY',
  'openrouter-default': 'OPENROUTER_API_KEY',
  'anthropic-default': 'ANTHROPIC_API_KEY',
  'ollama-default': '',
};

export function autoInitProviders(config: AppConfig): { config: AppConfig; changed: boolean } {
  const existingIds = new Set(config.providers.map((p) => p.id));
  const toAdd: ProviderConfig[] = [];

  for (const preset of BUILTIN_PRESETS) {
    if (existingIds.has(preset.id)) continue;
    const envKey = ENV_KEY_MAP[preset.id];
    const apiKey = envKey ? process.env[envKey] : undefined;
    toAdd.push({ ...preset, ...(apiKey ? { apiKey } : {}) });
  }

  if (toAdd.length === 0) return { config, changed: false };

  const updated: AppConfig = { ...config, providers: [...config.providers, ...toAdd] };

  // Set a sensible default active provider
  if (!updated.activeProvider) {
    // Prefer ZEN (has free models that work immediately)
    const zenPreset = updated.providers.find((p) => p.id === 'zen-default');
    if (zenPreset) {
      updated.activeProvider = zenPreset.id;
      updated.activeModel = zenPreset.defaultModel;
    }
  }

  writeConfig(updated);
  return { config: updated, changed: true };
}

export function syncEnvApiKeys(config: AppConfig): { config: AppConfig; changed: boolean } {
  let changed = false;
  const providers = config.providers.map((p) => {
    const envKey = ENV_KEY_MAP[p.id];
    if (!envKey) return p;
    const envVal = process.env[envKey];
    if (envVal && !p.apiKey) {
      changed = true;
      return { ...p, apiKey: envVal };
    }
    return p;
  });
  if (!changed) return { config, changed: false };
  const updated = { ...config, providers };
  writeConfig(updated);
  return { config: updated, changed: true };
}
