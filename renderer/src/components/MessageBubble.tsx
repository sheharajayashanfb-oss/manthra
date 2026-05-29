import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, ChevronDown, ChevronRight, Brain, FileText as FileIcon } from 'lucide-react';
import type { UIMessage, AgentState } from '../types';
import ToolCallCard from './ToolCallCard';
import SubAgentCard from './SubAgentCard';
import ThinkingIndicator from './ThinkingIndicator';

interface Props {
  message: UIMessage;
  agents: Map<string, AgentState>;
  isLast: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        position: 'absolute', top: 8, right: 8,
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 5,
        background: '#fff', border: '1px solid #e0e0e0',
        fontSize: 11, color: '#888', cursor: 'pointer',
        opacity: 0, transition: 'opacity 0.15s',
      }}
      className="copy-btn"
    >
      {copied ? <><Check size={10} color="#22c55e" /> copied</> : <><Copy size={10} /> copy</>}
    </button>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 8,
      border: '1px solid #f0f0f0',
      background: '#fafafa',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, color: '#aaa',
        }}
      >
        <Brain size={12} color="#ccc" />
        <span style={{ fontStyle: 'italic' }}>thinking</span>
        <span style={{ flex: 1 }} />
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div style={{
          padding: '8px 12px 12px',
          fontSize: 12, color: '#aaa',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'pre-wrap', lineHeight: 1.6,
          borderTop: '1px solid #f0f0f0',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, agents, isLast }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    const images = message.attachments?.filter((a) => a.isImage) ?? [];
    const files = message.attachments?.filter((a) => !a.isImage) ?? [];
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {/* Image previews */}
        {images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
            {images.map((img) => (
              <img
                key={img.name}
                src={`data:${img.mimeType};base64,${img.content}`}
                alt={img.name}
                style={{ maxWidth: 240, maxHeight: 180, borderRadius: 10, objectFit: 'cover', border: '1px solid #e5e5e5' }}
              />
            ))}
          </div>
        )}
        {/* File chips */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end' }}>
            {files.map((file) => (
              <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: '#f0f0f0', border: '1px solid #e0e0e0' }}>
                <FileIcon size={11} color="#888" />
                <span style={{ fontSize: 12, color: '#555' }}>{file.name}</span>
              </div>
            ))}
          </div>
        )}
        {/* Text bubble */}
        {message.content && (
          <div style={{
            maxWidth: '80%',
            padding: '12px 16px',
            borderRadius: 18, borderBottomRightRadius: 4,
            background: '#111', color: '#fff',
            fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            {message.content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 32 }}>
      {message.thinking && <ThinkingBlock text={message.thinking} />}

      {message.toolCalls.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {message.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} tool={tc} />
          ))}
        </div>
      )}

      {message.agentIds.map((id) => {
        const agent = agents.get(id);
        return agent ? <SubAgentCard key={id} agent={agent} /> : null;
      })}

      {message.content ? (
        <div className="prose" style={{ position: 'relative' }}>
          <style>{`.prose .group:hover .copy-btn { opacity: 1; }`}</style>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre: ({ children, ...props }) => (
                <div className="group" style={{ position: 'relative' }}>
                  <pre {...props}>{children}</pre>
                  <CopyButton text={String((children as React.ReactElement)?.props?.children ?? '')} />
                </div>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      ) : (
        isLast && !message.toolCalls.length && !message.agentIds.length && (
          <ThinkingIndicator />
        )
      )}
    </div>
  );
}
