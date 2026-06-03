import { useState, useCallback, useEffect, useRef } from 'react';
import type { UIMessage, AgentState, StreamEvent, FileAttachment } from '../types';
import type { SlashExecResult } from '../env';

interface ChatState {
  messages: UIMessage[];
  agents: Map<string, AgentState>;
  isStreaming: boolean;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
  team: string;
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
    team: '',
  });

  const currentMsgId = useRef<string | null>(null);

  useEffect(() => {
    // Load initial config
    window.api.getConfig().then((cfg) => {
      setState((s) => ({
        ...s,
        model: cfg.activeModel ?? '',
        provider: cfg.providers.find((p) => p.id === cfg.activeProvider)?.name ?? '',
        team: cfg.activeTeamName ?? '',
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
          console.log('[useChat] agent_start', event.agentId, 'map keys before:', [...agents.keys()]);
          agents.set(event.agentId!, {
            id: event.agentId!,
            task: event.agentTask!,
            label: event.agentLabel!,
            color: event.agentColor!,
            status: 'running',
            toolCalls: [],
          });
          console.log('[useChat] agent_start done, map keys after:', [...agents.keys()]);
          // Attach agent to current message
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.id === currentMsgId.current) {
            msgs[msgs.length - 1] = { ...last, agentIds: [...last.agentIds, event.agentId!] };
          }
          break;
        }
        case 'agent_tool_start': {
          console.log('[useChat] agent_tool_start', event.agentId, event.toolName, 'map keys:', [...agents.keys()]);
          const agent = agents.get(event.agentId!);
          console.log('[useChat] agent_tool_start found?', !!agent);
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
          console.log('[useChat] agent_done', event.agentId, 'map keys:', [...agents.keys()]);
          const agent = agents.get(event.agentId!);
          console.log('[useChat] agent_done found?', !!agent, 'status was:', agent?.status);
          if (agent) agents.set(event.agentId!, { ...agent, status: 'done' });
          break;
        }
        case 'agent_error': {
          console.log('[useChat] agent_error', event.agentId, 'map keys:', [...agents.keys()]);
          const agent = agents.get(event.agentId!);
          console.log('[useChat] agent_error found?', !!agent, 'status was:', agent?.status);
          if (agent) agents.set(event.agentId!, { ...agent, status: 'error', error: event.message });
          break;
        }
        case 'init_done': {
          const doneMsg: UIMessage = {
            id: `init-done-${Date.now()}`,
            role: 'assistant',
            content: event.message ?? '✓ AGENTS.md saved',
            toolCalls: [],
            agentIds: [],
            timestamp: Date.now(),
          };
          return { ...s, messages: [...msgs, doneMsg], agents, isStreaming: false };
        }
        case 'init_error': {
          const errMsg: UIMessage = {
            id: `init-err-${Date.now()}`,
            role: 'assistant',
            content: `**Error:** ${event.message ?? 'Generation failed'}`,
            toolCalls: [],
            agentIds: [],
            timestamp: Date.now(),
          };
          return { ...s, messages: [...msgs, errMsg], agents, isStreaming: false };
        }
        case 'auto_compact': {
          const compactMsg: UIMessage = {
            id: `compact-${Date.now()}`,
            role: 'assistant',
            content: event.message ?? '✦ Auto-compacted',
            toolCalls: [],
            agentIds: [],
            timestamp: Date.now(),
          };
          return { ...s, messages: [...msgs, compactMsg], agents };
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
          const errText = event.message ?? 'An error occurred';
          const errMsg: UIMessage = {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `**Error:** ${errText}`,
            toolCalls: [],
            agentIds: [],
            timestamp: Date.now(),
          };
          return { ...s, messages: [...msgs, errMsg], agents, isStreaming: false };
        }
      }

      return { ...s, messages: msgs, agents };
    });
  }, []);

  const sendMessage = useCallback(async (text: string, attachments: FileAttachment[] = []) => {
    const msgId = `msg-${Date.now()}`;
    currentMsgId.current = `assistant-${Date.now()}`;

    const userMsg: UIMessage = {
      id: msgId,
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
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

    await window.api.sendMessage(text, cwd, attachments.length > 0 ? attachments : undefined);
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

  const handleSlashResult = useCallback((result: SlashExecResult) => {
    if (result.kind === 'show_model_picker' || result.kind === 'show_provider_picker') return; // handled in ChatInput
    if (result.kind === 'action') {
      if (result.action === 'clear') { newChat(); return; }
      if (result.action === 'exit' || result.action === 'open_web') return;
      if (result.action === 'init_streaming') {
        const initMsgId = `init-${Date.now()}`;
        currentMsgId.current = initMsgId;
        const msg: UIMessage = { id: initMsgId, role: 'assistant', content: '', toolCalls: [], agentIds: [], timestamp: Date.now() };
        setState((s) => ({ ...s, messages: [...s.messages, msg], isStreaming: true }));
        return;
      }
      return;
    }
    if (result.kind === 'set_model') {
      setState((s) => ({ ...s, model: result.model }));
      const provText = result.providerName ? ` on ${result.providerName}` : '';
      const msg: UIMessage = { id: `slash-${Date.now()}`, role: 'assistant', content: `Switched to **${result.model}**${provText}`, toolCalls: [], agentIds: [], timestamp: Date.now() };
      setState((s) => ({ ...s, messages: [...s.messages, msg] }));
      return;
    }
    if (result.kind === 'set_provider') {
      setState((s) => ({ ...s, provider: result.providerName, model: result.model }));
      const msg: UIMessage = { id: `slash-${Date.now()}`, role: 'assistant', content: `Switched to provider **${result.providerName}**${result.model ? ` (model: ${result.model})` : ''}`, toolCalls: [], agentIds: [], timestamp: Date.now() };
      setState((s) => ({ ...s, messages: [...s.messages, msg] }));
      return;
    }
    if (result.kind === 'set_team') {
      setState((s) => ({ ...s, team: result.teamName ?? '' }));
      const content = result.teamId
        ? `Team set to **${result.teamName}**. Sub-agent spawning is now routed through this team.`
        : `Team mode disabled. Running as single agent.`;
      const msg: UIMessage = { id: `slash-${Date.now()}`, role: 'assistant', content, toolCalls: [], agentIds: [], timestamp: Date.now() };
      setState((s) => ({ ...s, messages: [...s.messages, msg] }));
      return;
    }
    // output and error — show as assistant message
    const text = result.kind === 'output' ? result.text : `**Error:** ${result.text}`;
    const msg: UIMessage = { id: `slash-${Date.now()}`, role: 'assistant', content: text, toolCalls: [], agentIds: [], timestamp: Date.now() };
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
  }, [newChat]);

  return { ...state, sendMessage, stopChat, newChat, handleSlashResult };
}
