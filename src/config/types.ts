import { z } from 'zod';

export const ProviderTypeSchema = z.enum([
  'ollama',
  'openai',
  'zen',
  'groq',
  'openrouter',
  'cerebras',
]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const McpServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  transport: z.enum(['stdio', 'http']).default('stdio'),
  // stdio transport fields
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  // http transport field
  url: z.string().optional(),
});
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

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

export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  providerId: z.string(),
  model: z.string(),
  tools: z.array(z.string()).default([]), // empty = all tools
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  enabled: z.boolean().default(true),
  orchestratorProviderId: z.string(),
  orchestratorModel: z.string(),
  members: z.array(TeamMemberSchema).default([]),
});
export type Team = z.infer<typeof TeamSchema>;

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
  mcpServers: z.array(McpServerConfigSchema).default([]),
  multiAgent: z.boolean().default(false),
  teams: z.array(TeamSchema).default([]),
  activeTeam: z.string().optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
