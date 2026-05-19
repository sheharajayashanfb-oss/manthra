import type { AppConfig, ProviderConfig } from './types.js';
import { writeConfig } from './loader.js';

const BUILTIN_PRESETS: ProviderConfig[] = [
  {
    id: 'ollama-default',
    name: 'Ollama (local)',
    type: 'ollama',
    baseURL: 'http://localhost:11434',
    enabled: true,
  },
];

export function autoInitProviders(config: AppConfig): { config: AppConfig; changed: boolean } {
  const existingIds = new Set(config.providers.map((p) => p.id));
  const toAdd: ProviderConfig[] = [];

  for (const preset of BUILTIN_PRESETS) {
    if (existingIds.has(preset.id)) continue;
    toAdd.push(preset);
  }

  if (toAdd.length === 0) return { config, changed: false };

  const updated: AppConfig = { ...config, providers: [...config.providers, ...toAdd] };

  if (!updated.activeProvider) {
    updated.activeProvider = 'ollama-default';
  }

  writeConfig(updated);
  return { config: updated, changed: true };
}

export function syncEnvApiKeys(config: AppConfig): { config: AppConfig; changed: boolean } {
  return { config, changed: false };
}
