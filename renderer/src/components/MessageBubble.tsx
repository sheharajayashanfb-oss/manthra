import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import type { UIMessage, AgentState } from '../types';
import ToolCallCard from './ToolCallCard';
import SubAgentCard from './SubAgentCard';

interface Props {
  message: UIMessage;
  agents: Map<string, AgentState>;
  isLast: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#737373] hover:text-[#e2e2e2] transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? <Check size={12} className="text-[#22c55e]" /> : <Copy size={12} />}
    </button>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-[#2e2e2e] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[#141414] hover:bg-[#1a1a1a] text-xs text-[#737373] transition-colors"
      >
        <Brain size={12} className="text-[#8b5cf6]" />
        <span>Thinking</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-3 py-2 text-xs text-[#737373] font-mono whitespace-pre-wrap border-t border-[#2e2e2e]">
          {text}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, agents, isLast }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4"
      >
        <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm bg-[#1e1b4b] border border-[#312e81]/50 text-sm text-[#e2e2e2] leading-relaxed">
          {message.content}
        </div>
      </motion.div>
    );
  }

  // Assistant
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center text-[10px] font-bold text-white mt-0.5">
          M
        </div>

        <div className="flex-1 min-w-0">
          {/* Thinking block */}
          {message.thinking && <ThinkingBlock text={message.thinking} />}

          {/* Tool calls */}
          {message.toolCalls.length > 0 && (
            <div className="mb-3 space-y-1">
              {message.toolCalls.map((tc) => <ToolCallCard key={tc.id} tool={tc} />)}
            </div>
          )}

          {/* Sub-agent cards */}
          {message.agentIds.map((id) => {
            const agent = agents.get(id);
            return agent ? <SubAgentCard key={id} agent={agent} /> : null;
          })}

          {/* Text content */}
          {message.content && (
            <div className="prose text-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre: ({ children, ...props }) => (
                    <div className="group relative">
                      <pre {...props}>{children}</pre>
                      <CopyButton text={String((children as React.ReactElement)?.props?.children ?? '')} />
                    </div>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isLast && !message.content && (
                <span className="inline-block w-1.5 h-4 bg-[#8b5cf6] animate-pulse ml-0.5 rounded-sm" />
              )}
            </div>
          )}

          {/* Streaming cursor when empty */}
          {isLast && !message.content && !message.toolCalls.length && !message.agentIds.length && (
            <span className="inline-block w-1.5 h-4 bg-[#8b5cf6] animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
