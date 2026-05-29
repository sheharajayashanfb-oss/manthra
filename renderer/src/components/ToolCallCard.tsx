import { Terminal, FileText, Search, GitBranch, Globe, CheckCircle2, XCircle, Loader2, Wrench } from 'lucide-react';
import type { ToolCallState } from '../types';

const TOOL_ICONS: Record<string, React.ElementType> = {
  bash: Terminal, run_script: Terminal,
  read_file: FileText, write_file: FileText, edit_file: FileText, delete_file: FileText, list_files: FileText,
  glob_search: Search, grep_search: Search, search_symbol: Search, docs_search: Search,
  git_status: GitBranch, git_diff: GitBranch, git_commit: GitBranch, git_add: GitBranch, git_log: GitBranch,
  web_fetch: Globe, web_search: Globe,
};

export default function ToolCallCard({ tool }: { tool: ToolCallState }) {
  const Icon = TOOL_ICONS[tool.name] ?? Wrench;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 6,
      background: '#f8f8f8', border: '1px solid #ebebeb',
      fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
    }}>
      <Icon size={11} color="#aaa" style={{ flexShrink: 0 }} />
      <span style={{ color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tool.label}
      </span>
      <span style={{ flexShrink: 0 }}>
        {tool.status === 'running' && <Loader2 size={11} color="#888" className="animate-spin" />}
        {tool.status === 'done' && <CheckCircle2 size={11} color="#22c55e" />}
        {tool.status === 'error' && <XCircle size={11} color="#ef4444" />}
      </span>
    </div>
  );
}
