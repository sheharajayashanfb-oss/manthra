import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { AppConfigSchema, type AppConfig } from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';

export const CONFIG_DIR = join(homedir(), '.manthra');
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export const MEMORY_FILE = join(CONFIG_DIR, 'memory.json');
export const CONVERSATIONS_DIR = join(CONFIG_DIR, 'conversations');

let _config: AppConfig | null = null;

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(CONVERSATIONS_DIR)) mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

export function loadConfig(): AppConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    writeConfig(DEFAULT_CONFIG);
    _config = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    const parsed = AppConfigSchema.safeParse({ ...DEFAULT_CONFIG, ...raw });
    if (!parsed.success) {
      _config = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }
    _config = parsed.data;
    return parsed.data;
  } catch {
    _config = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}

export function writeConfig(config: AppConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  _config = config;
}

export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const updated = AppConfigSchema.parse({ ...current, ...partial });
  writeConfig(updated);
  return updated;
}
