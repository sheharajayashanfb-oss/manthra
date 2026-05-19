import type { AppConfig } from './types.js';

export const DEFAULT_CONFIG: AppConfig = {
  providers: [],
  permissions: {},
  maxTokens: 8192,
  temperature: 0,
  webPort: 4875,
  theme: 'dark',
};

export const DEFAULT_SYSTEM_PROMPT = `You are Manthra, an AI coding assistant. Help the user with coding questions, architecture decisions, debugging, and general software development topics.

Be concise and direct. Prefer code examples over lengthy explanations. When writing code, use the language or framework the user is working with.`;
