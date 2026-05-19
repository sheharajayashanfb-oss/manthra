import { z } from 'zod';

export const ProviderTypeSchema = z.enum([
  'ollama',
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ProviderTypeSchema,
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  apiVersion: z.string().optional(),
  defaultModel: z.string().optional(),
  enabled: z.boolean().default(true),
  extra: z.record(z.string()).optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const PermissionSchema = z.enum(['ask', 'allow-session', 'allow-always', 'deny-session', 'deny-always']);
export type Permission = z.infer<typeof PermissionSchema>;

export const AppConfigSchema = z.object({
  activeProvider: z.string().optional(),
  activeModel: z.string().optional(),
  providers: z.array(ProviderConfigSchema).default([]),
  systemPrompt: z.string().optional(),
  permissions: z.record(PermissionSchema).default({}),
  maxTokens: z.number().default(8192),
  temperature: z.number().default(0),
  webPort: z.number().default(4875),
  theme: z.enum(['dark', 'light']).default('dark'),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
