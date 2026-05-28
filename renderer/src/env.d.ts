import type { StreamEvent, ConversationSummary, AppConfig } from './types';

declare global {
  interface Window {
    api: {
      sendMessage(message: string, cwd: string, conversationId?: string): Promise<void>;
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
    };
  }
}

export {};
