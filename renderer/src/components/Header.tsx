import { FolderOpen, Plus, Settings, Zap } from 'lucide-react';

interface HeaderProps {
  cwd: string;
  onCwdChange: () => void;
  model: string;
  provider: string;
  onNewChat: () => void;
}

export default function Header({ cwd, onCwdChange, model, provider, onNewChat }: HeaderProps) {
  const dirName = cwd.split('/').filter(Boolean).pop() ?? cwd;

  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-[#2e2e2e] bg-[#111] shrink-0 titlebar-drag">
      {/* macOS traffic light spacer */}
      <div className="w-16 shrink-0" />

      {/* Logo */}
      <div className="flex items-center gap-2 no-drag">
        <div className="w-6 h-6 rounded-full bg-[#8b5cf6] flex items-center justify-center">
          <Zap size={12} className="text-white" />
        </div>
        <span className="font-semibold text-sm tracking-wide text-white">MANTHRA</span>
      </div>

      <div className="flex-1" />

      {/* Working directory */}
      <button
        onClick={onCwdChange}
        className="no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a1a1a] border border-[#2e2e2e] hover:border-[#8b5cf6] hover:bg-[#1e1b2e] transition-all text-xs text-[#737373] hover:text-[#e2e2e2] max-w-xs"
        title={cwd}
      >
        <FolderOpen size={12} className="shrink-0 text-[#8b5cf6]" />
        <span className="truncate">{dirName}</span>
      </button>

      {/* Model badge */}
      {model && (
        <div className="no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a1a1a] border border-[#2e2e2e] text-xs text-[#737373]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <span className="truncate max-w-[140px]">{model}</span>
        </div>
      )}

      {/* New chat */}
      <button
        onClick={onNewChat}
        className="no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-medium transition-colors"
      >
        <Plus size={12} />
        New chat
      </button>

      <button className="no-drag p-1.5 rounded-md hover:bg-[#1a1a1a] text-[#737373] hover:text-[#e2e2e2] transition-colors">
        <Settings size={14} />
      </button>
    </header>
  );
}
