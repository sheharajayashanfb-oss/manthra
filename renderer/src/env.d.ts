import type { StreamEvent, ConversationSummary, AppConfig } from './types';

export interface SlashCommandDef {
  name: string;
  description: string;
  args?: boolean;
  placeholder?: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  isCurrent: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  isCurrent: boolean;
}

export interface TeamInfo {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isCurrent: boolean;
}

export type SlashExecResult =
  | { kind: 'output'; text: string }
  | { kind: 'action'; action: 'clear' | 'exit' | 'open_web' }
  | { kind: 'set_model'; model: string; providerName?: string }
  | { kind: 'set_provider'; providerId: string; providerName: string; model: string }
  | { kind: 'set_team'; teamId: string | null; teamName: string | null }
  | { kind: 'show_model_picker' }
  | { kind: 'show_provider_picker' }
  | { kind: 'show_team_picker' }
  | { kind: 'error'; text: string };

declare global {
  interface Window {
    api: {
      sendMessage(message: string, cwd: string, attachments?: import('./types').FileAttachment[]): Promise<void>;
      stopChat(): Promise<void>;
      newChat(): Promise<void>;
      pickDirectory(): Promise<string | null>;
      getHistory(): Promise<ConversationSummary[]>;
      loadConversation(id: string): Promise<unknown>;
      deleteConversation(id: string): Promise<boolean>;
      getConfig(): Promise<AppConfig>;
      respondToPermission(id: string, decision: 'allow' | 'deny' | 'allow_always'): Promise<void>;
      onStreamEvent(cb: (event: StreamEvent) => void): () => void;
      onPermissionRequest(cb: (req: { id: string; tool: string; action: string; details: string }) => void): () => void;
      slashList(): Promise<SlashCommandDef[]>;
      slashExec(name: string, args: string, cwd?: string): Promise<SlashExecResult>;
      slashListModels(): Promise<ModelInfo[]>;
      slashListProviders(): Promise<ProviderInfo[]>;
      slashListTeams(): Promise<TeamInfo[]>;
    };
  }
}

export {};
