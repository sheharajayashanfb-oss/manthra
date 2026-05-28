import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { UIMessage, AgentState } from '../types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

interface Props {
  messages: UIMessage[];
  agents: Map<string, AgentState>;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shadow-lg shadow-[#8b5cf6]/20">
        <Sparkles size={28} className="text-white" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[#e2e2e2] mb-1">What can I help you with?</h2>
        <p className="text-sm text-[#737373] max-w-sm">
          Ask me to write code, explain concepts, run commands, or spawn multiple agents to tackle complex tasks in parallel.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-sm">
        {[
          'Explain this codebase',
          'Write unit tests',
          'Find and fix bugs',
          'Refactor a module',
        ].map((s) => (
          <div
            key={s}
            className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-xs text-[#737373] text-center cursor-default hover:border-[#8b5cf6]/40 hover:text-[#e2e2e2] transition-all"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatView({ messages, agents, isStreaming, onSend, onStop }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                agents={agents}
                isLast={i === messages.length - 1 && isStreaming}
              />
            ))
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#2e2e2e] p-4">
        <ChatInput isStreaming={isStreaming} onSend={onSend} onStop={onStop} />
      </div>
    </div>
  );
}
