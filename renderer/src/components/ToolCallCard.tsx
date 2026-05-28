import { motion } from 'framer-motion';
import { Terminal, FileText, Search, GitBranch, Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ToolCallState } from '../types';

const TOOL_ICONS: Record<string, React.ElementType> = {
  bash: Terminal,
  run_script: Terminal,
  read_file: FileText,
  write_file: FileText,
  edit_file: FileText,
  glob_search: Search,
  grep_search: Search,
  search_symbol: Search,
  git_status: GitBranch,
  git_diff: GitBranch,
  git_commit: GitBranch,
  web_fetch: Globe,
  web_search: Globe,
};

export default function ToolCallCard({ tool }: { tool: ToolCallState }) {
  const Icon = TOOL_ICONS[tool.name] ?? Terminal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-3 py-2 my-1 rounded-lg bg-[#141414] border border-[#2e2e2e] text-xs"
    >
      <Icon size={12} className="text-[#737373] shrink-0" />
      <span className="text-[#a1a1a1] font-mono truncate flex-1">{tool.label}</span>
      {tool.status === 'running' && <Loader2 size={12} className="text-[#8b5cf6] animate-spin shrink-0" />}
      {tool.status === 'done' && <CheckCircle2 size={12} className="text-[#22c55e] shrink-0" />}
      {tool.status === 'error' && <XCircle size={12} className="text-[#ef4444] shrink-0" />}
    </motion.div>
  );
}
