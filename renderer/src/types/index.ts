export type MessageRole = 'user' | 'assistant';
export type AgentStatus = 'running' | 'done' | 'error';
export type ToolStatus = 'running' | 'done' | 'error';

export interface ToolCallState {
  id: string;
  name: string;
  label: string;
  status: ToolStatus;
  output?: string;
}

export interface AgentToolCallState {
  id: string;
  name: string;
  label: string;
  status: ToolStatus;
}

export interface AgentState {
  id: string;
  task: string;
  label: string;
  color: string;
  status: AgentStatus;
  toolCalls: AgentToolCallState[];
}

export interface UIMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  toolCalls: ToolCallState[];
  agentIds: string[];
  timestamp: number;
  tokensIn?: number;
  tokensOut?: number;
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

export interface StreamEvent {
  type: string;
  delta?: string;
  toolId?: string;
  toolName?: string;
  toolLabel?: string;
  toolSuccess?: boolean;
  toolOutput?: string;
  agentId?: string;
  agentTask?: string;
  agentLabel?: string;
  agentColor?: string;
  agentToolCount?: number;
  tokensIn?: number;
  tokensOut?: number;
  message?: string;
}
