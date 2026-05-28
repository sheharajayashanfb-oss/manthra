import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Terminal, FileText, Search, GitBranch, Globe } from 'lucide-react';
import type { AgentState, AgentToolCallState } from '../types';

const TOOL_ICONS: Record<string, React.ElementType> = {
  bash: Terminal, run_script: Terminal,
  read_file: FileText, write_file: FileText, edit_file: FileText,
  glob_search: Search, grep_search: Search,
  git_status: GitBranch, git_diff: GitBranch, git_commit: GitBranch,
  web_fetch: Globe, web_search: Globe,
};

function ToolStep({ tool, color }: { tool: AgentToolCallState; color: string }) {
  const Icon = TOOL_ICONS[tool.name] ?? Terminal;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-black/20 transition-colors"
    >
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        {tool.status === 'running' && <Loader2 size={12} style={{ color }} className="animate-spin" />}
        {tool.status === 'done' && <CheckCircle2 size={12} className="text-[#22c55e]" />}
        {tool.status === 'error' && <XCircle size={12} className="text-[#ef4444]" />}
      </div>
      <Icon size={11} className="text-[#737373] shrink-0" />
      <span className="text-xs font-mono text-[#a1a1a1] truncate">{tool.label}</span>
    </motion.div>
  );
}

export default function SubAgentCard({ agent }: { agent: AgentState }) {
  const [expanded, setExpanded] = useState(true);

  const borderColor = agent.color;
  const glowColor = `${agent.color}22`;

  const statusIcon = () => {
    if (agent.status === 'running') return <Loader2 size={13} style={{ color: agent.color }} className="animate-spin" />;
    if (agent.status === 'done') return <CheckCircle2 size={13} className="text-[#22c55e]" />;
    return <XCircle size={13} className="text-[#ef4444]" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${borderColor}44`, boxShadow: `0 0 12px ${glowColor}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
        style={{ background: `linear-gradient(135deg, ${agent.color}11, transparent)` }}
      >
        {statusIcon()}
        <span className="text-xs font-semibold" style={{ color: agent.color }}>{agent.label}</span>
        <span className="text-[#2e2e2e] text-xs">·</span>
        <span className="text-xs text-[#737373] truncate flex-1">{agent.task}</span>

        {agent.status === 'done' && (
          <span className="text-[10px] text-[#4a4a4a] shrink-0">
            {agent.toolCalls.length} tool{agent.toolCalls.length !== 1 ? 's' : ''}
          </span>
        )}

        <div className="text-[#4a4a4a] shrink-0">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>
      </button>

      {/* Tool steps */}
      <AnimatePresence>
        {expanded && agent.toolCalls.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t"
            style={{ borderColor: `${borderColor}22` }}
          >
            <div className="px-3 py-2 space-y-0.5 bg-black/20">
              {agent.toolCalls.map((tc) => (
                <ToolStep key={tc.id} tool={tc} color={agent.color} />
              ))}
              {agent.status === 'running' && (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex items-center gap-2 py-1.5 px-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: agent.color }} />
                  <span className="text-[10px] text-[#4a4a4a]">Working…</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
