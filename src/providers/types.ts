export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolCallContent {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_call_id: string;
  content: string;
  is_error?: boolean;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded
  mimeType?: string;
}

export type ContentBlock = TextContent | ToolCallContent | ToolResultContent | ImageContent;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type ModelPlan = 'free' | 'paid' | 'preview';

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  plan?: ModelPlan;
  description?: string;
}

export type StreamEventType =
  | 'text_delta'
  | 'thinking_delta'
  | 'tool_call_start'
  | 'tool_call_delta'
  | 'tool_call_done'
  | 'message_done'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  delta?: string;
  tool_call?: {
    id: string;
    name: string;
    input_delta?: string;
    input?: Record<string, unknown>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

export interface ChatOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  tools?: ToolDefinition[];
  think?: boolean | 'low' | 'medium' | 'high';
  format?: 'json' | Record<string, unknown>;
  images?: string[]; // base64 images for vision (on the last user message)
}

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly type: string;

  chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  testConnection(): Promise<boolean>;
  embed?(model: string, input: string | string[], opts?: { dimensions?: number; truncate?: boolean }): Promise<number[][]>;
}
