// Shared IPC event types between main process and renderer

export type AgentStatus = 'running' | 'done' | 'error';
export type ToolStatus = 'running' | 'done' | 'error';
export type MessageRole = 'user' | 'assistant';

export interface StreamEvent {
  type:
    | 'text_delta'
    | 'thinking_delta'
    | 'tool_start'
    | 'tool_done'
    | 'agent_start'
    | 'agent_tool_start'
    | 'agent_tool_done'
    | 'agent_done'
    | 'agent_error'
    | 'turn_done'
    | 'error';
  // text / thinking
  delta?: string;
  // tool events
  toolId?: string;
  toolName?: string;
  toolLabel?: string;
  toolSuccess?: boolean;
  toolOutput?: string;
  // agent events
  agentId?: string;
  agentTask?: string;
  agentLabel?: string;
  agentColor?: string;
  agentToolCount?: number;
  // turn done
  tokensIn?: number;
  tokensOut?: number;
  // error
  message?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messageCount: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  baseURL?: string;
  enabled: boolean;
}

export interface AppConfig {
  activeProvider?: string;
  activeModel?: string;
  providers: ProviderInfo[];
  maxTokens: number;
  temperature: number;
}

export interface PermissionRequest {
  id: string;
  tool: string;
  action: string;
  details: string;
}
