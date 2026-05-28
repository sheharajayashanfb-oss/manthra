import { useState, useCallback, useEffect, useRef } from 'react';
import type { UIMessage, AgentState, StreamEvent } from '../types';

interface ChatState {
  messages: UIMessage[];
  agents: Map<string, AgentState>;
  isStreaming: boolean;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
}

export function useChat(cwd: string) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    agents: new Map(),
    isStreaming: false,
    tokensIn: 0,
    tokensOut: 0,
    model: '',
    provider: '',
  });

  const currentMsgId = useRef<string | null>(null);

  useEffect(() => {
    // Load initial config
    window.api.getConfig().then((cfg) => {
      setState((s) => ({
        ...s,
        model: cfg.activeModel ?? '',
        provider: cfg.providers.find((p) => p.id === cfg.activeProvider)?.name ?? '',
      }));
    });

    // Subscribe to stream events
    const unsub = window.api.onStreamEvent((event: StreamEvent) => {
      handleStreamEvent(event);
    });
    return unsub;
  }, []);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    setState((s) => {
      const msgs = [...s.messages];
      const agents = new Map(s.agents);

      switch (event.type) {
        case 'text_delta': {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.id === currentMsgId.current) {
            msgs[msgs.length - 1] = { ...last, content: last.content + (event.delta ?? '') };
          }
          break;
        }
        case 'thinking_delta': {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.id === currentMsgId.current) {
            msgs[msgs.length - 1] = { ...last, thinking: (last.thinking ?? '') + (event.delta ?? '') };
          }
          break;
        }
        case 'tool_start': {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.id === currentMsgId.current) {
            msgs[msgs.length - 1] = {
              ...last,
              toolCalls: [...last.toolCalls, { id: event.toolId!, name: event.toolName!, label: event.toolLabel!, status: 'running' }],
            };
          }
          break;
        }
        case 'tool_done': {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.id === currentMsgId.current) {
            msgs[msgs.length - 1] = {
              ...last,
              toolCalls: last.toolCalls.map((tc) =>
                tc.id === event.toolId ? { ...tc, status: event.toolSuccess ? 'done' : 'error', output: event.toolOutput } : tc,
              ),
            };
          }
          break;
        }
        case 'agent_start': {
          agents.set(event.agentId!, {
            id: event.agentId!,
            task: event.agentTask!,
            label: event.agentLabel!,
            color: event.agentColor!,
            status: 'running',
            toolCalls: [],
          });
          // Attach agent to current message
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.id === currentMsgId.current) {
            msgs[msgs.length - 1] = { ...last, agentIds: [...last.agentIds, event.agentId!] };
          }
          break;
        }
        case 'agent_tool_start': {
          const agent = agents.get(event.agentId!);
          if (agent) {
            agents.set(event.agentId!, {
              ...agent,
              toolCalls: [...agent.toolCalls, { id: event.toolId!, name: event.toolName!, label: event.toolLabel!, status: 'running' }],
            });
          }
          break;
        }
        case 'agent_tool_done': {
          const agent = agents.get(event.agentId!);
          if (agent) {
            agents.set(event.agentId!, {
              ...agent,
              toolCalls: agent.toolCalls.map((tc) =>
                tc.id === event.toolId ? { ...tc, status: event.toolSuccess ? 'done' : 'error' } : tc,
              ),
            });
          }
          break;
        }
        case 'agent_done': {
          const agent = agents.get(event.agentId!);
          if (agent) agents.set(event.agentId!, { ...agent, status: 'done' });
          break;
        }
        case 'agent_error': {
          const agent = agents.get(event.agentId!);
          if (agent) agents.set(event.agentId!, { ...agent, status: 'error' });
          break;
        }
        case 'turn_done': {
          return {
            ...s,
            messages: msgs,
            agents,
            isStreaming: false,
            tokensIn: s.tokensIn + (event.tokensIn ?? 0),
            tokensOut: s.tokensOut + (event.tokensOut ?? 0),
          };
        }
        case 'error': {
          return { ...s, messages: msgs, agents, isStreaming: false };
        }
      }

      return { ...s, messages: msgs, agents };
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const msgId = `msg-${Date.now()}`;
    currentMsgId.current = `assistant-${Date.now()}`;

    const userMsg: UIMessage = {
      id: msgId,
      role: 'user',
      content: text,
      toolCalls: [],
      agentIds: [],
      timestamp: Date.now(),
    };

    const assistantMsg: UIMessage = {
      id: currentMsgId.current,
      role: 'assistant',
      content: '',
      toolCalls: [],
      agentIds: [],
      timestamp: Date.now(),
    };

    setState((s) => ({ ...s, messages: [...s.messages, userMsg, assistantMsg], isStreaming: true }));

    await window.api.sendMessage(text, cwd);
  }, [cwd]);

  const stopChat = useCallback(() => {
    window.api.stopChat();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const newChat = useCallback(async () => {
    await window.api.newChat();
    setState((s) => ({ ...s, messages: [], agents: new Map(), tokensIn: 0, tokensOut: 0 }));
    currentMsgId.current = null;
  }, []);

  return { ...state, sendMessage, stopChat, newChat };
}
