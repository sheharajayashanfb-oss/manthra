import { useEffect, useRef, useCallback } from 'react';
import type { UIMessage, AgentState, FileAttachment } from '../types';
import type { SlashExecResult } from '../env';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

interface Props {
  cwd: string;
  messages: UIMessage[];
  agents: Map<string, AgentState>;
  isStreaming: boolean;
  onSend: (text: string, attachments: FileAttachment[]) => void;
  onStop: () => void;
  onSlashResult: (result: SlashExecResult) => void;
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, userSelect: 'none' }}>
      <p style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>How can I help?</p>
      <p style={{ fontSize: 14, color: '#bbb' }}>Type a message or / for commands</p>
    </div>
  );
}

export default function ChatView({ cwd, messages, agents, isStreaming, onSend, onStop, onSlashResult }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const focusInput = useCallback(() => {
    const active = document.activeElement;
    if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
      document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }} onClick={focusInput}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 16px' }}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                agents={agents}
                isLast={i === messages.length - 1}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: '12px 24px 20px' }}>
        <ChatInput cwd={cwd} isStreaming={isStreaming} onSend={onSend} onStop={onStop} onSlashResult={onSlashResult} />
        <p style={{ fontSize: 11, color: '#ddd', textAlign: 'center', marginTop: 8 }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
