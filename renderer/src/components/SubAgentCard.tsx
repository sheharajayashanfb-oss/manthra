import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Terminal, FileText, Search, GitBranch, Globe, Wrench } from 'lucide-react';
import type { AgentState, AgentToolCallState } from '../types';

const TOOL_ICONS: Record<string, React.ElementType> = {
  bash: Terminal, run_script: Terminal,
  read_file: FileText, write_file: FileText, edit_file: FileText, list_files: FileText,
  glob_search: Search, grep_search: Search, search_symbol: Search,
  git_status: GitBranch, git_diff: GitBranch, git_commit: GitBranch,
  web_fetch: Globe, web_search: Globe,
};

function ToolStep({ tool, agentColor }: { tool: AgentToolCallState; agentColor: string }) {
  const Icon = TOOL_ICONS[tool.name] ?? Wrench;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
      <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {tool.status === 'running' && <Loader2 size={10} style={{ color: agentColor }} className="animate-spin" />}
        {tool.status === 'done' && <CheckCircle2 size={10} color="#22c55e" />}
        {tool.status === 'error' && <XCircle size={10} color="#ef4444" />}
      </span>
      <Icon size={10} color="#bbb" style={{ flexShrink: 0 }} />
      <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.label}</span>
    </div>
  );
}

export default function SubAgentCard({ agent }: { agent: AgentState }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 10,
      border: `1px solid ${agent.color}30`,
      background: '#fafafa',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {agent.status === 'running' && <Loader2 size={11} style={{ color: agent.color }} className="animate-spin" />}
          {agent.status === 'done' && <CheckCircle2 size={11} color="#22c55e" />}
          {agent.status === 'error' && <XCircle size={11} color="#ef4444" />}
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: agent.color, flexShrink: 0 }}>{agent.label}</span>
        <span style={{ color: '#ddd', fontSize: 11, flexShrink: 0 }}>·</span>
        <span style={{ fontSize: 12, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.task}</span>
        {agent.status === 'done' && agent.toolCalls.length > 0 && (
          <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0, marginRight: 4 }}>
            {agent.toolCalls.length} tool{agent.toolCalls.length !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{ color: '#ccc', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (agent.toolCalls.length > 0 || agent.status === 'running' || (agent.status === 'error' && agent.error)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 12px 8px', borderTop: `1px solid ${agent.status === 'error' ? '#ef444420' : agent.color + '20'}` }}>
              {agent.toolCalls.map((tc) => (
                <ToolStep key={tc.id} tool={tc} agentColor={agent.color} />
              ))}
              {agent.status === 'running' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: agent.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#bbb' }}>working…</span>
                </div>
              )}
              {agent.status === 'error' && agent.error && (
                <div style={{ padding: '4px 8px', fontSize: 11, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-word' }}>
                  {agent.error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
